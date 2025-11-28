# Fleet GitOps Extension - Documentation

## Quick Start

| Document | Purpose |
|----------|---------|
| **[NEXT_STEPS.md](NEXT_STEPS.md)** | Current development plan and priorities - **read first** |
| [PRD.md](PRD.md) | Product requirements, features, UI mockups |

## Reference Documentation

Technical documentation for implementation:

| Document | Topics |
|----------|--------|
| [UI Card Architecture](reference/ui-card-architecture.md) | Card system, drag-and-drop, manifest loading, state management |
| [Extension Architecture](reference/extension-architecture.md) | Docker/Rancher Desktop extension SDK, host binaries, backend service |
| [Fleet Local Mode](reference/fleet-local-mode.md) | Fleet installation, GitRepo CRD, authentication secrets, local cluster setup |
| [Helm Controller](reference/helm-controller-integration.md) | HelmChart CRD, alternative to Fleet for simple cases |

## Background Materials

Reference materials from external sources (wikis, help docs). Rarely needed for day-to-day development:

- `background/wiki/rancherlabs/application-collection-extension/` - AppCo extension (our template)
- `background/wiki/rancher/fleet/` - Fleet GitOps documentation
- `background/wiki/k3s-io/helm-controller/` - Helm Controller documentation
- `background/appco-help/` - SUSE Application Collection help docs

## Project Structure

```
rancher-desktop-rdx-fleet/
├── extension/
│   ├── Dockerfile           # Multi-stage Docker build
│   ├── metadata.json        # Extension configuration
│   ├── host/                # kubectl/helm wrapper scripts
│   │   ├── darwin/, linux/, windows/
│   └── ui/                  # React frontend
│       ├── src/
│       │   ├── App.tsx      # Main component (~1500 lines)
│       │   ├── manifest/    # Manifest types and loader
│       │   ├── cards/       # Card components
│       │   └── lib/         # Utilities (ddClient)
│       └── package.json
├── docs/                    # You are here
└── scripts/                 # Build/dev scripts
```

## Key Concepts

### Extension Architecture

The extension runs as a Docker image containing:
- **UI layer** (React) - Renders in Rancher Desktop sidebar
- **Host binaries** (kubectl, helm) - Delegated to `~/.rd/bin/`
- No backend service - all operations via kubectl/helm CLI

### Card-Based UI

The main UI is composed of draggable, reorderable cards:
- `fleet-status` - Fleet installation status
- `gitrepo` - Git repository configuration with path selection
- `markdown` - Rich text content
- `placeholder` - Temporary card during type selection (edit mode)

### Manifest System

Configuration via `/ui/manifest.yaml`:
- App settings (name, icon)
- Branding (colors, logo)
- Layout options (edit_mode, show_fleet_status)
- Card definitions (type, settings)

Enterprise customization: `FROM` the official image + replace manifest.

### Fleet Integration

- Fleet controller installed via Helm in `cattle-fleet-system`
- GitRepo resources created in `fleet-local` namespace
- Credentials stored as Kubernetes Secrets
- Status read from GitRepo CR `.status` fields
