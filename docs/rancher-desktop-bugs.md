# Suspected Rancher Desktop Extension Bugs

This document tracks suspected bugs in the Rancher Desktop implementation of the Docker Desktop Extension API. These should be investigated in the Rancher Desktop source code.

## 1. `ddClient.extension.image` missing tag

**Expected:** According to the Rancher Desktop Extension interface, `image` should be "the full image tag (combination of id and version)".

**Actual:** Returns only the image name without the tag (e.g., `fleet-gitops-extension` instead of `fleet-gitops-extension:next`).

**Investigation notes:**
- The Extension class has a getter: `get image() { return \`${ this.id }:${ this.version }\`; }`
- This getter should always include a colon, even if version is empty
- The fact that we get no colon suggests `ddClient.extension.image` is not using this getter
- Likely the ddClient is populating the `image` property from a different source
- **Additional finding:** `ddClient.extension.id` and `ddClient.extension.version` are also not exposed
  - Only `image` is available, and it's missing the tag
  - The workaround of combining id+version doesn't work because they're undefined

**Where to look:** Search for where `ddClient.extension` is constructed/populated in Rancher Desktop source.

**Workaround:** None currently - user must manually enter the base image with tag.

**Status:** Needs investigation - check how ddClient.extension is populated

---

## 2. Host binaries limited to ~2 scripts

**Expected:** All binaries declared in `metadata.json` under `host.binaries` should be available.

**Actual:** When adding a 4th binary (`rd-exec`) to the existing 3 (`kubectl`, `helm`, `kubectl-apply-json`), it fails with ENOENT. Suggests a limit on the number of host binaries.

**Error:**
```
Error invoking remote method 'extensions/spawn/blocking': Error: spawn /Users/.../extensions/.../bin/rd-exec ENOENT
```

**Update (2025-11-29):** Could not reproduce with debug-extension using 5 binaries (kubectl, helm, rdctl, docker, debug-env). All 5 work correctly. The original failures may have been due to:
- Incorrect arguments passed to binaries (e.g., `--client` flag not supported by helm/rdctl/docker)
- A bug that was fixed in a recent RD version
- Specific conditions not yet identified

**Status:** Needs re-investigation - could not reproduce with 5 binaries

---

## 3. Extension sidebar icon not updated until restart

**Expected:** When rebuilding an extension with a new icon, the sidebar icon should update after reinstalling the extension.

**Actual:** The sidebar icon remains cached even after rebuilding and reinstalling the extension. A full Rancher Desktop restart is required to see the updated icon.

**Workaround:** Restart Rancher Desktop after updating extension icons.

**Status:** Needs investigation - likely an icon caching issue in the Electron app

---

## 4. Extension GUI uninstall fails silently

**Expected:** Extensions should uninstall cleanly from the GUI.

**Actual:** Clicking uninstall/remove in the GUI does nothing. The `rdctl extension uninstall` CLI command works fine.

The log shows a warning about a missing compose.yaml:
```
Ignoring error stopping fleet-gitops-extension containers on uninstall: Error: ENOENT: no such file or directory, open '.../extensions/.../compose/compose.yaml'
```

However, this warning is likely not the root cause since:
1. The message says "Ignoring error" suggesting it's non-fatal
2. Adding `vm.composefile` to metadata.json doesn't cause the compose directory to be extracted
3. The CLI uninstall works despite the same warning

**Investigation notes:**
- Attempted workaround: add empty `compose/compose.yaml` to extension image
- The compose directory is not extracted even when `vm.composefile` is declared in metadata.json
- This may indicate a bug in how RD extracts extension contents
- The actual GUI uninstall failure appears to be a different, unrelated issue

**Workaround:** Use `rdctl extension uninstall <image>` from the command line.

**Status:** Needs investigation in Rancher Desktop source code.

---

## 5. Double slash in extension URL path (Minor)

**Expected:** Clean URL path for extension UI.

**Actual:** The webview URL shows a double slash: `x-rd-extension://.../ui/dashboard-tab//ui/index.html`

**Impact:** Minor cosmetic issue, doesn't affect functionality.

**Status:** Low priority

---

## Debug Extension Findings (2025-11-29)

The `debug-extension/` provides detailed diagnostics. Key findings:

### Webview Environment
- Protocol: `x-rd-extension:` (custom Electron protocol)
- Hostname: Hex-encoded extension name (e.g., `72642d657874656e73696f6e2d6465627567676572` = "rd-extension-debugger")
- No container ID visible in webview context

### Host Binary Environment
- PATH does NOT include `~/.rd/bin` - tools work via symlinks pointing to app bundle
- Working directory is `/` (root)
- Full user context (uid, groups, home directory)
- Environment includes `__CFBundleIdentifier=io.rancherdesktop.app`

### SDK Comparison (vs Docker Desktop Extension SDK)

**ddClient.extension:**
| Property | Expected | Actual |
|----------|----------|--------|
| `image` | Full IMAGE:TAG | Missing tag ❌ |
| `vm` | Backend exec | Present, but needs compose.yaml |
| `host` | Host binaries | Working ✓ |

**ddClient.docker:**
| Method | Status |
|--------|--------|
| `cli.exec()` | Working ✓ |
| `listContainers()` | Untested |
| `listImages()` | Untested |

**ddClient.desktopUI:**
| Method | Status |
|--------|--------|
| `toast.success/warning/error()` | Untested |
| `dialog.showOpenDialog()` | Untested |
| `navigate.*()` | Untested |

### Missing from SDK (compared to Docker Desktop)
- `ddClient.extension.id` - undefined
- `ddClient.extension.version` - undefined
- Only `image` is exposed, and it's broken (missing tag)

---

## Notes

- Rancher Desktop source: https://github.com/rancher-sandbox/rancher-desktop
- Extension implementation likely in `pkg/rancher-desktop/` or similar
- Debug extension for testing: `debug-extension/` in this repo
