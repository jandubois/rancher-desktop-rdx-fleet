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

**Workaround:** None yet. May need to consolidate scripts or remove unused ones.

**Status:** Needs investigation

---

## Notes

- Rancher Desktop source: https://github.com/rancher-sandbox/rancher-desktop
- Extension implementation likely in `pkg/rancher-desktop/` or similar
