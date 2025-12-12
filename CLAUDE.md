# Claude Code Instructions for Fleet GitOps Extension

## Rancher Desktop Extension Development

### Running Host Commands via rd-exec

When developing Rancher Desktop extensions, you cannot run arbitrary host commands directly. The `ddClient.extension.host?.cli.exec()` method only executes binaries that are bundled in the extension's `host/` directory.

**Solution**: Use `rd-exec` to run commands on the host machine.

```typescript
// rd-exec runs commands on the host with ~/.rd/bin in PATH
const result = await ddClient.extension.host?.cli.exec('rd-exec', ['/bin/sh', '-c', 'your command here']);
```

**Key points:**
- `rd-exec` is included as a host binary in this extension (see `host/` directory)
- It runs commands on the **host machine** (not the VM)
- `~/.rd/bin` is automatically added to PATH, so Rancher Desktop tools are accessible
- Use this for operations that need host access, such as:
  - Reading host files (e.g., `~/.docker/config.json`)
  - Invoking Docker credential helpers (`docker-credential-osxkeychain`, etc.)
  - Running any command that needs access to host-side resources

**Contrast with `rdctl shell`:**
- `rdctl shell` runs commands **inside the Rancher Desktop VM**
- `rd-exec` runs commands **on the host**

### Docker Credential Helpers

Credential helpers (like `docker-credential-osxkeychain` on macOS) access platform-specific credential stores. They must be invoked on the host, not from within a container.

```typescript
// Read docker config
const configResult = await ddClient.extension.host?.cli.exec('rd-exec', ['/bin/sh', '-c', 'cat ~/.docker/config.json']);

// Invoke credential helper
const credsResult = await ddClient.extension.host?.cli.exec('rd-exec', [
  '/bin/sh', '-c',
  `echo "https://index.docker.io/v1/" | docker-credential-osxkeychain get`
]);
```

The credential helper protocol:
- Send registry URL to stdin
- Receive JSON with `Username` and `Secret` fields on stdout
