# Fleet GitOps Extension for Rancher Desktop

A Rancher Desktop extension for GitOps-based developer environment provisioning using Fleet.

## Development

### Building

```bash
cd extension
docker build -t fleet-extension:dev .
```

### Installing

**Important:** Always uninstall before reinstalling to avoid corruption.

```bash
# First time install
docker extension install fleet-extension:dev

# To reinstall after changes
docker extension rm fleet-extension:dev
docker build -t fleet-extension:dev .
docker extension install fleet-extension:dev
```

### Troubleshooting

If the extension becomes stuck or uninstallable:

1. **Try uninstalling by image name:**
   ```bash
   docker extension rm fleet-extension:dev
   ```

2. **If that fails, manually clean up:**
   ```bash
   # On macOS
   rm -rf ~/Library/Application\ Support/rancher-desktop/extensions/*

   # On Linux
   rm -rf ~/.local/share/rancher-desktop/extensions/*

   # On Windows (PowerShell)
   Remove-Item -Recurse "$env:LOCALAPPDATA\rancher-desktop\extensions\*"
   ```

3. **Restart Rancher Desktop** after manual cleanup.

### Development Mode

For faster iteration during UI development:

```bash
# Start the Vite dev server
cd ui
npm run dev

# In another terminal, enable dev mode
docker extension dev ui-source fleet-extension:dev http://localhost:3000
```

## Architecture

```
extension/
├── Dockerfile          # Multi-stage build
├── metadata.json       # Extension configuration
├── icons/
│   └── fleet-icon.svg  # Extension icon
├── host/               # Host binary wrappers
│   ├── darwin/         # macOS (kubectl, helm)
│   ├── linux/          # Linux (kubectl, helm)
│   └── windows/        # Windows (kubectl.cmd, helm.cmd)
└── ui/                 # React frontend
    └── src/
        ├── App.tsx           # Main component with card rendering
        ├── manifest/
        │   ├── index.ts      # Manifest loading
        │   └── types.ts      # Card and manifest types
        ├── cards/
        │   ├── CardWrapper.tsx   # Common card wrapper
        │   ├── MarkdownCard.tsx  # Markdown content card
        │   └── registry.ts       # Card type registry
        └── lib/
            └── ddClient.ts   # Docker Desktop SDK client
```

The host binaries are wrapper scripts that delegate to `~/.rd/bin/kubectl` and `~/.rd/bin/helm`, which are symlinks to Rancher Desktop's bundled tools.

### Card-Based UI

The UI follows a card-based architecture with drag-and-drop reordering:

- **Header Bar**: Fixed header with extension name and edit toggle (not a card)
- **Fleet Status Card**: Shows Fleet installation status
- **GitRepo Cards**: One card per Git repository with path selection
- **Manifest Cards**: Markdown, image, video content from manifest

In edit mode:
- Cards can be reordered via drag-and-drop (@dnd-kit)
- "Add card" buttons appear between cards
- Placeholder cards allow selecting new card type

See [docs/reference/ui-card-architecture.md](../docs/reference/ui-card-architecture.md) for detailed documentation.

## Creating Custom Extensions

For enterprise or team deployments, you can create a **custom extension** that inherits from this base image and overlays your own configuration:

```dockerfile
FROM ghcr.io/rancher-sandbox/fleet-gitops:latest

LABEL org.opencontainers.image.title="My Company Fleet"

COPY metadata.json /metadata.json
COPY manifest.yaml /ui/manifest.yaml
COPY icons/ /icons/
```

See:
- [User Guide: Creating Custom Extensions](../docs/user-guide/README.md#creating-custom-extensions)
- [Example Custom Extension](../examples/custom-extension/)

## Future Work / TODO

### Backend Service for Auto-Install

Add a backend service container (like in debug-extension) that can:

1. **Auto-install Fleet on extension load** - The backend can run `helm install` without requiring the UI to be opened first
2. **Get accurate image tag** - Use `docker inspect` on the container ID (from hostname) to get the full image name with tag, working around the `ddClient.extension.image` bug that returns the image name without version
3. **Background health monitoring** - Continuously monitor Fleet status and cluster health

Implementation notes:
- Use `vm.composefile` (not `vm.image`) - RD ignores `vm.image`
- Expose HTTP port (e.g., 8080) for frontend communication - `ddClient.extension.vm.service` is not implemented in RD
- See debug-extension for working example
