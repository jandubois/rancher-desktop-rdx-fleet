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

#### F5: AppCo Integration
- **F5.1**: Browse SUSE Application Collection catalog
- **F5.2**: One-click install of AppCo charts via Fleet
- **F5.3**: AppCo authentication (reuse from AppCo extension if installed)
- **F5.4**: Generate Fleet-compatible manifests for AppCo charts

#### F6: Advanced Configuration
- **F6.1**: Polling interval configuration
- **F6.2**: Pause/resume sync for specific repos
- **F6.3**: Force sync (ignore cache)
- **F6.4**: Namespace targeting preferences
- **F6.5**: Helm values override UI

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
├── backend/                # Express.js (optional, for complex operations)
│   ├── app.js
│   └── package.json
└── host/                   # Host binaries
    ├── darwin/
    │   └── kubectl
    ├── linux/
    │   └── kubectl
    └── windows/
        └── kubectl.exe
```

### Key Technical Decisions

#### 1. Fleet Installation Method
**Option A**: Helm install via kubectl (Recommended)
```typescript
await ddClient.extension.host?.cli.exec("kubectl", [
  "apply", "-f",
  "https://github.com/rancher/fleet/releases/download/v0.10.0/fleet-crd.yaml"
]);
await ddClient.extension.host?.cli.exec("kubectl", [
  "apply", "-f",
  "https://github.com/rancher/fleet/releases/download/v0.10.0/fleet.yaml"
]);
```

**Option B**: Bundle Fleet manifests in extension image
- Pro: Works offline
- Con: Larger image, version coupling

**Recommendation**: Option A with fallback to bundled manifests.

#### 2. Kubernetes Interaction
All K8s operations via `kubectl` host binary:
- Ships with extension (multi-arch)
- Uses Rancher Desktop's kubeconfig automatically
- Simpler than direct API client

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
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React UI      │────▶│  ddClient SDK   │────▶│  kubectl (host) │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │  Kubernetes API │
                                               └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┼────────────────────────────────┐
                        │                                │                                │
                        ▼                                ▼                                ▼
              ┌─────────────────┐            ┌─────────────────┐            ┌─────────────────┐
              │  Fleet CRDs     │            │ Fleet Controller │            │  Deployed Apps  │
              │  (GitRepo, etc) │            │  (watches CRs)   │            │  (from Git)     │
              └─────────────────┘            └─────────────────┘            └─────────────────┘
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

#### Milestone 1.1: Project Setup
- [ ] Initialize extension project structure
- [ ] Set up Dockerfile with multi-stage build
- [ ] Create metadata.json
- [ ] Set up React + Vite frontend
- [ ] Add kubectl binary fetching to build
- [ ] Basic "Hello World" extension working in Rancher Desktop

#### Milestone 1.2: Fleet Management
- [ ] Implement Fleet detection (check for CRDs/controller)
- [ ] Implement Fleet installation
- [ ] Display Fleet status in UI
- [ ] Handle Fleet not installed state

#### Milestone 1.3: GitRepo Management
- [ ] Create GitRepo form component
- [ ] Implement GitRepo CR creation via kubectl
- [ ] List existing GitRepos
- [ ] Delete GitRepo functionality
- [ ] Edit GitRepo functionality

#### Milestone 1.4: Status Dashboard
- [ ] Display GitRepo sync status
- [ ] Show Bundle list and status
- [ ] Basic error display
- [ ] Manual sync button

#### Milestone 1.5: Authentication
- [ ] Secret creation for Git credentials
- [ ] Username/token auth support
- [ ] SSH key auth support
- [ ] Secure credential handling

### Phase 2: Enhanced Features

#### Milestone 2.1: AppCo Integration
- [ ] AppCo catalog browsing
- [ ] Chart installation via Fleet
- [ ] Authentication integration

#### Milestone 2.2: Advanced UI
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

## Open Questions

1. **Offline Support**: Should we bundle Fleet manifests for air-gapped environments?
2. **Multi-cluster**: Should we support deploying to remote clusters (not just local)?
3. **Helm Values UI**: How sophisticated should the values editor be?
4. **AppCo Dependency**: Should AppCo integration require the AppCo extension, or be standalone?

---

## References

- [Extension Architecture](reference/extension-architecture.md)
- [Fleet Local Mode](reference/fleet-local-mode.md)
- [Helm Controller Integration](reference/helm-controller-integration.md)
- [AppCo Extension Wiki](background/wiki/rancherlabs/application-collection-extension/1-overview.md)
- [Fleet Wiki](background/wiki/rancher/fleet/1-overview.md)
