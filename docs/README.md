# Fleet GitOps Extension - Documentation

## New Developer? Start Here

| Document | Purpose |
|----------|---------|
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | **Complete architecture guide** - system overview, frontend/backend interaction, data flow, key entry points, development workflow |
| [NEXT_STEPS.md](NEXT_STEPS.md) | Current development plan and priorities |
| [PRD.md](PRD.md) | Product requirements, features, UI mockups |

The [Architecture Guide](ARCHITECTURE.md) provides everything you need to understand the codebase and start contributing, including:
- High-level system architecture with diagrams
- Frontend structure (React, cards, hooks, services)
- Backend structure (Express, Kubernetes client)
- Communication patterns between components
- Data flow diagrams for key operations
- Step-by-step guides for adding new features

## User Guide

End-user documentation for configuring and customizing the extension:

| Document | Topics |
|----------|--------|
| [User Guide](user-guide/README.md) | Getting started, manifest config, edit mode, custom extensions |
| [Card Types Reference](user-guide/card-types.md) | All card types with YAML configuration examples |
| [Custom Extension Example](../examples/custom-extension/) | Complete working example of a custom extension |

## Reference Documentation

Technical documentation for implementation:

| Document | Topics |
|----------|--------|
| [UI Card Architecture](reference/ui-card-architecture.md) | Card system, drag-and-drop, manifest loading, state management |
| [Extension Architecture](reference/extension-architecture.md) | Docker/Rancher Desktop extension SDK, host binaries, backend service |
| [Fleet Local Mode](reference/fleet-local-mode.md) | Fleet installation, GitRepo CRD, authentication secrets, local cluster setup |
| [Helm Controller](reference/helm-controller-integration.md) | HelmChart CRD, alternative to Fleet for simple cases |
| [License Compatibility](reference/license-compatibility.md) | Dependency licenses, Apache 2.0 compatibility verification |

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
│       │   ├── App.tsx      # Main component
│       │   ├── manifest/    # Manifest types and loader
│       │   ├── cards/       # Card components
│       │   └── lib/         # Utilities (ddClient)
│       └── package.json
├── examples/
│   └── custom-extension/  # Example custom extension
├── docs/                    # You are here
└── scripts/                 # Build/dev scripts
```

## Key Concepts

### Extension Architecture

The extension runs as a Docker image containing:
- **UI layer** (React) - Renders in Rancher Desktop sidebar
- **Backend service** (Express.js) - Handles Kubernetes operations via client library
- **Host binaries** - Platform-specific scripts for credential helpers and CLI tools

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture documentation.

### Card-Based UI

The main UI is composed of draggable, reorderable cards:
- `fleet-status` - Fleet installation status
- `gitrepo` - Git repository configuration with path selection
- `markdown` - Rich text content
- `image` - Static image display
- `video` - Embedded video (YouTube, Vimeo, direct)
- `link` - Collection of clickable links
- `divider` - Visual separator with optional label
- `placeholder` - Temporary card during type selection (edit mode)

See the [Card Types Reference](user-guide/card-types.md) for configuration details.

### Manifest System

Configuration via `/ui/manifest.yaml`:
- App settings (name, icon)
- Branding (colors, logo)
- Layout options (edit_mode, show_fleet_status)
- Card definitions (type, settings)

For enterprise customization, create a custom extension that inherits from the official image. See [Creating Custom Extensions](user-guide/README.md#creating-custom-extensions) and the [example](../examples/custom-extension/).

### Fleet Integration

- Fleet controller installed via Helm in `cattle-fleet-system`
- GitRepo resources created in `fleet-local` namespace
- Credentials stored as Kubernetes Secrets
- Status read from GitRepo CR `.status` fields
