# Architectural Review - Fleet GitOps Extension

This document provides a comprehensive architectural review of both the frontend and backend components, identifying inconsistencies, areas for improvement, and refactoring recommendations.

## Executive Summary

The extension has a generally sound architecture with clear separation between:
- **Frontend (React)**: UI rendering, user interactions, manifest management
- **Backend (Express)**: Fleet management, Docker operations, ownership coordination
- **Host CLI**: Credential storage, Helm registry auth, kubectl/helm commands

However, there are several inconsistencies where Kubernetes operations are split between frontend (via kubectl CLI) and backend (via Kubernetes client library). This creates maintenance burden and potential for divergent behavior.

---

## Current Architecture Overview

### Frontend Services (`ui/src/services/`)

| Service | Purpose | Communication Method |
|---------|---------|---------------------|
| `BackendService` | Communicates with backend container | `ddClient.extension.vm.service` |
| `KubernetesService` | kubectl/helm operations | Host CLI via `ddClient.extension.host.cli.exec` |
| `CredentialService` | Credential helper operations | Host CLI scripts (`cred-store`, `cred-get`, etc.) |
| `GitHubService` | GitHub API for path discovery | Direct HTTP (fetch) |
| `AppCoService` | AppCo API validation | Direct HTTP (fetch) |

### Backend Services (`backend/src/services/`)

| Service | Purpose | Communication Method |
|---------|---------|---------------------|
| `FleetService` | Fleet installation/status | Kubernetes client library |
| `DockerService` | Container inspection | Dockerode via `/var/run/docker.sock` |
| `OwnershipService` | Fleet ownership ConfigMap | Kubernetes client library |
| `BuildService` | Custom extension image builds | Dockerode |

### Host CLI Scripts (`host/darwin|linux|windows/`)

| Script | Purpose | Must Be on Host? |
|--------|---------|------------------|
| `rd-exec` | Wrapper to use Rancher Desktop binaries | Yes - accesses `~/.rd/bin` |
| `cred-store`, `cred-get`, `cred-delete` | Credential helper operations | Yes - accesses host keychain |
| `cred-helper-check` | Check credential helper availability | Yes - accesses Docker config |
| `gh-auth-status`, `gh-token` | GitHub CLI integration | Yes - accesses host gh CLI |
| `helm-registry-login`, `helm-registry-logout` | Helm OCI registry auth | Yes - accesses host helm config |
| `kubectl-apply-json` | Apply Kubernetes resources | **Could move to backend** |

---

## Issue 1: Duplicate Fleet Status Checking (Major)

### Current State

Fleet status is checked in **two places** with different implementations:

1. **Backend** (`backend/src/services/fleet.ts`):
   - Uses `@kubernetes/client-node` library
   - Checks CRD existence via `CustomObjectsApi`
   - Checks deployment status via `AppsV1Api`
   - Is the source of truth for installation progress

2. **Frontend** (`ui/src/services/KubernetesService.ts`):
   - Uses kubectl CLI via host execution
   - Checks CRD with `kubectl get crd gitrepos.fleet.cattle.io`
   - Checks pod with `kubectl get pods -l app=fleet-controller`
   - Used as fallback when backend is unavailable

3. **Hook** (`ui/src/hooks/useFleetStatus.ts`):
   - Tries backend first (`backendService.getFleetState()`)
   - Falls back to frontend kubectl check

### Problems

- **Maintenance burden**: Two implementations to maintain
- **Potential divergence**: Different error handling, different status interpretations
- **Unnecessary complexity**: Frontend fallback rarely needed

### Recommendation

**Remove the kubectl-based Fleet status checks from the frontend.** The backend is always running when the extension UI is visible, so the fallback is unnecessary.

**Files to modify:**
- `ui/src/services/KubernetesService.ts`: Remove `checkFleetCrdExists`, `checkFleetPodRunning`, `checkFleetStatus`, `getFleetVersion`
- `ui/src/hooks/useFleetStatus.ts`: Remove kubectl fallback logic

---

## Issue 2: GitRepo Operations on Frontend (Major)

### Current State

GitRepo CRUD operations are in `KubernetesService.ts` and execute via kubectl CLI:

```typescript
// Current flow (frontend → host kubectl → K8s API)
await executor.rdExec('kubectl', ['get', 'gitrepos', '-n', FLEET_NAMESPACE, '-o', 'json']);
await executor.exec('kubectl-apply-json', [jsonStr, '--context', KUBE_CONTEXT]);
await executor.rdExec('kubectl', ['delete', 'gitrepo', name, '-n', FLEET_NAMESPACE]);
```

### Problems

- **Inconsistency**: Backend uses Kubernetes client library; frontend uses kubectl CLI
- **Round-trip overhead**: Frontend → Host → kubectl → K8s API (vs Backend → K8s API)
- **Error handling**: Different error formats between kubectl and backend

### Recommendation

**Move GitRepo operations to the backend.** Add new routes:

```typescript
// backend/src/routes/gitrepos.ts
GET  /api/gitrepos           // List all GitRepos
POST /api/gitrepos           // Create or update a GitRepo
DELETE /api/gitrepos/:name   // Delete a GitRepo
```

**Implementation approach:**
1. Create `backend/src/services/gitrepos.ts` using Kubernetes client library
2. Create `backend/src/routes/gitrepos.ts` with the API endpoints
3. Update `BackendService.ts` with `fetchGitRepos()`, `applyGitRepo()`, `deleteGitRepo()` methods
4. Update hooks to use backend service instead of KubernetesService

**Files to create:**
- `backend/src/services/gitrepos.ts`
- `backend/src/routes/gitrepos.ts`

**Files to modify:**
- `backend/src/index.ts`: Add gitrepo routes
- `ui/src/services/BackendService.ts`: Add GitRepo methods
- `ui/src/hooks/useGitRepoManagement.ts`: Use BackendService
- `ui/src/services/KubernetesService.ts`: Remove GitRepo methods (eventually)

---

## Issue 3: Registry Secret Creation on Frontend (Moderate)

### Current State

`KubernetesService.createRegistrySecret()` creates Kubernetes secrets via kubectl:

```typescript
// Current: Frontend executes kubectl apply
await this.executor.exec('kubectl-apply-json', [jsonStr, '--context', KUBE_CONTEXT]);
```

This is called from `useAppCoAuth.ts` to create imagePullSecrets.

### Problems

- **Inconsistency**: Backend has Kubernetes client access but secrets are created via kubectl
- **Coupling**: Auth card hook directly calls KubernetesService

### Recommendation

**Move registry secret operations to the backend:**

```typescript
// backend/src/routes/secrets.ts
POST /api/secrets/registry    // Create registry pull secret
DELETE /api/secrets/registry/:name  // Delete registry secret
GET /api/secrets/registry/:name     // Check if secret exists
```

**Files to create:**
- `backend/src/services/secrets.ts`
- `backend/src/routes/secrets.ts`

**Files to modify:**
- `ui/src/services/BackendService.ts`: Add secret methods
- `ui/src/cards/AuthAppCoCard/useAppCoAuth.ts`: Use BackendService for secrets
- `ui/src/services/KubernetesService.ts`: Remove secret methods (eventually)

---

## Issue 4: Unused Frontend Fleet Installation Code (Minor)

### Current State

`KubernetesService.installFleet()` exists but is never called because:
- Backend auto-installs Fleet in `fleetService.ensureFleetInstalled()`
- Installation is triggered from `/api/init` route

```typescript
// ui/src/services/KubernetesService.ts - UNUSED
async installFleet(): Promise<void> {
  await this.executor.rdExec('helm', ['repo', 'add', 'fleet', '...']);
  await this.executor.rdExec('helm', ['install', 'fleet-crd', '...']);
  await this.executor.rdExec('helm', ['install', 'fleet', '...']);
}
```

### Recommendation

**Remove the unused method** to avoid confusion and maintenance burden.

**Files to modify:**
- `ui/src/services/KubernetesService.ts`: Remove `installFleet()` method

---

## Issue 5: Kubeconfig Path Written but Unused (Minor)

### Current State

In `backend/src/routes/init.ts`:

```typescript
export const SHARED_KUBECONFIG_PATH = '/tmp/kubeconfig-patched';
// ...
fs.writeFileSync(SHARED_KUBECONFIG_PATH, patchedKubeconfig);
log(`Wrote patched kubeconfig to ${SHARED_KUBECONFIG_PATH}`);
```

This file is written but never read. The `FleetService` is initialized with the kubeconfig string directly, not from the file.

### Recommendation

**Remove the file write** unless there's a planned use case (e.g., for kubectl CLI fallback within the container).

**Files to modify:**
- `backend/src/routes/init.ts`: Remove `SHARED_KUBECONFIG_PATH` and file write

---

## Items That Must Remain on Host

These operations **cannot** move to the backend because they require host filesystem access:

### 1. Credential Helper Operations
The `cred-store`, `cred-get`, `cred-delete` scripts access:
- `~/.docker/config.json` for credential helper configuration
- Host keychain (macOS Keychain, Windows Credential Manager, Linux secret-service)
- Docker credential helpers (`docker-credential-osxkeychain`, etc.)

### 2. GitHub CLI Integration
The `gh-auth-status` and `gh-token` scripts access:
- Host-installed `gh` CLI binary
- `~/.config/gh/hosts.yml` for authentication state
- macOS Keychain for token storage

### 3. Helm Registry Login/Logout
The `helm-registry-login` script accesses:
- Host-installed `helm` binary
- `~/.config/helm/registry/config.json` for registry credentials
- This enables `helm pull oci://...` on the host

### 4. rd-exec Wrapper
Required to find Rancher Desktop binaries in `~/.rd/bin/` which may not be in the default PATH.

---

## Items Correctly Placed

### Frontend: GitHub Path Discovery
`GitHubService.fetchGitHubPaths()` is correctly on the frontend because:
- Uses direct HTTP to GitHub API (no Docker/K8s access needed)
- Uses GitHub credentials from host credential helper
- No backend access required

### Frontend: AppCo Credential Validation
`AppCoService.validateCredentials()` is correctly on the frontend because:
- Uses direct HTTP to AppCo API
- Validates credentials before storing
- No backend access required

### Backend: Docker Image Building
`BuildService.buildImage()` is correctly on the backend because:
- Needs access to Docker socket
- Creates tar archives and streams to Docker API
- Would be complex to implement via host CLI

### Backend: Fleet Installation
`FleetService.installFleet()` is correctly on the backend because:
- Uses HelmChart CRDs (not helm CLI)
- Can monitor installation progress
- Automatic retry with exponential backoff

---

## Refactoring Recommendations

### Priority 1: Consolidate GitRepo Operations
Move all GitRepo CRUD to backend. This is the largest source of inconsistency.

**Effort**: Medium (new backend service + route, update frontend)
**Impact**: High (reduces CLI calls, simplifies frontend)

### Priority 2: Consolidate Secret Operations
Move registry secret creation to backend.

**Effort**: Low (small backend service + route)
**Impact**: Medium (consistency)

### Priority 3: Remove Unused Code
Remove `KubernetesService.installFleet()` and kubectl fallback in `useFleetStatus`.

**Effort**: Low
**Impact**: Low (code cleanliness)

### Priority 4: Type Sharing
Consider creating a shared types package for types used by both frontend and backend:
- `FleetState`
- `GitRepo`
- `OwnershipStatus`
- API request/response types

**Effort**: Medium
**Impact**: Medium (reduces duplication, ensures consistency)

### Priority 5: Backend API Documentation
Consider adding OpenAPI documentation for the backend routes. This would:
- Document the API contract
- Enable client generation
- Improve developer experience

**Effort**: Medium
**Impact**: Medium (documentation, type safety)

---

## Summary of Recommended Changes

| Change | Priority | Effort | Files Affected |
|--------|----------|--------|----------------|
| Move GitRepo CRUD to backend | 1 | Medium | 6-8 files |
| Move registry secrets to backend | 2 | Low | 4-5 files |
| Remove unused Fleet install code | 3 | Low | 1-2 files |
| Remove kubectl Fleet status fallback | 3 | Low | 2 files |
| Remove unused kubeconfig file write | 4 | Low | 1 file |
| Create shared types package | 5 | Medium | Multiple |
| Add OpenAPI documentation | 5 | Medium | New files |

---

## Appendix: Current Operation Distribution

### Operations via Backend (Kubernetes Client Library)
- Fleet CRD check
- Fleet deployment status
- Fleet installation (HelmChart CRDs)
- Fleet namespace creation
- Ownership ConfigMap management
- Docker container inspection
- Docker image building

### Operations via Frontend → Host CLI → kubectl
- GitRepo list/create/update/delete
- Registry secret creation
- Fleet status fallback (should be removed)

### Operations via Frontend → Host CLI (Non-kubectl)
- Credential store/get/delete
- GitHub CLI auth status/token
- Helm registry login/logout
- rdctl extension ls

### Operations via Frontend → Direct HTTP
- GitHub API (path discovery)
- AppCo API (credential validation)
