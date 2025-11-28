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

Implemented: `gitrepo`, `markdown`, `image`, `video`, `link`, `divider`, `placeholder`
Not yet implemented: `auth-github`, `auth-git`, `auth-appco`

**When adding/modifying card types**: Update both `docs/user-guide/card-types.md` (user docs)
and `docs/reference/ui-card-architecture.md` (developer docs).

## Current Priority

Authentication cards - see `docs/NEXT_STEPS.md` for implementation details.
