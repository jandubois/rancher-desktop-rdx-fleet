# Next Steps - Fleet GitOps Extension

This document tracks the current development plan and priorities. **Read this first** when starting a new development session.

## Current Status

**Phase 1 (MVP)**: Complete
- Project setup, Fleet management, GitRepo management, status dashboard

**Phase 4 (Multi-Card Architecture)**: Mostly complete
- Manifest system, card registry, drag-and-drop, edit mode
- Card types implemented: `gitrepo`, `markdown`, `html`, `image`, `video`, `link`, `divider`, `placeholder`, `auth-github`, `auth-appco`
- Card types defined but not implemented: `auth-git`

---

## Architecture Overview

### Client-Server Model

The extension uses a **client-server architecture**:

- **Backend** (Node.js/Express): Runs in the Rancher Desktop VM, manages all Kubernetes resources (Fleet, GitRepos, Secrets) using `@kubernetes/client-node`. The backend is the single source of truth for cluster state.

- **Frontend** (React): User-facing UI that communicates with the backend via the Rancher Desktop extension SDK. Manages UI state only (card layout, edit mode, etc.).

### Path Discovery Architecture

Path discovery (finding `fleet.yaml` files in Git repositories) uses a **backend shallow clone approach**:

- **Backend clones repos**: Uses `git clone --depth 1` to perform shallow clones
- **Local file analysis**: Scans cloned repos for `fleet.yaml`/`fleet.yml` files
- **Provider agnostic**: Works with GitHub, GitLab, Bitbucket, or any Git server
- **Private repo support**: Uses credentials from Kubernetes Secrets

This approach eliminates GitHub API rate limits and enables support for any Git hosting provider.

### Data Storage

| Data Type | Storage Location | Notes |
|-----------|------------------|-------|
| GitRepo configs | Kubernetes CRDs | `fleet.cattle.io/v1alpha1` in `fleet-local` namespace |
| Git credentials | Docker credential helpers | Via `docker-credential-*` commands |
| UI state | Browser localStorage | Card order, manifest, edit mode state |

---

## Priority 1: Backend Path Discovery (Complete)

Move path discovery from frontend GitHub API calls to backend shallow clones.

### Completed

1. **Backend Git service** (`extension/backend/src/services/git.ts`)
   - `shallowClone(repoUrl, branch, credentials?)` - Clone to temp directory
   - `discoverPaths(request)` - Find fleet.yaml files recursively
   - `parseFleetYamlDeps(filePath)` - Extract dependsOn from fleet.yaml
   - `cleanup(cloneDir)` - Remove temp directory

2. **API endpoints** (`extension/backend/src/routes/git.ts`)
   - `POST /api/git/discover` - Discover paths in a repo
     - Request: `{ repo: string, branch?: string, credentials?: { username, password } }`
     - Response: `{ paths: PathInfo[], branch: string, cloneTimeMs: number, scanTimeMs: number }`
   - `GET /api/git/debug/logs` - Get service debug logs

3. **Frontend integration**
   - `usePathDiscovery` hook uses backend API via `backendService.discoverPaths()`
   - `GitHubService.fetchGitHubPaths()` still exists for backward compatibility
   - `computeBundleName` and `buildBundleInfo` utilities retained in GitHubService

4. **Container requirements**
   - Git binary added to Docker image (`apk add git`)

### Remaining

1. **Handle credentials for private repos**
   - Use credentials from Secrets service for authenticated clones
   - Support SSH keys and HTTPS tokens

### Benefits

- No GitHub API rate limits (60/hour unauthenticated, 5000/hour authenticated)
- Works with any Git provider (GitLab, Bitbucket, self-hosted)
- Better security (tokens stay on backend)
- Can cache clones for faster subsequent discoveries

---

## Priority 2: Dependency Awareness

Smart path handling to prevent user errors. See **[bundle-dependencies.md](reference/bundle-dependencies.md)** for full technical details.

### Completed

1. **Bundle name computation** - `computeBundleName()` in `GitHubService.ts`
2. **Bundle info building** - `buildBundleInfo()` associates paths with GitRepo names
3. **Dependency parsing** - `fetchFleetYamlDeps()` extracts `dependsOn` from fleet.yaml
4. **Dependency resolver hook** - `useDependencyResolver.ts` with bundle registry

### Remaining

1. **UI Integration** - Update path selection UI with dependency awareness
   - Block paths with external dependencies
   - Show dependencies on selection
   - Auto-select dependencies
   - Prevent deselection of required dependencies

2. **Visual indicators**:
   | State | Display |
   |-------|---------|
   | Normal | Standard checkbox |
   | Has dependencies | Shows dep count, expands on hover/select |
   | Auto-selected | Checked + "required by: X" label |
   | Blocked | Disabled + red warning icon |

---

## Priority 3: Authentication Cards

Essential for private Git repositories and enterprise use.

### Completed

1. **`auth-github` card** (`extension/ui/src/cards/AuthGitHubCard.tsx`)
   - GitHub Personal Access Token entry field
   - gh CLI integration for token retrieval
   - Rate limit display and status indicators
   - Secure credential storage via Docker credential helpers

2. **`auth-appco` card** (`extension/ui/src/cards/AuthAppCoCard.tsx`)
   - SUSE Application Collection authentication
   - Username/token authentication
   - Secure credential storage via Docker credential helpers

### Remaining

1. **Implement `auth-git` card** (`extension/ui/src/cards/AuthGitCard.tsx`)
   - Username/token authentication option
   - SSH key authentication option
   - Server URL field for self-hosted Git servers
   - Store credentials in Kubernetes Secret

---

## Priority 4: Testing

See **[TEST_FIXES.md](TEST_FIXES.md)** for detailed analysis and fix plan.

### Completed

1. **Frontend tests** - Comprehensive coverage (37 test files)
   - Hook tests: `usePathDiscovery`, `useGitRepoManagement`, `useDependencyResolver`, etc.
   - Service tests: `GitHubService`, `CredentialService`, `AppCoService`
   - Component tests: Cards, dialogs, drag-and-drop
   - E2E tests: Add repo, auth flows, edit mode

### Critical Issues (Backend Tests)

1. **Backend tests exist but don't test actual code** - Tests duplicate the implementation instead of importing and testing real functions. This means tests could pass even if features are broken.
   - `gitrepos.test.ts` - Re-implements `parseGitRepoItem`, `buildGitRepoSpec`, `isNotFoundError`
   - `git.test.ts` - Re-implements `extractDependsOn`, `buildAuthenticatedUrl`, and 5 other functions
   - `fleet.test.ts` - Re-implements `determineFleetStatus`, `extractVersionFromImage` (with different logic), and tests `getNextState` which doesn't exist

### Remaining

1. **Fix backend tests** - Rewrite to import and test actual functions
   - Export utility functions from service modules
   - Use `vi.mock()` for K8s client dependencies
   - Remove tests for non-existent functionality

2. **Add missing coverage**
   - Integration tests for K8s operations with mocked client
   - Error handling path tests

---

## Priority 5: Edit Mode Enhancements

- Global Config card (app name, description, colors, logo)
- Card settings panel for type-specific configuration
- Better "Add Card" type picker UI
- Logo/icon upload with drag & drop

---

## Priority 6: Extension Builder (Enterprise)

- Generate Dockerfile from current configuration
- Generate manifest.yaml from current state
- Bundle assets for download ("Download Build Files")
- Direct Docker build via ddClient API ("Build Extension Now")

---

## Priority 7: Fleet Auto-Install Robustness

Backend improvements for handling cluster lifecycle events.

### Completed

1. **Auto-install Fleet on backend startup**
   - Uses HelmChart CRDs (k3s Helm Controller)
   - No kubectl/helm CLI needed - uses `@kubernetes/client-node`
   - Kubeconfig loaded from VM mount (`/etc/rancher/k3s/k3s.yaml`)
   - Step-by-step progress reporting with job/pod status

### Remaining

1. **Periodic Fleet health check after installation**
   - Detect if Fleet controller crashes or becomes unhealthy
   - Update state to 'error' and notify frontend
   - Consider polling every 60 seconds when idle

2. **Detect cluster recreation and trigger Fleet reinstall**
   - Watch for kubeconfig file changes or cluster ID changes
   - Reset state and re-run installation when cluster is recreated
   - Handle case where backend container survives but cluster is new

3. **Handle kubeconfig changes (reload on auth errors)**
   - Re-read `/etc/rancher/k3s/k3s.yaml` when API calls fail with auth errors
   - Reinitialize Kubernetes clients with new credentials
   - Detect certificate/token expiry

---

## Key Files Reference

### Backend

| Purpose | File |
|---------|------|
| Express app & init | `extension/backend/src/index.ts` |
| GitRepo CRUD service | `extension/backend/src/services/gitrepos.ts` |
| Fleet installation | `extension/backend/src/services/fleet.ts` |
| Git path discovery | `extension/backend/src/services/git.ts` |
| Git discovery routes | `extension/backend/src/routes/git.ts` |

### Frontend - Core

| Purpose | File |
|---------|------|
| Main UI component | `extension/ui/src/App.tsx` |
| Shared types | `extension/ui/src/types.ts` |

### Frontend - Hooks (Business Logic)

| Purpose | File |
|---------|------|
| Fleet status & install | `extension/ui/src/hooks/useFleetStatus.ts` |
| GitRepo CRUD & polling | `extension/ui/src/hooks/useGitRepoManagement.ts` |
| Path discovery & caching | `extension/ui/src/hooks/usePathDiscovery.ts` |
| Dependency resolution | `extension/ui/src/hooks/useDependencyResolver.ts` |

### Frontend - Services

| Purpose | File |
|---------|------|
| Backend API client | `extension/ui/src/services/BackendService.ts` |
| GitHub API (to be deprecated) | `extension/ui/src/services/GitHubService.ts` |
| Docker credentials | `extension/ui/src/services/CredentialService.ts` |

### Frontend - Cards

| Purpose | File |
|---------|------|
| Card registry | `extension/ui/src/cards/registry.ts` |
| Card wrapper | `extension/ui/src/cards/CardWrapper.tsx` |

---

## Technical Decisions

| Topic | Decision |
|-------|----------|
| Kubernetes context | Always `rancher-desktop` |
| Fleet namespace | `fleet-local` |
| Credential storage | Docker credential helpers (via backend) |
| Path discovery | Backend shallow clone (provider agnostic) |
| Manifest parsing | Permissive (ignore unknown fields with warnings) |

---

## Documentation Structure

- `docs/NEXT_STEPS.md` - **You are here** - Development plan
- `docs/README.md` - Documentation index
- `docs/PRD.md` - Product requirements (features, UI mockups)
- `docs/reference/` - Technical reference docs
- `docs/background/` - External reference materials (wikis, etc.)
