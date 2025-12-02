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
┌─ Host Machine ──────────────────────────────────────────────────────────────┐
│                                                                             │
│  Host Binaries (from extension image):                                      │
│  - rdctl, kubectl, helm (via rd-exec wrapper)                               │
│  - Only accessible via ddClient.extension.host.cli.exec() from frontend     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↑
                                    │ ddClient.extension.host.cli.exec()
                                    │
┌─ Docker Desktop VM ─────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─ Backend Container (via compose.yaml) ─────────────────────────────────┐ │
│  │  Port 8080 (exposed)                                                   │ │
│  │                                                                        │ │
│  │  CAN:                                                                  │ │
│  │  - Get own container ID via hostname                                   │ │
│  │  - Access Docker socket (if mounted)                                   │ │
│  │  - Run kubectl (if binary included + kubeconfig mounted)               │ │
│  │  - Serve HTTP API to frontend                                          │ │
│  │                                                                        │ │
│  │  CANNOT:                                                               │ │
│  │  - Run host binaries (rdctl, etc.) directly                            │ │
│  │  - Access ddClient SDK (frontend-only)                                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                              ↑                                              │
│                              │ HTTP (localhost:8080)                        │
│                              ↓                                              │
│  ┌─ Frontend UI Container ────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  CAN:                                                                  │ │
│  │  - Use ddClient.extension.host.cli.exec() for host binaries            │ │
│  │  - Make HTTP requests to backend                                       │ │
│  │  - Use ddClient.docker.listContainers() to check running containers    │ │
│  │                                                                        │ │
│  │  RESPONSIBILITIES:                                                     │ │
│  │  - Call `rdctl extension ls` and send to backend                       │ │
│  │  - Proxy kubectl calls if backend doesn't have kubectl                 │ │
│  │  - Display ownership status                                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─ Kubernetes (rancher-desktop context) ──────────────────────────────────────┐
│  Namespace: fleet-local                                                     │
│                                                                             │
│  ConfigMap: fleet-extension-ownership                                       │
│  ├─ ownerExtensionName: "fleet-gitops-base"                                 │
│  ├─ ownerContainerId: "abc123..."                                           │
│  └─ claimedAt: "2025-12-01T..."                                             │
│                                                                             │
│  GitRepos (with annotations):                                               │
│  └─ metadata.annotations:                                                   │
│      └─ io.rancher-desktop/managed-by: "fleet-gitops-base"                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Architecture Constraints

**Backend container limitations:**
- Cannot access `ddClient` SDK (frontend-only JavaScript library)
- Cannot directly run host binaries (`rdctl`, host `kubectl`)
- Runs inside Docker Desktop VM, isolated from host

**Frontend capabilities:**
- `ddClient.extension.host.cli.exec()` - run host binaries (rdctl, kubectl, helm)
- `ddClient.docker.listContainers()` - list running containers
- HTTP requests to backend on localhost:8080

**kubectl access options for backend:**
1. **Include kubectl in backend image** + mount kubeconfig volume
2. **Proxy through frontend** - backend calls frontend API, frontend runs kubectl
3. **Use Kubernetes client library** (e.g., `@kubernetes/client-node`) + mounted kubeconfig

**Recommended approach:** Include kubectl binary in backend image and mount kubeconfig from a volume. Frontend fetches kubeconfig on startup and stores it.

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

#### Race Condition Problem

When Rancher Desktop restarts, all extensions start roughly simultaneously. A non-owner extension might:
1. Start before the owner extension
2. Check if owner container is running → not yet running
3. Incorrectly take over ownership

**Solution:** Check configured extensions, not just running containers.

#### Startup Flow (Race-Condition Safe)

```
Frontend loads
    ↓
Call `rdctl extension ls` to get CONFIGURED extensions
    ↓
Send list to backend: POST /api/init { installedExtensions: [...] }
    ↓
Backend checks ownership ConfigMap
    ↓
┌─ No ConfigMap ─────────────────────────────────────┐
│   → Claim ownership                                │
└────────────────────────────────────────────────────┘
    ↓
┌─ ConfigMap exists ─────────────────────────────────┐
│   Is owner extension in configured list?           │
│   ↓                                                │
│   YES → Owner is installed, may just be starting   │
│         → Wait and retry (with backoff)            │
│         → After timeout, check if running          │
│         → If still not running, take over          │
│   ↓                                                │
│   NO → Owner extension was uninstalled             │
│        → Take over immediately                     │
└────────────────────────────────────────────────────┘
```

#### Detailed Ownership Rules

1. **On extension startup** (frontend sends init data to backend):
   - Frontend calls `rdctl extension ls` to get list of configured Fleet extensions
   - Frontend sends: own extension name, container ID, and installed extensions list
   - Backend reads ownership ConfigMap

2. **If no ConfigMap exists**:
   - Claim ownership immediately
   - Store: extension name, container ID, timestamp

3. **If ConfigMap exists and owner is THIS extension (same name)**:
   - Reclaim ownership (update container ID, timestamp)
   - This handles Rancher Desktop restarts gracefully

4. **If ConfigMap exists and owner is DIFFERENT extension**:
   - Check if owner extension is in the configured extensions list
   - If owner IS configured (installed): wait for it to start
     - Poll for owner container to become running (with timeout)
     - If owner starts → yield permanently
     - If timeout expires and owner still not running → take over
   - If owner is NOT configured (uninstalled): take over immediately

5. **On claiming ownership (takeover)**:
   - Update ConfigMap with own identity
   - Delete GitRepos with different owner annotation
   - Deploy own GitRepos with ownership annotation

#### ConfigMap Schema

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fleet-extension-ownership
  namespace: fleet-local
data:
  # Extension identification (survives restarts)
  ownerExtensionName: "fleet-gitops-custom-acme"

  # Container ID (changes on restart, used for liveness check)
  ownerContainerId: "abc123def456..."

  # When ownership was claimed
  claimedAt: "2025-12-01T10:00:00Z"

  # Optional: priority for conflict resolution
  # Higher priority extensions can take over from lower priority
  ownerPriority: "100"
```

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

  async getHealth(): Promise<{ status: string }>;
  async getIdentity(): Promise<{ containerId: string; extensionName: string }>;
  async initialize(data: InitData): Promise<OwnershipStatus>;
}

interface InitData {
  installedExtensions: ExtensionInfo[];  // From rdctl extension ls
  kubeconfig?: string;                    // For backend kubectl access
}

interface ExtensionInfo {
  name: string;           // Extension image name
  tag: string;            // Image tag
  labels: Record<string, string>;  // Image labels (for fleet.type detection)
}
```

#### 2.2 Frontend startup flow
```typescript
// On frontend load:
// 1. Get installed extensions via rdctl
const extensions = await getInstalledFleetExtensions();

// 2. Get kubeconfig for backend
const kubeconfig = await ddClient.extension.host.cli.exec('kubectl',
  ['config', 'view', '--raw', '--minify']);

// 3. Initialize backend with this data
const status = await backendService.initialize({
  installedExtensions: extensions,
  kubeconfig: kubeconfig.stdout
});

// 4. Display ownership status to user
```

#### 2.3 Helper: Get installed Fleet extensions
```typescript
async function getInstalledFleetExtensions(): Promise<ExtensionInfo[]> {
  // Run rdctl extension ls
  const result = await ddClient.extension.host.cli.exec('rdctl',
    ['extension', 'ls', '--output', 'json']);

  const allExtensions = JSON.parse(result.stdout);

  // Filter to only Fleet extensions (have the fleet.type label)
  return allExtensions.filter(ext =>
    ext.labels?.['io.rancher-desktop.fleet.type']
  );
}
```

#### 2.4 Add fallback for when backend unavailable
- Display warning if backend not reachable
- Frontend can still function in read-only mode (view GitRepos, but no ownership)

### Phase 3: Ownership Tracking

#### 3.1 ConfigMap management in backend
```typescript
// extension/backend/src/services/ownership.ts
export class OwnershipService {
  private kubectl: KubectlClient;
  private ownExtensionName: string;
  private ownContainerId: string;

  constructor() {
    this.ownContainerId = os.hostname(); // Container ID
    // Extension name from env var or image label
    this.ownExtensionName = process.env.EXTENSION_NAME || 'fleet-gitops';
  }

  async checkOwnership(installedExtensions: ExtensionInfo[]): Promise<OwnershipStatus>;
  async claimOwnership(): Promise<void>;
  async waitForOwner(ownerName: string, timeoutMs: number): Promise<boolean>;
}

interface OwnershipStatus {
  isOwner: boolean;
  currentOwner?: string;
  status: 'claimed' | 'yielded' | 'waiting' | 'taken-over';
  message: string;
}
```

#### 3.2 Ownership check algorithm (race-condition safe)
```typescript
async checkOwnership(installedExtensions: ExtensionInfo[]): Promise<OwnershipStatus> {
  const configMap = await this.kubectl.getConfigMap('fleet-extension-ownership');

  // Case 1: No ownership claimed yet
  if (!configMap) {
    await this.claimOwnership();
    return { isOwner: true, status: 'claimed', message: 'Claimed ownership' };
  }

  const ownerName = configMap.data.ownerExtensionName;

  // Case 2: We are the owner (same extension name, maybe different container ID after restart)
  if (ownerName === this.ownExtensionName) {
    await this.updateOwnership(); // Update container ID and timestamp
    return { isOwner: true, status: 'claimed', message: 'Reclaimed ownership after restart' };
  }

  // Case 3: Different owner - check if still installed
  const ownerInstalled = installedExtensions.some(ext => ext.name === ownerName);

  if (!ownerInstalled) {
    // Owner was uninstalled - take over immediately
    await this.claimOwnership();
    return { isOwner: true, status: 'taken-over', message: `Took over from uninstalled ${ownerName}` };
  }

  // Case 4: Owner is installed but may not be running yet (race condition)
  // Wait for owner to start
  const ownerStarted = await this.waitForOwner(ownerName, 30000); // 30 second timeout

  if (ownerStarted) {
    return { isOwner: false, currentOwner: ownerName, status: 'yielded', message: `${ownerName} is active` };
  }

  // Owner didn't start in time - something is wrong, take over
  await this.claimOwnership();
  return { isOwner: true, status: 'taken-over', message: `Took over from non-responsive ${ownerName}` };
}
```

#### 3.3 Check if owner container is running
```typescript
async waitForOwner(ownerName: string, timeoutMs: number): Promise<boolean> {
  const startTime = Date.now();
  let delay = 1000; // Start with 1 second

  while (Date.now() - startTime < timeoutMs) {
    // Check if owner's container is now running
    // This requires Docker socket access or frontend to poll
    const ownerRunning = await this.checkContainerRunning(ownerName);
    if (ownerRunning) return true;

    await sleep(delay);
    delay = Math.min(delay * 2, 5000); // Exponential backoff, max 5 seconds
  }

  return false;
}
```

#### 3.4 Docker socket for container checks
```yaml
# compose.yaml - mount Docker socket for container listing
services:
  backend:
    image: fleet-gitops:dev
    volumes:
      - /var/run/docker.sock.raw:/var/run/docker.sock
    # ...
```

```typescript
// Check if a container for the given extension is running
async checkContainerRunning(extensionName: string): Promise<boolean> {
  const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
  const containers = await docker.listContainers();

  return containers.some(c =>
    c.Labels?.['io.rancher-desktop.fleet.name'] === extensionName ||
    c.Image.includes(extensionName)
  );
}
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

1. **Priority vs. timestamp?** - If two extensions claim ownership simultaneously, which wins?
   - **Proposed:** Use priority field in ConfigMap. Custom extensions get higher priority than base.
   - Extensions can specify priority in their image labels
   - Fallback to first-come-first-served if same priority

2. **Graceful shutdown?** - Should extension release ownership when uninstalled?
   - **Proposed:** No explicit release. Other extensions check `rdctl extension ls` to detect uninstall.
   - Simpler implementation, handles crash scenarios automatically

3. **Startup wait timeout?** - How long to wait for owner extension to start?
   - **Proposed:** 30 seconds with exponential backoff polling
   - Configurable via environment variable

4. **What identifies a "Fleet extension"?**
   - **Proposed:** Image label `io.rancher-desktop.fleet.type` (values: "base", "custom")
   - Frontend filters `rdctl extension ls` output to only Fleet extensions

## Resolved Questions

1. ~~**kubectl access from backend?**~~
   - **Decision:** Include kubectl binary in backend image + mount kubeconfig
   - Frontend fetches kubeconfig on startup, stores in volume
   - Backend uses kubectl directly for Kubernetes operations

2. ~~**Race condition on restart?**~~
   - **Decision:** Frontend calls `rdctl extension ls` to get configured extensions
   - Only take over if owner extension is not in the configured list (was uninstalled)
   - If owner is configured but not running, wait with timeout before takeover

## Testing Plan

1. **Single extension** - Verify ownership claim works
2. **Two extensions** - Verify one yields to the other
3. **Restart Rancher Desktop** - Verify same extension reclaims ownership
4. **Uninstall owner** - Verify other extension takes over
5. **Race condition** - Start two extensions simultaneously
