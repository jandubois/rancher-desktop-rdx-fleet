# Next Steps - Fleet GitOps Extension

This document tracks the current development plan and priorities. **Read this first** when starting a new development session.

## Current Status

**Phase 1 (MVP)**: Complete
- Project setup, Fleet management, GitRepo management, status dashboard

**Phase 4 (Multi-Card Architecture)**: Mostly complete
- Manifest system, card registry, drag-and-drop, edit mode
- Card types implemented: `gitrepo`, `markdown`, `html`, `image`, `video`, `link`, `divider`, `placeholder`, `auth-github`, `auth-appco`
- Card types defined but not implemented: `auth-git`

> **For architecture details**, see [ARCHITECTURE.md](ARCHITECTURE.md) - covers system overview, frontend/backend structure, data flow, and key entry points.

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

## Technical Decisions

| Topic | Decision |
|-------|----------|
| Kubernetes context | Always `rancher-desktop` |
| Fleet namespace | `fleet-local` |
| Credential storage | Docker credential helpers (via backend) |
| Path discovery | Backend shallow clone (provider agnostic) |
| Manifest parsing | Permissive (ignore unknown fields with warnings) |

---

## Related Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture, frontend/backend structure, data flow
- [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md) - Known issues and refactoring recommendations
- [PRD.md](PRD.md) - Product requirements and feature specifications
