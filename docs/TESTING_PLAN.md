# Testing Plan - Fleet GitOps Extension

This document tracks the testing implementation plan and progress.

## Testing Stack

| Tool | Purpose |
|------|---------|
| **Vitest** | Test runner (integrates with Vite) |
| **@testing-library/react** | Component testing |
| **@testing-library/user-event** | User interaction simulation |
| **msw** (Mock Service Worker) | API mocking for GitHub calls |

---

## Current Test Coverage Summary

| Category | Files | Test Files | Coverage |
|----------|-------|------------|----------|
| **Utilities** | 6 | 4 | 67% (errors, github, colorExtractor, paletteGenerator) |
| **Hooks** | 5 | 5 | 100% ✅ |
| **Components** | 7 | 6 | 86% (EditableTitle, SortableCard, AddRepoDialog, ConfirmDialog, IconUpload, EditableHeaderIcon) |
| **Cards** | 7 | 7 | 100% ✅ |
| **Theme** | 2 | 1 | 50% (palette) |
| **Main App** | 1 | 0 | 0% ❌ |

**Total Test Files:** 23
**Total Test Cases:** 452 tests

---

## Implementation Checklist

### Phase 1: Setup + Utility Tests (errors.ts) ✅ COMPLETE
- [x] Install vitest and testing dependencies
- [x] Create vitest.config.ts
- [x] Create vitest.setup.ts
- [x] Create ddClient mock (`__mocks__/lib/ddClient.ts`)
- [x] Add test script to package.json
- [x] Write `utils/errors.test.ts` (11 tests)
  - [x] Test: extracts message from Error object
  - [x] Test: extracts stderr from exec result
  - [x] Test: extracts message property from objects
  - [x] Test: prefers stderr over message
  - [x] Test: JSON stringifies unknown objects
  - [x] Test: handles plain strings
  - [x] Test: handles numbers
  - [x] Test: handles null
  - [x] Test: handles undefined
  - [x] Test: handles empty string
  - [x] Test: handles empty object

### Phase 2: GitHub Utility Tests (github.ts) ✅ COMPLETE
- [x] Write `utils/github.test.ts` (22 tests)
- [x] `parseGitHubUrl()` tests:
  - [x] Test: parses https://github.com/owner/repo
  - [x] Test: parses https://github.com/owner/repo.git
  - [x] Test: returns null for non-GitHub URLs
  - [x] Test: handles URLs with extra paths
  - [x] Test: handles github.com without https prefix
  - [x] Test: handles SSH-style URLs (returns null - not supported)
- [x] `fetchFleetYamlDeps()` tests:
  - [x] Test: parses dependsOn with "- name: bundlename" format
  - [x] Test: parses dependsOn with "- bundlename" format
  - [x] Test: handles missing dependsOn section
  - [x] Test: tries fleet.yml when fleet.yaml not found
  - [x] Test: returns undefined when both files not found
  - [x] Test: handles empty path (root directory)
- [x] `fetchGitHubPaths()` tests:
  - [x] Test: finds paths containing fleet.yaml files
  - [x] Test: also finds fleet.yml files
  - [x] Test: tries master then main branch when no branch specified
  - [x] Test: uses specified branch only
  - [x] Test: throws error for rate limiting (403)
  - [x] Test: throws error for non-GitHub URLs
  - [x] Test: throws error when all branches return 404
  - [x] Test: fetches dependencies for each path
  - [x] Test: excludes root-level fleet.yaml (path = ".")
  - [x] Test: handles invalid API response (no tree)

### Phase 3: usePathDiscovery Hook Tests ✅ COMPLETE
- [x] Write `hooks/usePathDiscovery.test.ts` (13 tests)
- [x] Test: initializes with empty cache and no errors
- [x] Test: caches discovered paths after successful fetch
- [x] Test: passes branch parameter to fetchGitHubPaths
- [x] Test: prevents duplicate requests for the same repo
- [x] Test: allows retry with isRetry flag even when cached
- [x] Test: tracks discovery errors when fetch fails
- [x] Test: tracks discovery start times during loading
- [x] Test: clearDiscoveryCache removes cached data and errors
- [x] Test: clearDiscoveryCache clears errors
- [x] Test: isLoadingPaths returns true while loading
- [x] Test: handles multiple repos independently
- [x] Test: clears previous error on retry
- [x] Test: prevents concurrent duplicate requests while loading

### Phase 4: useFleetStatus Hook Tests ✅ COMPLETE
- [x] Write `hooks/useFleetStatus.test.ts` (15 tests)
- [x] Test: starts with 'checking' status
- [x] Test: detects Fleet when CRD exists and controller is running
- [x] Test: returns 'not-installed' when CRD does not exist
- [x] Test: returns 'not-installed' when CRD check throws NotFound error
- [x] Test: returns 'not-installed' when pod is not running
- [x] Test: extracts Fleet version from helm list
- [x] Test: uses chart name when app_version is missing
- [x] Test: sets version to "unknown" when helm list fails to parse
- [x] Test: calls onFleetReady callback when Fleet is running
- [x] Test: returns error status when check throws unexpected error
- [x] Test: installFleet calls helm commands in correct order
- [x] Test: sets installing to true during installation
- [x] Test: sets error status when installation fails
- [x] Test: checkFleetStatus can be called manually
- [x] Test: handles CRD check with stderr error

### Phase 5: useGitRepoManagement Hook Tests ✅ COMPLETE
- [x] Write `hooks/useGitRepoManagement.test.ts` (20 tests)
- [x] Test: initializes with empty repos and no error
- [x] Test: fetches GitRepos via kubectl
- [x] Test: parses GitRepo status correctly
- [x] Test: only updates state when data changes
- [x] Test: calls onReposLoaded callback when repos change
- [x] Test: addGitRepo creates resource via kubectl
- [x] Test: addGitRepo rejects duplicate names
- [x] Test: addGitRepo returns false on error
- [x] Test: addGitRepo returns false when name is empty
- [x] Test: deleteGitRepo removes resource via kubectl
- [x] Test: updateGitRepoPaths updates optimistically
- [x] Test: updateGitRepoPaths sets error on failure
- [x] Test: toggleRepoPath adds path when missing
- [x] Test: toggleRepoPath removes path when present
- [x] Test: clearRepoError clears the error
- [x] Test: sets loadingRepos to true while fetching
- [x] Test: handles "No resources found" error gracefully
- [x] Test: handles fetch error and sets repoError
- [x] Test: sets up refresh interval for unready repos
- [x] Test: detects ready status correctly

### Phase 6: Component Tests ✅ COMPLETE
- [x] Write `components/AddRepoDialog.test.tsx` (14 tests)
  - [x] Test: renders form fields
  - [x] Test: renders dialog title
  - [x] Test: has default values for name and URL
  - [x] Test: calls onAdd with form values
  - [x] Test: calls onAdd with undefined branch when empty
  - [x] Test: closes dialog on successful add
  - [x] Test: displays error message when add fails
  - [x] Test: displays error message when add throws
  - [x] Test: closes on cancel
  - [x] Test: disables add button when name is empty
  - [x] Test: disables add button when URL is empty
  - [x] Test: shows "Adding..." text while submitting
  - [x] Test: does not render when closed
  - [x] Test: shows helper text for fields
- [x] Write `components/SortableCard.test.tsx` (5 tests)
  - [x] Test: renders children
  - [x] Test: shows drag handle in edit mode
  - [x] Test: hides drag handle when not in edit mode
  - [x] Test: renders multiple children
  - [x] Test: applies reduced opacity when dragging
- [x] Write `components/EditableTitle.test.tsx` (13 tests)
  - [x] Test: renders title text in display mode
  - [x] Test: renders input in edit mode
  - [x] Test: shows correct typography variant
  - [x] Test: calls onChange when input value changes
  - [x] Test: displays placeholder when title is empty
  - [x] Test: shows length warning for titles over 20 characters
  - [x] Test: renders children alongside title
  - [x] Test: handles various typography variants (h3, h4, h5, h6)

### Phase 7: Additional Utility Tests ✅ COMPLETE
- [x] Write `utils/colorExtractor.test.ts` (8 tests)
  - [x] Test: extracts dominant color from image data
  - [x] Test: handles images with transparent pixels
  - [x] Test: generates harmony variations
  - [x] Test: handles edge cases (empty images, single pixels)
  - [x] Test: calculates color brightness correctly
  - [x] Test: handles very dark and very light images
- [x] Write `utils/paletteGenerator.test.ts` (14 tests)
  - [x] Test: generates palette from primary color
  - [x] Test: creates complementary colors
  - [x] Test: creates analogous colors
  - [x] Test: creates triadic colors
  - [x] Test: handles HSL conversions
  - [x] Test: generates accessible color combinations
  - [x] Test: falls back to named colors

### Phase 8: Additional Hook Tests ✅ COMPLETE
- [x] Write `hooks/useDependencyResolver.test.ts` (10 tests)
  - [x] Test: builds bundle registry from paths
  - [x] Test: categorizes dependencies correctly
  - [x] Test: resolves transitive dependencies
  - [x] Test: detects circular dependencies
  - [x] Test: validates selected bundles
  - [x] Test: handles missing dependencies gracefully
- [x] Write `hooks/usePalette.test.ts` (6 tests)
  - [x] Test: returns palette from manifest
  - [x] Test: returns default palette when manifest has no palette
  - [x] Test: memoizes result correctly
  - [x] Test: handles partial palette overrides

### Phase 9: Theme Tests ✅ COMPLETE
- [x] Write `theme/palette.test.ts` (10 tests)
  - [x] Test: resolves palette with defaults
  - [x] Test: merges custom colors correctly
  - [x] Test: validates color formats
  - [x] Test: handles undefined values

---

## Outstanding Test Coverage (TODO)

### Phase 10: Card Type Tests ✅ COMPLETE
Priority: **HIGH** - Cards are the core UI components

#### CardWrapper.tsx (Base wrapper for all cards) ✅ COMPLETE
- [x] Write `cards/CardWrapper.test.tsx` (22 tests)
  - [x] Test: renders children content
  - [x] Test: shows edit controls in edit mode
  - [x] Test: hides edit controls in view mode
  - [x] Test: shows visibility toggle in edit mode
  - [x] Test: calls onDelete when delete button clicked
  - [x] Test: calls onToggleVisibility when visibility toggled
  - [x] Test: applies palette colors correctly
  - [x] Test: handles hidden cards (renders null in view mode)
  - [x] Test: handles disabled cards appropriately
  - [x] Test: special handling for divider cards (no Paper in view mode)

#### MarkdownCard.tsx ✅ COMPLETE
- [x] Write `cards/MarkdownCard.test.tsx` (26 tests)
  - [x] Test: renders markdown content correctly
  - [x] Test: shows editor in edit mode
  - [x] Test: shows rendered preview in edit mode
  - [x] Test: shows rendered content in view mode
  - [x] Test: calls onSettingsChange when content edited
  - [x] Test: handles empty content gracefully
  - [x] Test: renders code blocks
  - [x] Test: renders links, lists, headers correctly
  - [x] Test: renders bold, italic, inline code

#### HtmlCard.tsx ✅ COMPLETE
- [x] Write `cards/HtmlCard.test.tsx` (17 tests)
  - [x] Test: renders iframe when content provided
  - [x] Test: returns null when content is empty
  - [x] Test: shows HTML editor in edit mode
  - [x] Test: shows preview section when content provided
  - [x] Test: sets iframe title from definition
  - [x] Test: handles empty content
  - [x] Test: shows preview in edit mode
  - [x] Test: calls onSettingsChange when content edited

#### ImageCard.tsx ✅ COMPLETE
- [x] Write `cards/ImageCard.test.tsx` (24 tests)
  - [x] Test: renders image with correct src
  - [x] Test: shows URL input in edit mode
  - [x] Test: shows alt text input in edit mode
  - [x] Test: calls onSettingsChange with new URL
  - [x] Test: handles image load errors
  - [x] Test: shows placeholder when no image configured
  - [x] Test: handles empty URL
  - [x] Test: displays card title when provided

#### VideoCard.tsx ✅ COMPLETE
- [x] Write `cards/VideoCard.test.tsx` (36 tests)
  - [x] Test: renders YouTube embed from URL
  - [x] Test: renders Vimeo embed from URL
  - [x] Test: renders direct video element for .mp4/.webm
  - [x] Test: parses YouTube URL formats (watch, youtu.be, embed)
  - [x] Test: parses Vimeo URL formats
  - [x] Test: shows URL input in edit mode
  - [x] Test: handles invalid video URLs
  - [x] Test: handles empty URL
  - [x] Test: iframe attributes (allowFullScreen, allow)

#### LinkCard.tsx ✅ COMPLETE
- [x] Write `cards/LinkCard.test.tsx` (30 tests)
  - [x] Test: renders links as buttons (default)
  - [x] Test: renders links as list when configured
  - [x] Test: shows add link button in edit mode
  - [x] Test: allows editing link URL
  - [x] Test: allows editing link label
  - [x] Test: allows removing links
  - [x] Test: handles empty links array
  - [x] Test: filters invalid links (missing label/url)
  - [x] Test: opens links in new tab with noopener noreferrer

#### DividerCard.tsx ✅ COMPLETE
- [x] Write `cards/DividerCard.test.tsx` (25 tests)
  - [x] Test: renders solid divider by default
  - [x] Test: renders dashed divider when configured
  - [x] Test: renders dotted divider when configured
  - [x] Test: shows label when provided
  - [x] Test: shows style selector in edit mode
  - [x] Test: shows label input in edit mode
  - [x] Test: calls onSettingsChange when style changed
  - [x] Test: calls onSettingsChange when label changed
  - [x] Test: shows preview in edit mode

### Phase 11: Additional Component Tests ⏳ IN PROGRESS
Priority: **MEDIUM** - Support components for edit functionality

#### ConfirmDialog.tsx ✅ COMPLETE
- [x] Write `components/ConfirmDialog.test.tsx` (15 tests)
  - [x] Test: renders dialog title
  - [x] Test: renders dialog message
  - [x] Test: renders confirm button with label
  - [x] Test: renders cancel button with label
  - [x] Test: calls onConfirm when confirm clicked
  - [x] Test: calls onCancel when cancel clicked
  - [x] Test: applies confirm button color (primary, error, warning, success)
  - [x] Test: does not render when open is false

#### IconUpload.tsx ✅ COMPLETE
- [x] Write `components/IconUpload.test.tsx` (17 tests)
  - [x] Test: renders Extension Icon label and upload instructions
  - [x] Test: accepts PNG, SVG, JPEG, GIF, WebP files
  - [x] Test: rejects invalid file types
  - [x] Test: validates file size (512KB max)
  - [x] Test: shows preview of current/default icon
  - [x] Test: shows delete button when custom icon exists
  - [x] Test: shows error for oversized files
  - [x] Test: supports drag and drop

#### EditableHeaderIcon.tsx ✅ COMPLETE
- [x] Write `components/EditableHeaderIcon.test.tsx` (22 tests)
  - [x] Test: renders default Fleet icon when no custom icon
  - [x] Test: renders custom icon when provided
  - [x] Test: returns null in view mode when deleted
  - [x] Test: shows delete button on hover in edit mode
  - [x] Test: shows add icon placeholder when deleted in edit mode
  - [x] Test: calls onChange with "deleted" when delete clicked
  - [x] Test: validates file types and sizes
  - [x] Test: supports drag and drop in edit mode

#### EditModePanel.tsx ⏳ NOT STARTED (Large, complex component)
- [ ] Write `components/EditModePanel.test.tsx`
  - [ ] Test: renders card list
  - [ ] Test: shows card type icons
  - [ ] Test: allows selecting card type for new card
  - [ ] Test: shows card settings when card selected
  - [ ] Test: renders title input for cards
  - [ ] Test: renders content editor for cards
  - [ ] Test: shows visibility toggle
  - [ ] Test: shows delete button
  - [ ] Test: handles card reordering (drag-drop)

### Phase 12: Utility Tests ⏳ NOT STARTED
Priority: **LOW** - Enterprise feature, complex to test

#### extensionBuilder.ts
- [ ] Write `utils/extensionBuilder.test.ts`
  - [ ] Test: generates valid Dockerfile
  - [ ] Test: includes all required assets
  - [ ] Test: handles custom icon
  - [ ] Test: handles manifest configuration
  - [ ] Test: validates output structure
  - [ ] Test: handles missing optional fields

### Phase 13: Integration Tests ⏳ FUTURE
Priority: **LOW** - Requires significant setup

#### App.tsx
- [ ] Write `App.test.tsx` (integration tests)
  - [ ] Test: renders without crashing
  - [ ] Test: loads manifest on mount
  - [ ] Test: renders cards from manifest
  - [ ] Test: enters edit mode correctly
  - [ ] Test: exits edit mode and saves
  - [ ] Test: handles drag-and-drop reordering
  - [ ] Test: integrates with Fleet status
  - [ ] Test: integrates with GitRepo management

---

## Test Priority Summary

| Priority | Phase | Component Count | Status |
|----------|-------|-----------------|--------|
| **HIGH** | Phase 10: Card Types | 7 cards | ✅ 7/7 complete (180 tests) |
| **MEDIUM** | Phase 11: Components | 4 components | 3/4 complete (54 tests) |
| **LOW** | Phase 12: extensionBuilder | 1 utility | 0/1 complete |
| **LOW** | Phase 13: App Integration | 1 main app | 0/1 complete |

**Remaining:** EditModePanel (complex), extensionBuilder, App integration

---

## File Structure

```
extension/ui/
├── src/
│   ├── __mocks__/
│   │   ├── docker-extension-api-client.ts
│   │   └── lib/
│   │       └── ddClient.ts
│   ├── utils/
│   │   ├── errors.ts
│   │   ├── errors.test.ts               ✅
│   │   ├── github.ts
│   │   ├── github.test.ts               ✅
│   │   ├── colorExtractor.ts
│   │   ├── colorExtractor.test.ts       ✅
│   │   ├── paletteGenerator.ts
│   │   ├── paletteGenerator.test.ts     ✅
│   │   ├── extensionBuilder.ts          ❌ NEEDS TESTS
│   │   └── constants.ts
│   ├── hooks/
│   │   ├── useFleetStatus.ts
│   │   ├── useFleetStatus.test.ts       ✅
│   │   ├── useGitRepoManagement.ts
│   │   ├── useGitRepoManagement.test.ts ✅
│   │   ├── usePathDiscovery.ts
│   │   ├── usePathDiscovery.test.ts     ✅
│   │   ├── useDependencyResolver.ts
│   │   ├── useDependencyResolver.test.ts ✅
│   │   ├── usePalette.ts
│   │   └── usePalette.test.ts           ✅
│   ├── components/
│   │   ├── AddRepoDialog.tsx
│   │   ├── AddRepoDialog.test.tsx       ✅
│   │   ├── SortableCard.tsx
│   │   ├── SortableCard.test.tsx        ✅
│   │   ├── EditableTitle.tsx
│   │   ├── EditableTitle.test.tsx       ✅
│   │   ├── ConfirmDialog.tsx
│   │   ├── ConfirmDialog.test.tsx       ✅
│   │   ├── IconUpload.tsx
│   │   ├── IconUpload.test.tsx          ✅
│   │   ├── EditableHeaderIcon.tsx
│   │   ├── EditableHeaderIcon.test.tsx  ✅
│   │   └── EditModePanel.tsx            ❌ NEEDS TESTS
│   ├── cards/
│   │   ├── CardWrapper.tsx
│   │   ├── CardWrapper.test.tsx         ✅
│   │   ├── MarkdownCard.tsx
│   │   ├── MarkdownCard.test.tsx        ✅
│   │   ├── HtmlCard.tsx
│   │   ├── HtmlCard.test.tsx            ✅
│   │   ├── ImageCard.tsx
│   │   ├── ImageCard.test.tsx           ✅
│   │   ├── VideoCard.tsx
│   │   ├── VideoCard.test.tsx           ✅
│   │   ├── LinkCard.tsx
│   │   ├── LinkCard.test.tsx            ✅
│   │   ├── DividerCard.tsx
│   │   ├── DividerCard.test.tsx         ✅
│   │   ├── registry.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── theme/
│   │   ├── palette.ts
│   │   └── palette.test.ts              ✅
│   ├── manifest/
│   │   ├── types.ts
│   │   ├── loader.ts
│   │   └── index.ts
│   ├── App.tsx                          ❌ NEEDS TESTS (integration)
│   └── main.tsx
├── vitest.config.ts
└── vitest.setup.ts
```

---

## Mocking Strategy

### ddClient Mock
Used for all kubectl/helm CLI calls:
```typescript
export const ddClient = {
  extension: {
    host: {
      cli: {
        exec: vi.fn(),
      },
    },
  },
};
```

### GitHub API Mock (msw)
Used for `fetchGitHubPaths` and `fetchFleetYamlDeps`:
```typescript
const handlers = [
  http.get('https://api.github.com/repos/:owner/:repo/git/trees/:branch', () => {
    return HttpResponse.json({ tree: [...] });
  }),
  http.get('https://raw.githubusercontent.com/:owner/:repo/:branch/*', () => {
    return new HttpResponse('dependsOn:\n  - name: dep1');
  }),
];
```

---

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- utils/errors.test.ts
```

---

## CI Integration

Add to GitHub Actions workflow:
```yaml
- name: Run Tests
  run: |
    cd extension/ui
    npm ci
    npm run test:coverage
```

---

## Recommended Implementation Order

Based on complexity, dependencies, and value, here's the suggested order for implementing remaining tests:

### Sprint 1: Card Types (High Value, Medium Complexity)
1. **CardWrapper.tsx** - Foundation for all cards, test first
2. **DividerCard.tsx** - Simplest card, good starting point
3. **ImageCard.tsx** - Simple display logic
4. **MarkdownCard.tsx** - Depends on external library (react-markdown)
5. **VideoCard.tsx** - URL parsing logic is testable
6. **LinkCard.tsx** - State management for link arrays
7. **HtmlCard.tsx** - Most complex (iframe, height calculation)

### Sprint 2: Components (Medium Value, Varying Complexity)
1. **ConfirmDialog.tsx** - Simple, quick win
2. **IconUpload.tsx** - File validation logic
3. **EditableHeaderIcon.tsx** - Depends on IconUpload
4. **EditModePanel.tsx** - Large component, may need to break into smaller tests

### Sprint 3: Utilities & Integration (Lower Priority)
1. **extensionBuilder.ts** - Complex, enterprise feature
2. **App.tsx** - Integration tests, requires significant mock setup

---

## Testing Patterns Reference

### Card Component Test Pattern
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardName } from './CardName';

describe('CardName', () => {
  const defaultProps = {
    content: 'test content',
    settings: {},
    isEditMode: false,
    onContentChange: vi.fn(),
    onSettingsChange: vi.fn(),
  };

  it('renders content in view mode', () => {
    render(<CardName {...defaultProps} />);
    expect(screen.getByText('test content')).toBeInTheDocument();
  });

  it('shows editor in edit mode', () => {
    render(<CardName {...defaultProps} isEditMode={true} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('calls onContentChange when edited', async () => {
    const user = userEvent.setup();
    render(<CardName {...defaultProps} isEditMode={true} />);
    await user.type(screen.getByRole('textbox'), 'new content');
    expect(defaultProps.onContentChange).toHaveBeenCalled();
  });
});
```

### Component with File Upload Test Pattern
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('IconUpload', () => {
  it('accepts valid file types', async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    render(<IconUpload onUpload={onUpload} />);

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const input = screen.getByLabelText(/upload/i);
    await user.upload(input, file);

    expect(onUpload).toHaveBeenCalled();
  });
});
```
