# RD Extension Debugger

A diagnostic tool for investigating Rancher Desktop's extension mechanism.

## Purpose

This extension helps debug and understand the Rancher Desktop extension runtime by providing visibility into:

1. **ddClient Object** - All properties and methods exposed by the Docker Desktop SDK
2. **Container Environment** - Hostname, environment variables, filesystem inside the extension container
3. **Host Binary Environment** - What context host binaries receive when invoked
4. **Host Binary Stress Test** - Tests 5 host binaries to reproduce the ENOENT bug
5. **RD Tools Inventory** - Lists available tools in `~/.rd/bin/`
6. **Kubernetes Context** - Current cluster and context information

## Known Issues Being Investigated

- `ddClient.extension.image` returns name without `:version` tag
- Host binaries limited to ~2-3 scripts (4th+ fails with ENOENT)
- Extension sidebar icon caching (requires full RD restart)
- GUI uninstall fails silently (CLI `rdctl extension uninstall` works)

## Building

```bash
cd debug-extension
docker build -t rd-extension-debugger:dev .
```

## Installing

```bash
rdctl extension install rd-extension-debugger:dev
```

## Uninstalling

```bash
# GUI uninstall may not work - use CLI
rdctl extension uninstall rd-extension-debugger:dev
```

## Host Binaries

This extension includes 5 host binary wrappers to test the binary limit:

1. `kubectl` - Kubernetes CLI
2. `helm` - Helm package manager
3. `rdctl` - Rancher Desktop CLI
4. `docker` - Docker CLI
5. `debug-env` - Custom script that dumps all environment info

## Development

```bash
cd debug-extension/ui
npm install
npm run dev

# In another terminal, enable dev mode
docker extension dev ui-source rd-extension-debugger:dev http://localhost:3000
```
