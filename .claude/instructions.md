# Fleet GitOps Extension

## First Action

When given a task, **read `docs/NEXT_STEPS.md` first**. It contains:
- Current development priorities
- Key file locations for each area
- Technical decisions already made

Do NOT run Glob or Grep to explore. The documentation tells you where files are.

## File Locations

| Area | Files |
|------|-------|
| Main UI | `extension/ui/src/App.tsx` |
| Types | `extension/ui/src/types.ts` |
| Fleet logic | `extension/ui/src/hooks/useFleetStatus.ts` |
| GitRepo logic | `extension/ui/src/hooks/useGitRepoManagement.ts` |
| Path discovery | `extension/ui/src/hooks/usePathDiscovery.ts` |
| Cards | `extension/ui/src/cards/` (registry.ts, CardWrapper.tsx, MarkdownCard.tsx) |
| Components | `extension/ui/src/components/` (SortableCard.tsx, AddRepoDialog.tsx) |
| Manifest | `extension/ui/src/manifest/` (types.ts, loader.ts) |
| Utilities | `extension/ui/src/utils/` (errors.ts, github.ts, constants.ts) |
| Docker | `extension/Dockerfile`, `extension/metadata.json` |
| Host binaries | `extension/host/{darwin,linux,windows}/` |

## Reference Docs

| Topic | Document |
|-------|----------|
| Current priorities | `docs/NEXT_STEPS.md` |
| Product requirements | `docs/PRD.md` |
| UI card system | `docs/reference/ui-card-architecture.md` |
| Fleet integration | `docs/reference/fleet-local-mode.md` |
| Extension SDK | `docs/reference/extension-architecture.md` |
| Helm controller | `docs/reference/helm-controller-integration.md` |
| User guide | `docs/user-guide/README.md` |
| Card types reference | `docs/user-guide/card-types.md` |

## Technical Facts

- Kubernetes context: `rancher-desktop`
- Fleet namespace: `fleet-local`
- No backend service - all via kubectl/helm CLI
- Host binaries delegate to `~/.rd/bin/kubectl` and `~/.rd/bin/helm`

## Card Types

Implemented: `gitrepo`, `markdown`, `html`, `image`, `video`, `link`, `divider`, `placeholder`, `auth-github`, `auth-appco`
Not yet implemented: `auth-git`

**When adding/modifying card types**: Update both `docs/user-guide/card-types.md` (user docs)
and `docs/reference/ui-card-architecture.md` (developer docs).

## Development Guidelines

### Do Not Reimplement Standard Libraries

**Never reimplement functionality that is available in popular, well-maintained npm packages.**

When you need functionality like YAML parsing, date handling, validation, etc.:
1. **Check if a popular package exists** - Look for packages with high weekly downloads and active maintenance
2. **Use the existing package** - Install it as a dependency rather than writing custom code
3. **Avoid obscure packages** - Stick to well-known, widely-used libraries in the ecosystem

Examples of packages to use instead of reimplementing:
- **YAML parsing**: `js-yaml` (not custom regex-based parsing)
- **Date handling**: `date-fns` or `dayjs` (not custom date utilities)
- **Deep cloning**: `lodash` or `structuredClone` (not custom recursive clone)
- **URL parsing**: Built-in `URL` API (not custom string splitting)
- **Schema validation**: `zod` or `yup` (not custom validators)

**Rationale**: Custom implementations are harder to maintain, often miss edge cases, and lack the battle-testing of popular libraries. The small bundle size savings rarely justify the maintenance burden and potential bugs.

## Current Priority

Dependency awareness and UI enhancements - see `docs/NEXT_STEPS.md` for details.
