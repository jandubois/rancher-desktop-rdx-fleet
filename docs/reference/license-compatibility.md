# License Compatibility Review

This document tracks all external dependencies and verifies their compatibility with the project's Apache 2.0 license.

**Last reviewed**: 2025-12-03

## License Compatibility Summary

All dependencies use licenses compatible with Apache 2.0:

| License | Compatibility | Notes |
|---------|---------------|-------|
| MIT | Compatible | Permissive, minimal restrictions |
| BSD-3-Clause | Compatible | Permissive, requires attribution |
| Apache-2.0 | Compatible | Same license |
| ISC | Compatible | Functionally equivalent to MIT |

## Go Dependencies

Source: `debug-extension/vm/go.mod`

| Package | License | Compatible |
|---------|---------|------------|
| github.com/labstack/echo/v4 | MIT | Yes |
| github.com/sirupsen/logrus | MIT | Yes |
| github.com/golang-jwt/jwt | MIT | Yes |
| github.com/labstack/gommon | MIT | Yes |
| github.com/mattn/go-colorable | MIT | Yes |
| github.com/mattn/go-isatty | MIT | Yes |
| github.com/valyala/bytebufferpool | MIT | Yes |
| github.com/valyala/fasttemplate | MIT | Yes |
| golang.org/x/crypto | BSD-3-Clause | Yes |
| golang.org/x/net | BSD-3-Clause | Yes |
| golang.org/x/sys | BSD-3-Clause | Yes |
| golang.org/x/text | BSD-3-Clause | Yes |
| golang.org/x/time | BSD-3-Clause | Yes |

## NPM Runtime Dependencies

Source: `extension/ui/package.json`

| Package | License | Compatible | Notes |
|---------|---------|------------|-------|
| @dnd-kit/core | MIT | Yes | |
| @dnd-kit/sortable | MIT | Yes | |
| @dnd-kit/utilities | MIT | Yes | |
| @docker/extension-api-client | Apache-2.0 | Yes | |
| @emotion/react | MIT | Yes | |
| @emotion/styled | MIT | Yes | |
| @mui/icons-material | MIT | Yes | |
| @mui/material | MIT | Yes | |
| color-namer | MIT | Yes | |
| colorthief | MIT | Yes | |
| js-yaml | MIT | Yes | |
| jszip | MIT OR GPL-3.0 | Yes | Dual-licensed; use under MIT |
| pro-color-harmonies | MIT | Yes | |
| react | MIT | Yes | |
| react-dom | MIT | Yes | |
| react-markdown | MIT | Yes | |
| rehype-raw | MIT | Yes | |

## NPM Dev Dependencies

Source: `extension/ui/package.json`

Dev dependencies don't ship with the final product but are included for completeness.

| Package | License | Compatible |
|---------|---------|------------|
| @eslint/js | MIT | Yes |
| @playwright/test | Apache-2.0 | Yes |
| @testing-library/jest-dom | MIT | Yes |
| @testing-library/react | MIT | Yes |
| @testing-library/user-event | MIT | Yes |
| @types/js-yaml | MIT | Yes |
| @types/jszip | MIT | Yes |
| @types/react | MIT | Yes |
| @types/react-dom | MIT | Yes |
| @vitejs/plugin-react | MIT | Yes |
| @vitest/coverage-v8 | MIT | Yes |
| eslint | MIT | Yes |
| eslint-plugin-react-hooks | MIT | Yes |
| eslint-plugin-react-refresh | MIT | Yes |
| globals | MIT | Yes |
| jsdom | MIT | Yes |
| msw | MIT | Yes |
| typescript | Apache-2.0 | Yes |
| typescript-eslint | MIT | Yes |
| vite | MIT | Yes |
| vitest | MIT | Yes |

## Backend Service Dependencies

Source: `extension/backend/package.json`

| Package | License | Compatible | Notes |
|---------|---------|------------|-------|
| @kubernetes/client-node | Apache-2.0 | Yes | Kubernetes API client |
| dockerode | Apache-2.0 | Yes | Docker API client |
| express | MIT | Yes | Web framework |

### Backend Dev Dependencies

| Package | License | Compatible |
|---------|---------|------------|
| @types/dockerode | MIT | Yes |
| @types/express | MIT | Yes |
| @types/jest | MIT | Yes |
| @types/node | MIT | Yes |
| jest | MIT | Yes |
| ts-jest | MIT | Yes |
| typescript | Apache-2.0 | Yes |

## Debug Extension UI Dependencies

Source: `debug-extension/ui/package.json`

| Package | License | Compatible |
|---------|---------|------------|
| @docker/extension-api-client | Apache-2.0 | Yes |
| @emotion/react | MIT | Yes |
| @emotion/styled | MIT | Yes |
| @mui/icons-material | MIT | Yes |
| @mui/material | MIT | Yes |
| react | MIT | Yes |
| react-dom | MIT | Yes |
| @types/react | MIT | Yes |
| @types/react-dom | MIT | Yes |
| @vitejs/plugin-react | MIT | Yes |
| typescript | Apache-2.0 | Yes |
| vite | MIT | Yes |

## Incompatible Licenses (Reference)

The following licenses are **NOT compatible** with Apache 2.0 and must be avoided:

| License | Issue |
|---------|-------|
| GPL-2.0 (only) | Copyleft incompatible with Apache 2.0 |
| LGPL-2.1 (only) | Copyleft complications |
| AGPL-3.0 | Network copyleft, very restrictive |
| SSPL | Not OSI-approved, very restrictive |
| Commons Clause | Commercial use restrictions |
| Proprietary | No redistribution rights |

Note: GPL-3.0 is compatible with Apache 2.0 (can combine), but the result must be GPL-3.0 licensed.

## Adding New Dependencies

When adding a new dependency:

1. **Check the license** on npm/pkg.go.dev or the project's GitHub repository
2. **Verify compatibility** against the table above
3. **Update this document** with the new dependency
4. **For dual-licensed packages**, note which license you're using (prefer MIT/BSD/Apache)

### Quick License Check Commands

**NPM packages:**
```bash
npm view <package-name> license
```

**Go packages:**
Check the LICENSE file in the repository or use:
```bash
go-licenses check ./...
```

## Resources

- [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0)
- [License Compatibility Chart](https://www.gnu.org/licenses/license-compatibility.html)
- [SPDX License List](https://spdx.org/licenses/)
