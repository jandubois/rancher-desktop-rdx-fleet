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
        ├── App.tsx     # Main component
        └── lib/
            └── ddClient.ts  # Docker Desktop SDK client
```

The host binaries are wrapper scripts that delegate to `~/.rd/bin/kubectl` and `~/.rd/bin/helm`, which are symlinks to Rancher Desktop's bundled tools.
