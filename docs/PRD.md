# Fleet Extension for Rancher Desktop
## Product Requirements Document

### Executive Summary

The Fleet extension for Rancher Desktop enables enterprise teams to automatically provision developer environments using GitOps workflows. Developers simply install the extension and point it at their organization's configuration repository - Fleet handles the rest, automatically deploying tools, policies, and applications to their local Kubernetes cluster.

**Key Value Proposition**: Zero-touch developer onboarding with organizational compliance built-in.

> **For architecture and implementation details**, see [ARCHITECTURE.md](ARCHITECTURE.md).
> **For current development priorities**, see [NEXT_STEPS.md](NEXT_STEPS.md).

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

### Phase 1: Core Functionality (Complete)

#### F1: Fleet Installation & Management
- **F1.1**: Auto-detect if Fleet is installed on the cluster
- **F1.2**: One-click Fleet installation (CRDs + controller)
- **F1.3**: Display Fleet controller status (running/error/not installed)
- **F1.4**: Fleet version display

#### F2: Git Repository Configuration
- **F2.1**: Add a Git repository URL (GitHub, GitLab, Bitbucket, etc.)
- **F2.2**: Configure branch/tag/commit to track
- **F2.3**: Specify paths within repo to deploy
- **F2.4**: Support for public repositories (no auth)
- **F2.5**: Support for private repositories (username/token)
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
- **F5.1**: SUSE Application Collection authentication
- **F5.2**: One-click install of AppCo charts via Fleet

#### F6: Advanced Configuration
- **F6.1**: Polling interval configuration
- **F6.2**: Pause/resume sync for specific repos
- **F6.3**: Force sync (ignore cache)
- **F6.4**: Namespace targeting preferences

### Phase 3: Multi-Card Architecture (Partial)

#### F7: Manifest-Driven Configuration
- **F7.1**: Load extension configuration from manifest.yaml
- **F7.2**: Support app-level settings (name, description, icon)
- **F7.3**: Support branding customization (colors, logo)
- **F7.4**: Support layout settings (show/hide Fleet status)
- **F7.5**: Fall back to default manifest when none provided

#### F8: Card Type System
- **F8.1**: Card registry with pluggable card types
- **F8.2**: `gitrepo` card - Fleet GitRepo configuration
- **F8.3**: `auth-github` card - GitHub PAT authentication
- **F8.4**: `auth-appco` card - SUSE Application Collection credentials
- **F8.5**: `markdown` card - Markdown/HTML content
- **F8.6**: `image` card - Static image display
- **F8.7**: `video` card - Embedded video content
- **F8.8**: `link` card - Link collections
- **F8.9**: `divider` card - Visual separators

#### F9: Card Behaviors
- **F9.1**: Card ordering via drag-and-drop
- **F9.2**: Card visibility toggle (show/hide)
- **F9.3**: Duplicatable cards with "Add Another" button
- **F9.4**: Field-level locking (prevent user edits)
- **F9.5**: Field-level defaults (pre-filled values)
- **F9.6**: Path whitelisting for gitrepo cards

### Phase 4: Enterprise Customization

#### F10: Edit Mode & Extension Builder
- **F10.1**: Edit mode toggle in header
- **F10.2**: Global config card for app name, colors, logo upload
- **F10.3**: Card controls: drag reorder, settings panel, delete, visibility
- **F10.4**: Add card button with card type picker
- **F10.5**: Download build files (Dockerfile + manifest.yaml + assets)
- **F10.6**: Build extension directly via Docker API

#### F11: Enterprise Distribution
- **F11.1**: Simple Dockerfile FROM pattern for customization
- **F11.2**: Manifest replacement via COPY
- **F11.3**: Branding asset override

### Phase 5: Advanced Operations (Future)

#### F12: Drift Detection & Remediation
- **F12.1**: Show resources that have drifted from Git state
- **F12.2**: One-click remediation to restore Git state
- **F12.3**: Diff view of changes

#### F13: Rollback & History
- **F13.1**: View deployment history
- **F13.2**: Rollback to previous commit
- **F13.3**: Pin to specific version

---

## User Interface Design

### Main Screen Layout

```
┌────────────────────────────────────────────────────────────────┐
│  Fleet GitOps                                    [Settings]    │
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
└────────────────────────────────────────────────────────────────┘
```

### Add Repository Flow

1. User clicks "Add Repository"
2. Modal opens with URL and branch fields
3. Path discovery runs automatically after URL entry
4. Available paths shown as checkboxes
5. User selects paths and confirms
6. GitRepo CR created, sync begins

### GitRepo Card UX

1. Card shows repo URL with sync status
2. Loading indicator during path discovery
3. Checkboxes for each discovered path
4. Path changes auto-save to GitRepo CR
5. Status indicators (Ready, Syncing, Error)

---

## Enterprise Customization

Organizations can create custom extension builds:

```dockerfile
# Acme Corp custom Fleet extension
FROM ghcr.io/rancher/fleet-extension:latest

# Replace manifest with corporate configuration
COPY manifest.yaml /ui/manifest.yaml

# Add corporate branding assets
COPY assets/ /ui/assets/
```

Example locked-down manifest:
```yaml
version: "1.0"

app:
  name: "Acme Developer Setup"
  icon: "/assets/acme-icon.svg"

layout:
  show_fleet_status: true
  edit_mode: false  # Disable edit mode for enterprise builds

cards:
  - id: welcome
    type: markdown
    settings:
      content: |
        ## Welcome to Acme Developer Setup
        Contact #platform-support on Slack for help.

  - id: corp-baseline
    type: gitrepo
    settings:
      duplicatable: false
      repo_url:
        default: "https://gitlab.acme.corp/platform/dev-baseline"
        locked: true
      paths:
        editable: true
        allowed:
          - "required/security-policies"
          - "optional/observability"
          - "optional/dev-tools"
```

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

## Design Decisions

| Question | Decision |
|----------|----------|
| **Host Binaries** | Use wrapper scripts in `host/` that delegate to `~/.rd/bin/kubectl` and `~/.rd/bin/helm` |
| **Offline Support** | Not a priority - can revisit later |
| **Multi-cluster** | Focus on local cluster only (fleet-local namespace) |
| **AppCo Dependency** | Standalone - integrate AppCo directly without requiring AppCo extension |
| **Fleet Version** | Use latest Fleet version at build time |
| **Path Discovery** | Backend shallow clone (provider agnostic, avoids GitHub API rate limits) |
| **Manifest Parsing** | Permissive (ignore unknown fields with warnings) |
| **Edit Mode** | Visual extension builder, disabled in enterprise builds via `layout.edit_mode` |
| **Card Types** | Custom card types require modifying source; we add generalized types as needed |

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

### Test Scenarios

1. **Fleet Installation**: Verify one-click Fleet installation works
2. **Public Repo**: Add the fleet-examples repo and verify sync
3. **Bundle Status**: Confirm bundles show as ready after sync
4. **Resource Display**: Verify deployed resources are shown correctly
5. **Error Handling**: Test with invalid repo URL to verify error display

---

## References

- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture for developers
- [NEXT_STEPS.md](NEXT_STEPS.md) - Current development priorities
- [reference/](reference/) - Technical reference documentation
