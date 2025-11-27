# UI Card Architecture

This document describes the card-based UI architecture implemented for the Fleet GitOps extension.

## Overview

The extension UI follows a **card-based architecture** where the main content area is composed of draggable, reorderable cards. This design:

- Provides a consistent visual hierarchy
- Enables drag-and-drop reordering via @dnd-kit
- Supports edit mode for customization
- Allows manifest-driven configuration

## Component Structure

```
extension/ui/src/
├── App.tsx                    # Main application with card rendering logic
├── manifest/
│   ├── index.ts               # Manifest loading
│   └── types.ts               # TypeScript types for manifest and cards
├── cards/
│   ├── index.ts               # Card exports
│   ├── registry.ts            # Card type registry
│   ├── types.ts               # Card component prop types
│   ├── CardWrapper.tsx        # Common card wrapper with edit controls
│   └── MarkdownCard.tsx       # Markdown content card
└── lib/
    └── ddClient.ts            # Docker Desktop SDK client
```

## Card Types

### Built-in Card Types

| Type | Description | Settings |
|------|-------------|----------|
| `gitrepo` | Git repository with path selection | `repo_url`, `branch`, `paths`, `max_visible_paths` |
| `markdown` | Rich text content | `content` (markdown string) |
| `image` | Static image display | `src`, `alt` |
| `video` | Embedded video | `src`, `title` |
| `placeholder` | Temporary card during type selection | (none) |
| `auth-github` | GitHub authentication | `required`, `show_status` |
| `auth-git` | Git credentials | `required`, `show_status` |
| `auth-appco` | AppCo authentication | `required`, `show_status` |

### Special Cards (Rendered in App.tsx)

| Card | Description |
|------|-------------|
| `fleet-status` | Shows Fleet installation status and version |
| `gitrepo-{name}` | Dynamic cards for each GitRepo resource |

## Layout Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Header Bar (NOT a card)                                    │
│  - Extension name from manifest.app.name                    │
│  - Edit mode toggle button                                  │
│  - bgcolor: primary.main                                    │
├─────────────────────────────────────────────────────────────┤
│  Scrollable Card Area                                       │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Fleet Status Card                                     │ │
│  │  - Status indicator (checking/running/error)           │ │
│  │  - Install button if not installed                     │ │
│  └───────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  GitRepo Card(s)                                       │ │
│  │  - Repository URL and branch                           │ │
│  │  - Path selection checkboxes                           │ │
│  │  - "+" button to add another repo                      │ │
│  │  - Delete button (if multiple repos exist)             │ │
│  └───────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Manifest Cards (markdown, image, video)               │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  [In Edit Mode: "Add card" buttons between each card]       │
└─────────────────────────────────────────────────────────────┘
```

## Drag and Drop

The UI uses **@dnd-kit** for drag-and-drop reordering:

### Dependencies
```json
{
  "@dnd-kit/core": "^6.x",
  "@dnd-kit/sortable": "^8.x",
  "@dnd-kit/utilities": "^3.x"
}
```

### Key Components

```typescript
// Sensors for mouse and keyboard
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
);

// Drag end handler
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (over && active.id !== over.id) {
    setCardOrder((items) => {
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);
      return arrayMove(items, oldIndex, newIndex);
    });
  }
};
```

### SortableCard Wrapper

Each card is wrapped in a `SortableCard` component that:
- Provides drag handle (visible in edit mode)
- Applies transform/transition during drag
- Shows opacity change when dragging

```typescript
function SortableCard({ id, editMode, children }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  // ...
}
```

## Edit Mode

When edit mode is enabled (`layout.edit_mode: true` in manifest):

1. **Drag handles** appear above each card
2. **"Add card" buttons** appear between cards
3. **Card controls** show visibility toggle, settings, delete
4. **Placeholder cards** can be inserted and converted to real types

### Placeholder Card Flow

1. User clicks "Add card" button below a card
2. A placeholder card is inserted at that position
3. Placeholder shows type selector (Markdown or Git Repository)
4. Selecting Markdown converts the placeholder in-place
5. Selecting Git Repository opens the add dialog and removes placeholder
6. Exiting edit mode removes unconverted placeholders

## GitRepo Card Features

### Path Discovery

The extension discovers available paths using the GitHub API:

```typescript
// Fetches git tree and finds fleet.yaml/fleet.yml files
async function fetchGitHubPaths(repoUrl: string, branch?: string): Promise<PathInfo[]>
```

- Uses GitHub's git trees API for efficient discovery
- Parses `dependsOn` from fleet.yaml for dependency tracking
- Caches results per repo URL
- Shows timeout warning after 30 seconds
- Supports retry on failure

### Path Selection

- Checkboxes for each discovered path
- Disabled paths show dependency information
- Scrollable list with configurable `max_visible_paths` (default: 6)

### Height Calculation

For the scrollable path list:
```typescript
maxHeight: maxVisiblePaths * 24  // ~24px per item (small checkbox + negative margin)
```

**Lesson learned**: MUI small Checkboxes with FormControlLabel and negative margin (`my: -0.25`) result in ~24px per item, not 26px. Don't add extra padding to the calculation.

### Add Repository Dialog

- Opens with default values: `fleet-examples` / `https://github.com/rancher/fleet-examples`
- Validates name uniqueness before creating
- Shows error if name already exists

```typescript
const openAddRepoDialog = () => {
  setNewRepoName('fleet-examples');
  setNewRepoUrl('https://github.com/rancher/fleet-examples');
  setNewRepoBranch('');
  setAddRepoError(null);
  setAddDialogOpen(true);
};
```

**Lesson learned**: Always use a helper function to open dialogs that need state initialization. Direct `setDialogOpen(true)` calls leave stale values from previous uses.

### Duplicate Prevention

```typescript
// Check if a repo with this name already exists
if (gitRepos.some((r) => r.name === newRepoName)) {
  setAddRepoError(`A repository named "${newRepoName}" already exists.`);
  return;
}
```

## Manifest System

### Loading

```typescript
export async function loadManifest(): Promise<Manifest> {
  // Try to load from /manifest.json, fall back to defaults
}
```

### Default Manifest

```typescript
export const DEFAULT_MANIFEST: Manifest = {
  version: '1.0',
  app: { name: 'Fleet GitOps' },
  layout: {
    show_fleet_status: true,
    show_activity_log: true,
    edit_mode: true,
  },
  cards: [
    { id: 'github-auth', type: 'auth-github', ... },
    { id: 'default-gitrepo', type: 'gitrepo', ... },
  ],
};
```

## Card Registry

Cards are registered in a global registry for dynamic rendering:

```typescript
// registry.ts
const cardRegistry = new Map<CardType, CardComponent>();

export function registerCard(type: CardType, component: CardComponent) {
  cardRegistry.set(type, component);
}

export function getCardComponent(type: CardType): CardComponent | undefined {
  return cardRegistry.get(type);
}
```

Cards self-register on import:
```typescript
// MarkdownCard.tsx
registerCard('markdown', MarkdownCard);
```

## State Management

### Card Order State

```typescript
// IDs of all cards in display order
const [cardOrder, setCardOrder] = useState<string[]>(['fleet-status']);

// Format: 'fleet-status', 'gitrepo-{name}', or manifest card IDs
```

### Syncing Card Order with Data

```typescript
useEffect(() => {
  setCardOrder((prev) => {
    // Keep existing order, add new items, remove deleted ones
    const allValidIds = new Set(['fleet-status', ...gitRepoIds, ...manifestCardIds]);
    const filtered = prev.filter((id) => allValidIds.has(id));
    const newIds = [...allValidIds].filter((id) => !existingIds.has(id));
    return [...filtered, ...newIds];
  });
}, [gitRepos, manifestCards]);
```

## Kubernetes Integration

### kubectl Usage Pattern

```typescript
await ddClient.extension.host?.cli.exec('kubectl', [
  '--context', KUBE_CONTEXT,
  'get', 'gitrepos', '-n', FLEET_NAMESPACE,
  '-o', 'json',
]);
```

### Creating Resources

```typescript
const gitRepoYaml = {
  apiVersion: 'fleet.cattle.io/v1alpha1',
  kind: 'GitRepo',
  metadata: { name, namespace: FLEET_NAMESPACE },
  spec: { repo, branch, paths },
};

await ddClient.extension.host?.cli.exec('kubectl', [
  '--apply-json', JSON.stringify(gitRepoYaml),
  '--context', KUBE_CONTEXT,
]);
```

## Lessons Learned

### UI/UX

1. **Separate header from cards**: The header bar (extension name, edit toggle) should NOT be a card. It's a fixed element with different styling (`bgcolor: primary.main`).

2. **Inline card creation**: In edit mode, "add card" buttons appear between cards so users can insert exactly where they want, avoiding drag-after-create.

3. **Conditional delete buttons**: Only show delete buttons when there's more than one item to prevent users from removing the last item accidentally.

4. **Default values for testing**: Keep convenient defaults (like `fleet-examples`) for easier testing, but add validation to prevent duplicates.

### Technical

1. **Dialog state initialization**: Always use a helper function to open dialogs that initialize form state. Never call `setDialogOpen(true)` directly if the dialog has form fields.

2. **Height calculations**: MUI component heights vary based on size props and margins. Test empirically rather than assuming pixel values.

3. **Optimistic updates**: For smooth UX, update local state immediately when modifying resources, then sync with server state on the next fetch.

4. **Ref vs State for caches**: Use refs (`useRef`) for data that shouldn't trigger re-renders (like loading flags), and state for data that should.

### Fleet-Specific

1. **Path discovery**: Use GitHub API instead of Fleet's internal mechanisms. Fleet bundles use hashed names that can't be reversed to original paths.

2. **GitRepo naming**: Kubernetes resource names must be unique within a namespace. Always validate before creating.

3. **Context specification**: Always specify `--context rancher-desktop` for kubectl commands to ensure correct cluster targeting.
