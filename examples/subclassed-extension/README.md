# Subclassed Extension Example

This example demonstrates how to create a customized Fleet GitOps extension by inheriting from the base extension image.

## What is a Subclassed Extension?

A subclassed extension uses Docker's `FROM` instruction to inherit all functionality from the base Fleet GitOps extension, then layers on customizations:

- **Custom manifest.yaml**: Pre-configure repositories, lock fields, add informational cards
- **Custom metadata.json**: Change the extension title and icon
- **Custom icons**: Add your company branding

## Building the Subclassed Extension

### Prerequisites

1. First, build the base extension image:

```bash
cd ../../extension
docker build -t fleet-gitops-extension:latest .
```

### Build the Subclassed Extension

```bash
cd examples/subclassed-extension
docker build -t my-company-fleet:dev .
```

Or specify a different base image:

```bash
docker build --build-arg BASE_IMAGE=ghcr.io/rancher-sandbox/fleet-gitops:latest -t my-company-fleet:dev .
```

### Install the Extension

```bash
docker extension install my-company-fleet:dev
```

## Customization Options

### manifest.yaml

The manifest controls what cards appear and how they behave:

| Section | Purpose |
|---------|---------|
| `app` | Extension name and description |
| `branding` | Primary color, logo |
| `layout` | Show/hide Fleet status, activity log, edit mode |
| `cards` | Define the cards and their settings |

### Card Types

- **gitrepo**: Git repository configuration with lockable fields
- **markdown**: Rich text content for instructions or information
- **link**: Navigation buttons or link lists
- **image**: Static images for branding
- **video**: Embedded video content
- **divider**: Visual separators

### Locking Fields

For enterprise deployments, you can lock certain fields to prevent modification:

```yaml
cards:
  - id: company-repo
    type: gitrepo
    settings:
      repo_url:
        editable: false
        default: "https://github.com/company/configs"
        locked: true
      paths:
        allowed:
          - approved-path-1
          - approved-path-2
```

### Disabling Edit Mode

For read-only deployments, disable the edit mode toggle:

```yaml
layout:
  edit_mode: false
```

## File Structure

```
subclassed-extension/
├── Dockerfile          # Inherits from base extension
├── manifest.yaml       # Custom card configuration
├── metadata.json       # Extension title and icon path
├── icons/
│   └── company-icon.svg  # Custom extension icon
└── README.md           # This file
```
