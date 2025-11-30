# Next Steps - Fleet GitOps Extension

This document tracks the current development plan and priorities. **Read this first** when starting a new development session.

## Current Status

**Phase 1 (MVP)**: Complete
- Project setup, Fleet management, GitRepo management, status dashboard

**Phase 4 (Multi-Card Architecture)**: Partially complete
- Manifest system, card registry, drag-and-drop, edit mode
- Card types implemented: `gitrepo`, `markdown`, `image`, `video`, `link`, `divider`, `placeholder`
- Card types defined but not implemented: `auth-github`, `auth-git`, `auth-appco`

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

Smart path handling to prevent user errors. See **[bundle-dependencies.md](reference/bundle-dependencies.md)** for full technical details.

### Background: Bundle Naming

Fleet creates bundle names from: `<GitRepo-name>-<path-with-hyphens>`

**Critical**: The bundle name depends on `GitRepo.metadata.name`, NOT the Git URL. This means:
- We must track GitRepo names to compute bundle names
- Dependencies reference bundle names, not paths
- We need a registry mapping bundle names back to GitRepo/path pairs

### Phase 1: Bundle Registry

Build a global registry of bundle names from all configured GitRepos.

1. **Compute bundle names** for all discovered paths
   - Formula: `gitRepoName + '-' + path.replace(/\//g, '-')`
   - Store in `Map<bundleName, { gitRepoName, path, dependsOn }>`

2. **Track GitRepo names** in path discovery
   - Currently we only track paths; need to associate with GitRepo name
   - Update `PathInfo` type to include source GitRepo name

3. **Parse `dependsOn`** from fleet.yaml (existing code in `github.ts`)

### Phase 2: Dependency Resolution

Categorize and resolve dependencies before allowing selection.

1. **Categorize each dependency**:
   - **Same-repo**: In same GitRepo → auto-select
   - **Cross-repo**: In different configured GitRepo → warn, require manual selection
   - **External**: Not in any GitRepo → block selection

2. **Resolve transitive dependencies**
   - If A depends on B, and B depends on C, selecting A must also select B and C
   - Implement cycle detection to handle circular dependencies

3. **Validation function**:
   ```typescript
   function canSelectPath(path, gitRepo, registry): {
     canSelect: boolean;
     blockedBy?: string[];        // External deps that block selection
     willAutoSelect?: string[];   // Paths that will be auto-selected
   }
   ```

### Phase 3: UI Integration

Update path selection UI with dependency awareness.

1. **Block paths with external dependencies**
   - Disabled checkbox, grayed out
   - Tooltip: "Requires external bundle: X (not in any configured repository)"

2. **Show dependencies on selection**
   - When user checks a path, show confirmation if dependencies exist:
     "Will also enable: path1, path2, path3"
   - List includes transitive dependencies

3. **Auto-select dependencies**
   - When user confirms, check all dependency paths automatically
   - Works across GitRepos (cross-repo dependencies)

4. **Prevent deselection of required dependencies**
   - If path A depends on path B, user cannot uncheck B while A is checked
   - Show indicator: "Required by: A" next to protected paths
   - Tooltip explains why checkbox is disabled

5. **Visual indicators**:
   | State | Display |
   |-------|---------|
   | Normal | Standard checkbox |
   | Has dependencies | Shows dep count, expands on hover/select |
   | Auto-selected | Checked + "required by: X" label |
   | Blocked | Disabled + red warning icon |

### Phase 4: Direct Selection State (Future TODO)

**Deferred**: Implement three-state selection for automatic cleanup.

| State | Meaning |
|-------|---------|
| Unselected | Not deployed |
| Directly Selected | User explicitly chose this |
| Indirectly Selected | Auto-selected as dependency |

When all dependents of an indirectly-selected path are removed, that path can be automatically deselected. Users can "pin" an indirect selection to make it direct.

**Implementation notes for future**:
- Track `selectionState: 'direct' | 'indirect'` per path
- On deselection, check if any remaining selected paths depend on this one
- If not, and state is 'indirect', auto-deselect
- Add UI affordance to convert indirect → direct (pin icon?)

### Key Files to Modify

| File | Changes |
|------|---------|
| `extension/ui/src/types.ts` | Add `BundleInfo`, update `PathInfo` |
| `extension/ui/src/utils/github.ts` | Bundle name computation |
| `extension/ui/src/hooks/usePathDiscovery.ts` | Build bundle registry |
| `extension/ui/src/hooks/useDependencyResolver.ts` | **New**: Dependency resolution logic |
| `extension/ui/src/App.tsx` | Selection UI with dependency handling |

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
