# Next Steps - Fleet GitOps Extension

This document tracks the current development plan and priorities. **Read this first** when starting a new development session.

## Current Status

**Phase 1 (MVP)**: Complete
- Project setup, Fleet management, GitRepo management, status dashboard

**Phase 4 (Multi-Card Architecture)**: Partially complete
- Manifest system, card registry, drag-and-drop, edit mode
- Card types implemented: `gitrepo`, `markdown`, `placeholder`
- Card types defined but not implemented: `auth-github`, `auth-git`, `auth-appco`, `image`, `video`

---

## Priority 1: Authentication Cards (Blocking)

Essential for private Git repositories and enterprise use.

### Tasks

1. **Implement `auth-github` card** (`extension/ui/src/cards/AuthGitHubCard.tsx`)
   - GitHub Personal Access Token entry field
   - Token validation against GitHub API
   - Status display (configured/not configured, authenticated user info)
   - Store token in Kubernetes Secret (`fleet-local` namespace)

2. **Implement `auth-git` card** (`extension/ui/src/cards/AuthGitCard.tsx`)
   - Username/token authentication option
   - SSH key authentication option
   - Server URL field for self-hosted Git servers
   - Store credentials in Kubernetes Secret

3. **Kubernetes Secret integration** (add to `App.tsx` or new utility)
   - Create/update Secret with Git credentials
   - Reference Secret in GitRepo CR (`spec.clientSecretName`)
   - Detect existing credentials

4. **Card dependency system**
   - Add `required` setting to auth cards
   - Block GitRepo cards until auth is configured (for private repos)
   - Visual indication of blocked state

### Implementation Notes

- Use existing patterns from `MarkdownCard.tsx` and card registry
- Credentials stored as Kubernetes Secrets in `fleet-local` namespace
- GitRepo references credentials via `spec.clientSecretName`
- See `docs/reference/fleet-local-mode.md` for Secret format

---

## Priority 2: Dependency Awareness

Smart path handling to prevent user errors.

### Tasks

1. Parse `dependsOn` from `fleet.yaml` files (logic exists in `App.tsx`)
2. Display dependency info in path selection UI
3. Grey out/disable paths with unresolved dependencies
4. Auto-select in-repo dependencies when parent path enabled
5. Warn about external dependencies (CRDs from other sources)

---

## Priority 3: Complete Card System

### Remaining Card Types

- `image` card - Static image display
- `video` card - Embedded video content
- `auth-appco` card - SUSE Application Collection credentials

### Card Behaviors

- `duplicatable` setting with "Add Another" button
- Field-level `locked` and `editable` settings
- `allowed` path whitelist for gitrepo cards
- `required` setting for auth cards

---

## Priority 4: Edit Mode Enhancements

- Global Config card (app name, description, colors, logo)
- Card settings panel for type-specific configuration
- Better "Add Card" type picker UI
- Logo/icon upload with drag & drop

---

## Priority 5: Extension Builder (Enterprise)

- Generate Dockerfile from current configuration
- Generate manifest.yaml from current state
- Bundle assets for download ("Download Build Files")
- Direct Docker build via ddClient API ("Build Extension Now")

---

## Key Files Reference

### Core UI
| Purpose | File |
|---------|------|
| Main UI component | `extension/ui/src/App.tsx` (~790 lines) |
| Shared types | `extension/ui/src/types.ts` |

### Hooks (Business Logic)
| Purpose | File |
|---------|------|
| Fleet status & install | `extension/ui/src/hooks/useFleetStatus.ts` |
| GitRepo CRUD & polling | `extension/ui/src/hooks/useGitRepoManagement.ts` |
| Path discovery & caching | `extension/ui/src/hooks/usePathDiscovery.ts` |

### Components
| Purpose | File |
|---------|------|
| Drag-and-drop wrapper | `extension/ui/src/components/SortableCard.tsx` |
| Add repo dialog | `extension/ui/src/components/AddRepoDialog.tsx` |

### Cards
| Purpose | File |
|---------|------|
| Card registry | `extension/ui/src/cards/registry.ts` |
| Card wrapper | `extension/ui/src/cards/CardWrapper.tsx` |
| Markdown card | `extension/ui/src/cards/MarkdownCard.tsx` |

### Manifest
| Purpose | File |
|---------|------|
| Manifest types | `extension/ui/src/manifest/types.ts` |
| Manifest loader | `extension/ui/src/manifest/loader.ts` |

### Utilities
| Purpose | File |
|---------|------|
| Error handling | `extension/ui/src/utils/errors.ts` |
| GitHub API | `extension/ui/src/utils/github.ts` |
| Constants | `extension/ui/src/utils/constants.ts` |

---

## Technical Decisions

| Topic | Decision |
|-------|----------|
| Kubernetes context | Always `rancher-desktop` |
| Fleet namespace | `fleet-local` |
| Credential storage | Kubernetes Secrets (not extension storage) |
| Path discovery | GitHub API (not Fleet bundles) |
| Manifest parsing | Permissive (ignore unknown fields with warnings) |

---

## Documentation Structure

- `docs/NEXT_STEPS.md` - **You are here** - Development plan
- `docs/README.md` - Documentation index
- `docs/PRD.md` - Product requirements (features, UI mockups)
- `docs/reference/` - Technical reference docs
- `docs/background/` - External reference materials (wikis, etc.)
