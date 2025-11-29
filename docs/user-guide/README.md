# Fleet GitOps Extension User Guide

This guide explains how to use and customize the Fleet GitOps extension for Rancher Desktop.

## Contents

1. [Getting Started](#getting-started)
2. [The Manifest File](#the-manifest-file)
3. [Card Types](card-types.md) - Detailed reference for all card types
4. [Edit Mode](#edit-mode)
5. [Creating Custom Extensions](#creating-custom-extensions)

---

## Getting Started

The Fleet GitOps extension provides a graphical interface for managing Fleet GitRepo resources in your Rancher Desktop Kubernetes cluster.

### Prerequisites

- Rancher Desktop installed and running
- Kubernetes enabled in Rancher Desktop settings

### First Launch

When you first open the extension:

1. **Fleet Status** - The extension checks if Fleet is installed in your cluster
2. **Install Fleet** - If not installed, click "Install Fleet" to deploy it
3. **Configure Repository** - Add a Git repository containing your Kubernetes manifests
4. **Select Paths** - Choose which directories to deploy

---

## The Manifest File

The extension UI is configured via a `manifest.yaml` file. This file controls:

- Application branding (name, logo)
- Layout options (which features to show)
- Card configuration (what appears in the UI)

### Manifest Structure

```yaml
version: "1.0"

# Application metadata
app:
  name: "Fleet GitOps"           # Extension name shown in header
  icon: "icon.svg"               # Sidebar icon
  description: "Description..."   # Optional description

# Visual branding
branding:
  primary_color: "#1976d2"       # Theme color
  logo: "logo.png"               # Header logo

# Layout options
layout:
  show_fleet_status: true        # Show Fleet installation status card
  show_activity_log: true        # Show activity/event log
  edit_mode: true                # Allow UI customization

# Cards to display
cards:
  - id: welcome
    type: markdown
    settings:
      content: "# Welcome!"
  # ... more cards
```

### Minimal Manifest

A minimal manifest only requires the version and cards:

```yaml
version: "1.0"
cards:
  - id: main-repo
    type: gitrepo
    settings:
      duplicatable: true
```

---

## Edit Mode

When `layout.edit_mode: true` is set in the manifest, users can customize the UI:

### Enabling Edit Mode

Click the **Edit** button in the header bar to toggle edit mode.

### In Edit Mode You Can:

1. **Reorder Cards**
   - Drag cards using the handle that appears above each card
   - Drop to reposition

2. **Add Cards**
   - Click the "+" button that appears between cards
   - Select a card type from the menu
   - Configure the new card

3. **Remove Cards**
   - Click the delete (trash) icon on any card

4. **Toggle Visibility**
   - Click the eye icon to hide/show cards
   - Hidden cards are still configured but not displayed

5. **Configure Cards**
   - Click the settings (gear) icon to edit card settings
   - Changes apply immediately

### Exiting Edit Mode

Click the **Done** button to exit edit mode. Your layout is preserved.

---

## Card Types Overview

Cards are the building blocks of the extension UI. Each card type serves a specific purpose:

| Type | Purpose |
|------|---------|
| `markdown` | Display formatted text, instructions, announcements |
| `image` | Display logos, diagrams, or other images |
| `video` | Embed tutorial videos from YouTube, Vimeo, or direct URLs |
| `link` | Quick access buttons or link lists to external resources |
| `divider` | Visual separator between sections |
| `gitrepo` | Configure and manage Git repositories for Fleet |

For complete configuration options and examples, see the **[Card Types Reference](card-types.md)**.

---

## Examples

### Simple Documentation Extension

A minimal extension with instructions and a single repo:

```yaml
version: "1.0"
app:
  name: "My GitOps Dashboard"
layout:
  edit_mode: false    # Lock the layout
cards:
  - id: instructions
    type: markdown
    settings:
      content: |
        ## Deployment Instructions

        Select the applications you want to deploy below.

  - id: apps-repo
    type: gitrepo
    title: "Applications"
    settings:
      repo_url:
        default: "https://github.com/myorg/k8s-apps"
        editable: false
      paths:
        editable: true
```

### Full-Featured Dashboard

An extension with branding, resources, and multiple repos:

```yaml
version: "1.0"
app:
  name: "ACME Corp GitOps"
branding:
  primary_color: "#2e7d32"
layout:
  show_fleet_status: true
  edit_mode: true
cards:
  - id: welcome
    type: markdown
    settings:
      content: "Welcome to the ACME deployment dashboard!"

  - id: resources
    type: link
    title: "Quick Links"
    settings:
      variant: buttons
      links:
        - label: "Docs"
          url: "https://docs.acme.com"
        - label: "Support"
          url: "https://support.acme.com"

  - id: section-repos
    type: divider
    settings:
      label: "Repositories"

  - id: infra-repo
    type: gitrepo
    title: "Infrastructure"
    settings:
      duplicatable: false
      repo_url:
        default: "https://github.com/acme/infra"
        editable: false

  - id: apps-repo
    type: gitrepo
    title: "Applications"
    settings:
      duplicatable: true
      repo_url:
        editable: true
```

---

## Creating Custom Extensions

For enterprise or team deployments, you can create a **subclassed extension** that inherits from the base Fleet GitOps extension and adds your own customizations. This allows you to:

- Pre-configure repositories and settings for your organization
- Lock certain fields to prevent modification
- Add company branding (logo, colors)
- Include custom documentation and links
- Distribute as a single Docker image

### How Subclassed Extensions Work

A subclassed extension uses Docker's `FROM` instruction to inherit all functionality from the base extension image, then overlays your customizations:

```dockerfile
ARG BASE_IMAGE=ghcr.io/rancher-sandbox/fleet-gitops:latest
FROM ${BASE_IMAGE}

# Change the extension title
LABEL org.opencontainers.image.title="My Company Fleet"

# Override with your custom configuration
COPY metadata.json /metadata.json
COPY manifest.yaml /ui/manifest.yaml
COPY icons/ /icons/
```

### Required Files

Your subclassed extension needs these files:

| File | Purpose |
|------|---------|
| `Dockerfile` | Inherits from base image, copies overrides |
| `manifest.yaml` | Your custom card configuration |
| `metadata.json` | Extension title and icon path |
| `icons/` | Your custom icon(s) |

### Step-by-Step Guide

1. **Create your extension directory:**

   ```bash
   mkdir my-fleet-extension
   cd my-fleet-extension
   ```

2. **Create `metadata.json`:**

   ```json
   {
     "icon": "/icons/my-icon.svg",
     "ui": {
       "dashboard-tab": {
         "title": "My Fleet Dashboard",
         "root": "/ui",
         "src": "index.html"
       }
     }
   }
   ```

3. **Create `manifest.yaml`** with your configuration (see examples above)

4. **Add your icon** to `icons/my-icon.svg`

5. **Create `Dockerfile`:**

   ```dockerfile
   ARG BASE_IMAGE=ghcr.io/rancher-sandbox/fleet-gitops:latest
   FROM ${BASE_IMAGE}

   LABEL org.opencontainers.image.title="My Fleet Dashboard"

   COPY metadata.json /metadata.json
   COPY manifest.yaml /ui/manifest.yaml
   COPY icons/ /icons/
   ```

6. **Build and install:**

   ```bash
   docker build -t my-fleet-extension:dev .
   docker extension install my-fleet-extension:dev
   ```

### Locking Fields for Enterprise

For managed deployments, you can lock fields to prevent modification:

```yaml
cards:
  - id: company-repo
    type: gitrepo
    title: "Company Configuration"
    settings:
      # Lock the repository URL
      repo_url:
        default: "https://github.com/mycompany/k8s-configs"
        editable: false
        locked: true
      # Restrict path selection to approved paths only
      paths:
        allowed:
          - production/
          - staging/
```

### Disabling Edit Mode

To create a read-only extension where users cannot modify the layout:

```yaml
layout:
  edit_mode: false
```

### Complete Example

See the [examples/subclassed-extension](../../examples/subclassed-extension/) directory for a complete working example with all files.

---

## Troubleshooting

### Fleet Won't Install

- Ensure Kubernetes is enabled in Rancher Desktop settings
- Check that you have sufficient resources (CPU, memory)
- Try restarting Rancher Desktop

### Repository Paths Not Loading

- Verify the repository URL is accessible
- Check that the repository contains `fleet.yaml` files
- For private repositories, configure authentication first

### Cards Not Saving

- Ensure edit mode is enabled in the manifest
- Check browser console for errors
- Try refreshing the extension

---

## Next Steps

- Read the [Card Types Reference](card-types.md) for detailed configuration options
- Explore the [Fleet documentation](https://fleet.rancher.io/) for GitOps concepts
- Check out [fleet-examples](https://github.com/rancher/fleet-examples) for sample repositories
