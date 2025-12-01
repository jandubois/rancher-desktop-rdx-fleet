# Backend Service & Extension Conflict Prevention

This document describes the implementation plan for adding a backend service to the Fleet GitOps extension and preventing conflicts between multiple Fleet extensions.

## Problem Statement

When multiple Fleet extensions are installed (e.g., the base extension plus custom extensions), they can conflict by:
1. All trying to manage the same GitRepos
2. Deploying conflicting configurations
3. No awareness of each other's presence

## Goals

1. Add a background helper process (backend service) to the extension
2. Use the backend's container hostname (which is the container ID) for identification
3. Track extension ownership of Fleet to prevent conflicts
4. Allow graceful handover when extensions are uninstalled or Rancher Desktop restarts

## Architecture Overview

```
┌─ Extension Container ─────────────────────────────┐
│                                                   │
│  ┌─ Backend Service (Express.js) ──────────────┐  │
│  │  Port 8080 (exposed via compose.yaml)       │  │
│  │                                             │  │
│  │  Responsibilities:                          │  │
│  │  - Identify self via hostname (container ID)│  │
│  │  - Track ownership ConfigMap                │  │
│  │  - Periodic health checks                   │  │
│  │  - GitRepo management                       │  │
│  └─────────────────────────────────────────────┘  │
│                    ↑                              │
│                    │ HTTP (localhost:8080)        │
│                    ↓                              │
│  ┌─ Frontend UI (React) ───────────────────────┐  │
│  │  - Display ownership status                 │  │
│  │  - Manual takeover option                   │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
└───────────────────────────────────────────────────┘
         ↓
┌─ Kubernetes (rancher-desktop) ────────────────────┐
│  Namespace: fleet-local                           │
│                                                   │
│  ConfigMap: fleet-extension-ownership             │
│  ├─ ownerExtensionName: "fleet-gitops-base"       │
│  ├─ ownerContainerId: "abc123..."                 │
│  └─ timestamp: "2025-12-01T..."                   │
│                                                   │
│  GitRepos (with annotations):                     │
│  └─ metadata.annotations:                         │
│      └─ io.rancher-desktop/managed-by: "abc123"   │
└───────────────────────────────────────────────────┘
```

## Ownership Model

### Extension Identification

Each Fleet extension has:
- **Container ID**: Available as hostname in backend container
- **Extension Name**: From image labels or metadata (e.g., `io.rancher-desktop.fleet.name`)
- **Extension Type**: Label `io.rancher-desktop.fleet.type` (e.g., "base", "custom")

### Ownership ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fleet-extension-ownership
  namespace: fleet-local
data:
  ownerExtensionName: "fleet-gitops-base"
  ownerContainerId: "abc123def456..."
  ownerExtensionType: "base"
  claimedAt: "2025-12-01T10:00:00Z"
```

### Ownership Rules

1. **On extension startup**:
   - Check if ownership ConfigMap exists
   - If no ConfigMap → claim ownership
   - If ConfigMap exists → check if owner container is running
   - If owner container not running → claim ownership (takeover)
   - If owner container running → yield (display warning in UI)

2. **On claiming ownership**:
   - Update ConfigMap with own identity
   - Delete GitRepos not owned by self (based on annotation)
   - Deploy own GitRepos with ownership annotation

3. **After Rancher Desktop restart**:
   - Container IDs change, but extension names persist
   - If same extension name → can reclaim ownership
   - If different extension name → follow normal takeover rules

## Implementation Plan

### Phase 1: Backend Service Infrastructure

Create the basic backend service that can communicate with the frontend.

#### 1.1 Create backend directory structure
```
extension/
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts          # Express server entry point
│   │   ├── routes/
│   │   │   └── health.ts     # Health check endpoint
│   │   └── services/
│   │       └── identity.ts   # Container ID / extension name
│   └── Dockerfile.backend    # Backend-specific Dockerfile
```

#### 1.2 Create compose.yaml
```yaml
services:
  backend:
    image: fleet-gitops:dev   # Must be hardcoded (RD limitation)
    pull_policy: never
    ports:
      - "8080:8080"
    # Future: mount kubeconfig for kubectl access
```

#### 1.3 Update metadata.json
```json
{
  "vm": {
    "composefile": "compose.yaml"
  },
  ...
}
```

#### 1.4 Create basic endpoints
- `GET /health` - Returns backend status
- `GET /identity` - Returns container ID and extension info

### Phase 2: Frontend-Backend Communication

#### 2.1 Create backend client service
```typescript
// extension/ui/src/services/BackendService.ts
export class BackendService {
  private baseUrl = 'http://localhost:8080';

  async getIdentity(): Promise<{ containerId: string; extensionName: string }>;
  async getHealth(): Promise<{ status: string }>;
}
```

#### 2.2 Add fallback for when backend unavailable
- Display warning if backend not reachable
- Frontend can still function in read-only mode

### Phase 3: Ownership Tracking

#### 3.1 ConfigMap management in backend
```typescript
// extension/backend/src/services/ownership.ts
export class OwnershipService {
  async checkOwnership(): Promise<OwnershipStatus>;
  async claimOwnership(): Promise<void>;
  async releaseOwnership(): Promise<void>;
}
```

#### 3.2 Container running check
- Use Docker socket or ddClient API to list containers
- Filter by Fleet extension labels
- Check if owner container ID is in running containers

#### 3.3 Startup ownership flow
```
Backend starts
    ↓
Get own container ID (hostname)
    ↓
Check ownership ConfigMap
    ↓
┌─ No ConfigMap ────────────────┐
│   → Claim ownership           │
│   → Deploy GitRepos           │
└───────────────────────────────┘
    ↓
┌─ ConfigMap exists ────────────┐
│   Check owner container       │
│   ↓                           │
│   Running? → Yield            │
│   Not running? → Takeover     │
└───────────────────────────────┘
```

### Phase 4: GitRepo Ownership Annotations

#### 4.1 Update KubernetesService
Add ownership annotation when creating/updating GitRepos:
```typescript
async applyGitRepo(name, repo, branch, paths, ownerId) {
  const gitRepoYaml = {
    metadata: {
      annotations: {
        'io.rancher-desktop/managed-by': ownerId,
        'io.rancher-desktop/extension-name': extensionName,
      }
    },
    ...
  };
}
```

#### 4.2 Filter owned GitRepos
- When fetching GitRepos, optionally filter to only owned ones
- UI shows indicator if viewing "foreign" GitRepos

### Phase 5: Takeover Flow

#### 5.1 Automatic takeover
When owner container not running:
1. Update ownership ConfigMap
2. Scan all GitRepos in fleet-local
3. Delete those with different owner annotation
4. Deploy own GitRepos

#### 5.2 Manual takeover (UI)
- Button: "Take Control of Fleet"
- Confirmation dialog showing what will be deleted
- Progress indicator during takeover

## Rancher Desktop Workarounds

Based on `docs/reference/rancher-desktop-extension-bugs.md`:

1. **Use `vm.composefile` instead of `vm.image`**
2. **Hardcode image name in compose.yaml** (`${DESKTOP_PLUGIN_IMAGE}` not expanded)
3. **Add `pull_policy: never`** for local images
4. **Use HTTP on port 8080** (`ddClient.extension.vm.service` not implemented)
5. **Create socket directory** if using sockets (`/run/guest-services/` doesn't exist)

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `extension/backend/` | Create | New backend service directory |
| `extension/backend/package.json` | Create | Backend dependencies |
| `extension/backend/src/index.ts` | Create | Express server |
| `extension/backend/src/services/identity.ts` | Create | Container identification |
| `extension/backend/src/services/ownership.ts` | Create | Ownership management |
| `extension/compose.yaml` | Create | Docker Compose for backend |
| `extension/metadata.json` | Update | Add `vm.composefile` |
| `extension/Dockerfile` | Update | Multi-stage with backend |
| `extension/ui/src/services/BackendService.ts` | Create | Frontend client |
| `extension/ui/src/services/KubernetesService.ts` | Update | Add ownership annotations |

## Open Questions

1. **Priority vs. timestamp?** - If two extensions claim ownership simultaneously, which wins? Options:
   - First-come-first-served (timestamp)
   - Priority based on extension type (base < custom)
   - Always ask user

2. **Graceful shutdown?** - Should extension release ownership when uninstalled?
   - Pro: Clean handover
   - Con: Uninstall might not trigger gracefully

3. **kubectl access from backend?** - Options:
   - Mount kubeconfig into backend container
   - Use host binary via ddClient (but from backend?)
   - Proxy through frontend

## Testing Plan

1. **Single extension** - Verify ownership claim works
2. **Two extensions** - Verify one yields to the other
3. **Restart Rancher Desktop** - Verify same extension reclaims ownership
4. **Uninstall owner** - Verify other extension takes over
5. **Race condition** - Start two extensions simultaneously
