# Fleet Extension for Rancher Desktop
## Product Requirements Document

### Executive Summary

The Fleet extension for Rancher Desktop enables enterprise teams to automatically provision developer environments using GitOps workflows. Developers simply install the extension and point it at their organization's configuration repository - Fleet handles the rest, automatically deploying tools, policies, and applications to their local Kubernetes cluster.

**Key Value Proposition**: Zero-touch developer onboarding with organizational compliance built-in.

---

## Problem Statement

### Current Pain Points

1. **Manual Developer Setup**: New developers spend hours/days configuring their local Kubernetes environments
2. **Configuration Drift**: Each developer's environment diverges over time, causing "works on my machine" issues
3. **Security/Compliance Gaps**: Hard to ensure all developers have required security policies and approved tooling
4. **No Central Management**: IT/Platform teams can't push updates to developer environments

### Why Fleet?

Fleet provides a **pull-based GitOps model** that solves these problems:
- Developers don't register their clusters with a central server (privacy-preserving)
- Configuration is pulled from Git, providing audit trails and version control
- Updates propagate automatically when the Git repo changes
- Works entirely locally - no external dependencies after initial setup

---

## User Personas

### 1. Platform Engineer (Configuration Author)
- Creates and maintains the Fleet configuration repository
- Defines standard tooling, namespaces, network policies, observability stack
- Wants to ensure all developers have consistent, compliant environments

### 2. Developer (End User)
- Installs Rancher Desktop and the Fleet extension
- Points extension at organization's config repo (or uses built-in default)
- Expects everything to "just work" without deep Kubernetes knowledge

### 3. Enterprise Admin
- Wants to create custom extension builds with pre-configured repos
- Needs visibility into what's being deployed
- May want to restrict which repos can be used

---

## Feature Requirements

### MVP (Phase 1)

#### F1: Fleet Installation & Management
- **F1.1**: Auto-detect if Fleet is installed on the cluster
- **F1.2**: One-click Fleet installation (CRDs + controller)
- **F1.3**: Display Fleet controller status (running/error/not installed)
- **F1.4**: Fleet version display and upgrade capability

#### F2: Git Repository Configuration
- **F2.1**: Add a Git repository URL (GitHub, GitLab, Bitbucket, etc.)
- **F2.2**: Configure branch/tag/commit to track
- **F2.3**: Specify paths within repo to deploy
- **F2.4**: Support for public repositories (no auth)
- **F2.5**: Support for private repositories (username/token or SSH key)
- **F2.6**: Edit/update existing repository configurations
- **F2.7**: Remove repository configurations

#### F3: Deployment Status Dashboard
- **F3.1**: List all configured GitRepos with sync status
- **F3.2**: Show current commit SHA being deployed
- **F3.3**: Display Bundle count and status (ready/pending/error)
- **F3.4**: Show deployed resources per Bundle
- **F3.5**: Error messages and troubleshooting hints
- **F3.6**: Manual sync/refresh button

#### F4: Basic UI
- **F4.1**: Clean, simple interface following Rancher design patterns
- **F4.2**: Status indicators (icons/colors for health states)
- **F4.3**: Loading states and progress indicators
- **F4.4**: Error handling with actionable messages

### Phase 2: Enhanced Features

#### F5: AppCo Integration (Standalone)
- **F5.1**: Browse SUSE Application Collection catalog directly (no AppCo extension required)
- **F5.2**: One-click install of AppCo charts via Fleet
- **F5.3**: AppCo authentication within this extension
- **F5.4**: Generate Fleet-compatible manifests for AppCo charts

#### F6: Advanced Configuration
- **F6.1**: Polling interval configuration
- **F6.2**: Pause/resume sync for specific repos
- **F6.3**: Force sync (ignore cache)
- **F6.4**: Namespace targeting preferences
- **F6.5**: Simple Helm values override (text-based, expand later)

#### F7: Enterprise Features
- **F7.1**: Pre-configured repository URL (build-time configuration)
- **F7.2**: Locked configuration (prevent user changes)
- **F7.3**: Multiple repo support with priorities
- **F7.4**: Audit log of deployments

### Phase 3: Advanced Operations

#### F8: Drift Detection & Remediation
- **F8.1**: Show resources that have drifted from Git state
- **F8.2**: One-click remediation to restore Git state
- **F8.3**: Diff view of changes

#### F9: Rollback & History
- **F9.1**: View deployment history
- **F9.2**: Rollback to previous commit
- **F9.3**: Pin to specific version

---

## Technical Architecture

### Extension Structure

```
fleet-extension/
├── Dockerfile              # Multi-stage build
├── metadata.json           # Extension metadata
├── ui/                     # React frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── FleetStatus.tsx
│   │   │   ├── GitRepoList.tsx
│   │   │   ├── GitRepoForm.tsx
│   │   │   ├── BundleStatus.tsx
│   │   │   └── Settings.tsx
│   │   ├── hooks/
│   │   │   ├── useFleet.ts
│   │   │   └── useKubectl.ts
│   │   └── lib/
│   │       └── ddClient.ts
│   ├── package.json
│   └── vite.config.ts
└── backend/                # Express.js (optional, for complex operations)
    ├── app.js
    └── package.json
```

**Note**: Rancher Desktop already bundles `kubectl`, `helm`, and `docker` binaries. We use these directly via the Docker Desktop Client SDK - no need to ship our own binaries.

### Key Technical Decisions

#### 1. Fleet Installation Method
Install Fleet using `helm` (provided by Rancher Desktop):
```typescript
// Install Fleet CRDs and controller via Helm
await ddClient.extension.host?.cli.exec("helm", [
  "repo", "add", "fleet", "https://rancher.github.io/fleet-helm-charts/"
]);
await ddClient.extension.host?.cli.exec("helm", [
  "install", "--create-namespace", "-n", "cattle-fleet-system",
  "fleet-crd", "fleet/fleet-crd", "--wait"
]);
await ddClient.extension.host?.cli.exec("helm", [
  "install", "--create-namespace", "-n", "cattle-fleet-system",
  "fleet", "fleet/fleet", "--wait"
]);
```

#### 2. Kubernetes Interaction
All K8s operations via Rancher Desktop's bundled CLI tools:
- `kubectl` for resource management (get, apply, delete)
- `helm` for Fleet installation
- Uses Rancher Desktop's kubeconfig automatically via `--context rancher-desktop`

#### 3. State Management
- GitRepo CRs are the source of truth
- UI reads state via `kubectl get gitrepos -n fleet-local`
- No local database needed

#### 4. Authentication Storage
- Store Git credentials in Kubernetes Secrets
- Reference secrets in GitRepo CR
- Never store credentials in extension storage

### API Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────────────┐
│   React UI      │────▶│  ddClient SDK   │────▶│  kubectl / helm (RD host)   │
└─────────────────┘     └─────────────────┘     └──────────────┬──────────────┘
                                                               │
                                                               ▼
                                                     ┌─────────────────┐
                                                     │  Kubernetes API │
                                                     └────────┬────────┘
                                                               │
                        ┌──────────────────────────────────────┼──────────────────────────────────────┐
                        │                                      │                                      │
                        ▼                                      ▼                                      ▼
              ┌─────────────────┐                  ┌─────────────────┐                  ┌─────────────────┐
              │  Fleet CRDs     │                  │ Fleet Controller │                  │  Deployed Apps  │
              │  (GitRepo, etc) │                  │  (watches CRs)   │                  │  (from Git)     │
              └─────────────────┘                  └─────────────────┘                  └─────────────────┘
```

---

## User Interface Design

### Main Screen Layout

```
┌────────────────────────────────────────────────────────────────┐
│  Fleet GitOps                                    [Settings] ⚙️  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Fleet Status: ● Running (v0.10.0)         [Upgrade Available] │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Git Repositories                              [+ Add Repo]    │
│  ─────────────────────────────────────────────────────────    │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ ● acme-corp/developer-baseline          main    ↻ 2m ago │ │
│  │   Commit: abc123d • 3 Bundles ready                  [⋮] │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ ○ team-platform/observability-stack     v2.1    ⚠ Error  │ │
│  │   Failed to fetch: authentication required           [⋮] │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Recent Activity                                               │
│  • nginx deployed to default namespace (2 min ago)            │
│  • prometheus-stack upgraded to v45.0.0 (1 hour ago)          │
│  • network-policies applied (1 hour ago)                      │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Add Repository Dialog

```
┌────────────────────────────────────────────────────────────────┐
│  Add Git Repository                                      [X]   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Repository URL *                                              │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ https://github.com/acme-corp/fleet-config               │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Branch / Tag / Commit                                         │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ main                                                     │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Paths (comma-separated, default: /)                           │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ /apps, /infrastructure                                   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ▼ Authentication (optional)                                   │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ ○ None (public repo)                                     │ │
│  │ ○ Username / Token                                       │ │
│  │ ○ SSH Key                                                │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│                                    [Cancel]  [Add Repository]  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Bundle Details View

```
┌────────────────────────────────────────────────────────────────┐
│  ← Back    acme-corp/developer-baseline                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Status: ● Synced                           [Sync Now] [Pause] │
│  Commit: abc123def456789...                                    │
│  Last Sync: 2 minutes ago                                      │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Bundles (3)                                                   │
│  ─────────────────────────────────────────────────────────    │
│                                                                │
│  ● common-tools          Ready    12 resources                 │
│  ● observability         Ready    45 resources                 │
│  ● network-policies      Ready     8 resources                 │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Deployed Resources                                            │
│  ─────────────────────────────────────────────────────────    │
│                                                                │
│  Namespace: monitoring                                         │
│    ● Deployment/prometheus        Running (1/1)                │
│    ● Deployment/grafana           Running (1/1)                │
│    ● Service/prometheus           ClusterIP                    │
│    ● ConfigMap/grafana-dashboards Created                      │
│                                                                │
│  Namespace: default                                            │
│    ● NetworkPolicy/deny-all       Applied                      │
│    ● NetworkPolicy/allow-dns      Applied                      │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: MVP (Core Functionality)

#### Milestone 1.1: Project Setup ✅ COMPLETE
- [x] Initialize extension project structure
- [x] Set up Dockerfile with multi-stage build
- [x] Create metadata.json
- [x] Set up React + Vite frontend
- [x] Basic "Hello World" extension working in Rancher Desktop

#### Milestone 1.2: Fleet Management ✅ COMPLETE
- [x] Implement Fleet detection (check for CRDs/controller)
- [x] Implement Fleet installation via Helm
- [x] Display Fleet status in UI (with version)
- [x] Handle Fleet not installed state

#### Milestone 1.3: GitRepo Management ✅ COMPLETE
- [x] Create GitRepo form component with path discovery
- [x] Implement GitRepo CR creation via kubectl
- [x] List existing GitRepos as cards
- [x] Delete GitRepo functionality
- [x] Edit GitRepo paths via toggle checkboxes (auto-update on change)

#### Milestone 1.4: Status Dashboard ✅ COMPLETE
- [x] Display GitRepo sync status (Ready, Syncing, Error states)
- [x] Show deployed resources per GitRepo
- [x] Error display with full message
- [x] Auto-refresh while syncing (5s interval)
- [x] Manual refresh button

#### Milestone 1.5: Authentication
- [ ] Secret creation for Git credentials
- [ ] Username/token auth support
- [ ] SSH key auth support
- [ ] Secure credential handling

### Phase 2: Enhanced Features

#### Milestone 2.1: Dependency Awareness
- [ ] Fetch and parse fleet.yaml for each discovered path
- [ ] Extract `dependsOn` declarations from fleet.yaml
- [ ] Show dependency info in UI (e.g., "depends on: monitoring-crds")
- [ ] Grey out / disable paths with unresolved dependencies
- [ ] Auto-select in-repo dependencies when enabling a path
- [ ] Warn about external dependencies (CRDs from other charts)

#### Milestone 2.2: AppCo Integration
- [ ] AppCo catalog browsing
- [ ] Chart installation via Fleet
- [ ] Authentication integration

#### Milestone 2.3: Advanced UI
- [ ] Polling interval configuration
- [ ] Pause/resume functionality
- [ ] Resource details view
- [ ] Improved error handling

### Phase 3: Enterprise Features

#### Milestone 3.1: Customization
- [ ] Build-time configuration support
- [ ] Locked repo configuration
- [ ] Multi-repo support

---

## Success Metrics

### MVP Success Criteria
1. Extension installs successfully in Rancher Desktop
2. Fleet can be installed with one click
3. User can add a public Git repo and see deployments
4. Status accurately reflects Fleet state
5. Errors are clearly communicated

### Key Performance Indicators
- Time to first deployment: < 5 minutes from extension install
- UI responsiveness: < 500ms for status updates
- Error rate: < 1% false positives on status

---

## Design Decisions (Resolved)

The following questions have been resolved:

| Question | Decision |
|----------|----------|
| **Host Binaries** | Use wrapper scripts in `host/` that delegate to `~/.rd/bin/kubectl` and `~/.rd/bin/helm`. RD extension SDK expects binaries at specific paths, but we use RD's bundled tools. |
| **kubectl apply stdin** | RD SDK doesn't support stdin for exec(). Workaround: `--apply-json` flag handled by kubectl wrapper script that pipes JSON to `kubectl apply -f -` |
| **Binary extraction limit** | RD only extracts first 2 binaries from extension. Workaround: embed extra functionality in existing wrapper scripts |
| **Offline Support** | Not a priority for MVP - can revisit later |
| **Multi-cluster** | Focus on local cluster only (fleet-local namespace) - not needed initially |
| **AppCo Dependency** | Standalone - integrate AppCo directly without requiring AppCo extension |
| **Helm Values UI** | Keep simple initially (text-based YAML), expand sophistication later |
| **Fleet Version** | Use latest Fleet version at build time; Fleet updates only occur via extension updates |
| **Error Recovery** | Simple error display with retry button; no complex recovery flows for MVP |
| **Path Discovery** | Use GitHub API to find `fleet.yaml` files. Cache paths per repo URL to avoid repeated API calls. |
| **UI Updates** | Only update UI when data changes (JSON comparison) to prevent scroll reset during auto-refresh |

## Implementation Notes

### Actual Architecture (as built)

The extension uses a simpler architecture than originally planned:

```
extension/
├── Dockerfile              # Multi-stage build
├── metadata.json           # Extension metadata with host binaries config
├── host/                   # Wrapper scripts for kubectl/helm
│   ├── darwin/
│   │   ├── kubectl         # Delegates to ~/.rd/bin/kubectl, handles --apply-json
│   │   └── helm            # Delegates to ~/.rd/bin/helm
│   ├── linux/
│   │   ├── kubectl
│   │   └── helm
│   └── windows/
│       ├── kubectl.cmd
│       └── helm.cmd
└── ui/                     # React frontend (single App.tsx component)
    ├── src/
    │   ├── App.tsx         # Main component with all functionality
    │   └── lib/
    │       └── ddClient.ts # Docker Desktop client SDK wrapper
    ├── package.json
    └── vite.config.ts
```

**Key simplifications from original plan:**
- No separate components - single `App.tsx` handles everything
- No backend service needed - all operations via kubectl/helm CLI
- Card-based UI instead of table for GitRepos
- Inline path editing via checkboxes instead of separate edit dialog
- Auto-discovery of available paths from GitHub repos

## Open Questions

1. **Credential Management**: How should we handle credentials for AppCo, GitHub, and internal Git repos in a unified way? (To be addressed in Phase 2)

---

## Testing Configuration

For development and testing, use the official Fleet examples repository:

```yaml
apiVersion: fleet.cattle.io/v1alpha1
kind: GitRepo
metadata:
  name: sample
  namespace: fleet-local
spec:
  repo: "https://github.com/rancher/fleet-examples"
  paths:
  - simple
```

This repository contains various example configurations:
- `simple/` - Basic deployment manifests
- `helm/` - Helm chart examples
- `kustomize/` - Kustomize configurations
- `multi-cluster/` - Multi-cluster examples (not needed for MVP)

### Test Scenarios

1. **Fleet Installation**: Verify one-click Fleet installation works
2. **Public Repo**: Add the fleet-examples repo and verify sync
3. **Bundle Status**: Confirm bundles show as ready after sync
4. **Resource Display**: Verify deployed resources are shown correctly
5. **Error Handling**: Test with invalid repo URL to verify error display and retry

---

## References

- [Extension Architecture](reference/extension-architecture.md)
- [Fleet Local Mode](reference/fleet-local-mode.md)
- [Helm Controller Integration](reference/helm-controller-integration.md)
- [AppCo Extension Wiki](background/wiki/rancherlabs/application-collection-extension/1-overview.md)
- [Fleet Wiki](background/wiki/rancher/fleet/1-overview.md)
