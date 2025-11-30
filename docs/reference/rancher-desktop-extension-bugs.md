# Rancher Desktop Extension Compatibility Issues

This document tracks known bugs and required workarounds when developing Docker Desktop extensions for Rancher Desktop.

## Backend Service Issues

### `vm.image` Not Supported

**Status:** Needs verification

**Issue:** Rancher Desktop appears to ignore the `vm.image` configuration in `metadata.json`. Only `vm.composefile` works.

**Workaround:** Use `vm.composefile` instead of `vm.image`:

```json
// metadata.json - DOES NOT WORK
{
  "vm": {
    "image": "${DESKTOP_PLUGIN_IMAGE}"
  }
}

// metadata.json - WORKS
{
  "vm": {
    "composefile": "compose.yaml"
  }
}
```

### `${DESKTOP_PLUGIN_IMAGE}` Variable Not Expanded

**Status:** Confirmed

**Issue:** The `${DESKTOP_PLUGIN_IMAGE}` variable in `compose.yaml` is not expanded by Rancher Desktop. The container fails to start because the image name is literally `${DESKTOP_PLUGIN_IMAGE}`.

**Workaround:** Hardcode the image name in `compose.yaml`:

```yaml
services:
  backend:
    # DOES NOT WORK: image: ${DESKTOP_PLUGIN_IMAGE}
    image: my-extension:dev  # Must be hardcoded
    pull_policy: never       # Required for local images
    ports:
      - "8080:8080"
```

### `pull_policy: never` Required for Local Images

**Status:** Confirmed

**Issue:** Without `pull_policy: never`, docker-compose tries to pull the image from a registry, which fails for locally-built extension images.

**Workaround:** Add `pull_policy: never` to your compose.yaml.

### Socket Directory Does Not Exist

**Status:** Confirmed

**Issue:** The standard Docker Desktop extension socket directory `/run/guest-services/` does not exist by default in Rancher Desktop's extension containers.

**Workaround:** Create the directory in your backend service before binding the socket:

```go
// In Go
socketDir := socketPath[:strings.LastIndex(socketPath, "/")]
if err := os.MkdirAll(socketDir, 0755); err != nil {
    log.Fatalf("Failed to create socket directory: %v", err)
}
```

### `ddClient.extension.vm.service` Not Implemented

**Status:** Confirmed

**Issue:** The `ddClient.extension.vm.service.get()` and `ddClient.extension.vm.service.post()` APIs are not implemented in Rancher Desktop. Calls to these methods fail silently or throw errors.

**Workaround:** Expose an HTTP port in your backend container and use `fetch()` directly:

```yaml
# compose.yaml
services:
  backend:
    ports:
      - "8080:8080"
```

```typescript
// Frontend - fallback to HTTP when vm.service fails
const queryBackend = async (path: string) => {
  const vm = ddClient.extension?.vm;
  if (vm?.service) {
    try {
      return await vm.service.get(path);
    } catch {
      // Fall through to HTTP
    }
  }
  // HTTP fallback
  const resp = await fetch(`http://localhost:8080${path}`);
  return resp.json();
};
```

**Note:** `ddClient.extension.vm.cli.exec()` DOES work for executing commands in the backend container.

## Extension Properties Issues

### `extension.image` Missing Tag

**Status:** Confirmed

**Issue:** `ddClient.extension.image` returns the image name without the version tag (e.g., `my-extension` instead of `my-extension:1.0.0`).

**Workaround:** Use the container's hostname (which equals the container ID) and `docker inspect` to get the full image name:

```go
// In backend service
hostname, _ := os.Hostname()  // Returns container ID
// Frontend can then call docker inspect via the Docker API
```

### `extension.id` and `extension.version` Missing

**Status:** Confirmed

**Issue:** `ddClient.extension.id` and `ddClient.extension.version` return `undefined`.

**Workaround:** None currently. These values are not available in Rancher Desktop.

## UI Issues

### Extension Sidebar Icon Caching

**Status:** Confirmed

**Issue:** When updating an extension's icon, the old icon is cached and continues to display even after reinstalling the extension.

**Workaround:** Fully restart Rancher Desktop (not just the extension) to clear the icon cache.

### GUI Uninstall Fails Silently

**Status:** Confirmed

**Issue:** Uninstalling an extension via the Rancher Desktop GUI sometimes fails silently, leaving the extension in a broken state.

**Workaround:** Use the CLI to uninstall:

```bash
docker extension rm my-extension:dev
```

If that fails, manually clean up:

```bash
# macOS
rm -rf ~/Library/Application\ Support/rancher-desktop/extensions/*

# Linux
rm -rf ~/.local/share/rancher-desktop/extensions/*

# Windows
Remove-Item -Recurse "$env:LOCALAPPDATA\rancher-desktop\extensions\*"
```

## Previously Suspected Issues (Now Resolved)

### Host Binaries Limited to 2-3

**Status:** Not reproducible

**Issue:** Initially suspected that only 2-3 host binaries could be registered before failures occurred.

**Current Status:** Testing with 5 binaries (kubectl, helm, rdctl, docker, debug-env) all passed in stress test. This issue may have been fixed or was an environment-specific problem.

## Testing These Issues

The debug-extension in this repository (`debug-extension/`) includes a diagnostic tool that tests all these APIs and generates a report. To use it:

```bash
cd debug-extension
docker build -t rd-extension-debugger:dev .
docker extension install rd-extension-debugger:dev
```

Then open the extension and click "Export All Results" to generate a diagnostic report.
