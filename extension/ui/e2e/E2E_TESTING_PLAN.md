# E2E Testing Plan

This document outlines the prioritized plan for implementing E2E tests using Playwright for the Fleet GitOps extension.

## Overview

E2E tests complement our existing unit/component tests (Vitest + React Testing Library) by testing:
- **Real browser interactions** (drag-and-drop, hover effects, animations)
- **Multi-component flows** (dialogs, state management across components)
- **State persistence** (localStorage, page reload scenarios)
- **Visual feedback** (loading states, error messages, transitions)

## Current Implementation Status

### Completed
- [x] Playwright configuration (`playwright.config.ts`)
- [x] Test fixtures with mock infrastructure (`e2e/fixtures.ts`)
- [x] Edit mode cancel/apply tests (`e2e/edit-mode.spec.ts`)
- [x] Drag-and-drop reordering tests (`e2e/drag-drop.spec.ts`)
- [x] Add repository dialog tests (`e2e/add-repo-dialog.spec.ts`)
- [x] Data-testid attributes on SortableCard for reliable DnD targeting
- [x] GitHub auth card UI tests (`e2e/auth-github.spec.ts`)
- [x] AppCo auth card UI tests (`e2e/auth-appco.spec.ts`)

---

## Prioritized Test Implementation Plan

### Priority 1: Critical User Flows (High Value, High Risk)

These flows are essential to the core functionality and have complex state management that unit tests cannot fully verify.

#### 1.1 Edit Mode Lifecycle ✅ (Implemented)
**File:** `e2e/edit-mode.spec.ts`
- Enter/exit edit mode
- Snapshot/restore on Cancel
- Changes persist on Apply
- Title editing with Cancel/Apply

#### 1.2 Drag-and-Drop Card Reordering ✅ (Implemented)
**File:** `e2e/drag-drop.spec.ts`
- Reorder cards via drag handles
- Order persists to localStorage
- Order persists across page reload
- Cancel restores original order

#### 1.3 Add Repository Dialog ✅ (Implemented)
**File:** `e2e/add-repo-dialog.spec.ts`
- Open dialog from Configure Repository button
- Form validation (required fields)
- Loading state during submission
- Error display and recovery

---

### Priority 2: Authentication Flows (Medium-High Value)

#### 2.1 GitHub Authentication Flow ✅ (Implemented)
**File:** `e2e/auth-github.spec.ts`
- Display GitHub auth card with title
- Show description about authentication benefits
- Display PAT input section
- "Create token on GitHub" link with correct URL
- PAT input placeholder text
- Scope recommendations display

**Note:** Full authentication flow tests (PAT submission, credential storage) require complex CLI mocking and are deferred.

#### 2.2 AppCo Authentication Flow ✅ (Implemented)
**File:** `e2e/auth-appco.spec.ts`
- Display AppCo auth card with title
- Show description about AppCo authentication
- Display AppCo Credentials section
- Username and token input fields
- "Authenticate" button
- External links to AppCo (Get Account, Documentation)

**Note:** Form interaction tests require credential helper mocking and are deferred.

---

### Priority 3: Path Discovery and Dependencies (Medium Value) - Deferred

**Status:** Deferred - requires enhanced mock infrastructure for kubectl and GitRepo card rendering.

#### 3.1 Path Discovery Flow
**Suggested file:** `e2e/path-discovery.spec.ts`

```typescript
// Test scenarios:
- "Discover" button triggers path discovery
- Loading spinner during discovery
- Timeout warning after 30 seconds
- Retry button after timeout
- Path list appears on success
- Discovery error handling
```

**Why E2E:** Tests async operations with timeout handling, loading states.

#### 3.2 Dependency Confirmation Dialog
**Suggested file:** `e2e/dependency-dialog.spec.ts`

```typescript
// Test scenarios:
- Selecting path with dependencies opens dialog
- Dialog shows dependent paths from same/other repos
- "Cancel" closes without changes
- "Enable All" selects all dependencies
- Deselecting required path shows warning
```

**Why E2E:** Tests complex multi-repo state management, dialog flows.

---

### Priority 4: Extension Builder Features (Medium Value)

#### 4.1 Color Palette Editing
**Suggested file:** `e2e/palette-editing.spec.ts`

```typescript
// Test scenarios:
- Color picker opens on field click
- Color changes preview immediately
- Auto Palette menu hover shows preview
- Selecting harmony applies palette
- "Reset to Defaults" with confirmation
- Changes persist on Apply
```

**Why E2E:** Tests color picker interactions, hover previews.

#### 4.2 Load Configuration
**Suggested file:** `e2e/load-config.spec.ts`

```typescript
// Test scenarios:
- Load from Fleet extension image dropdown
- Refresh image list
- Load from ZIP file upload
- Success updates manifest and cards
- Error handling for invalid configs
```

**Why E2E:** Tests file upload, dropdown interactions.

#### 4.3 Build Extension
**Suggested file:** `e2e/build-extension.spec.ts`

```typescript
// Test scenarios:
- "Download ZIP" initiates download
- Build image name input validation
- "Build" shows progress output
- Build success shows install instructions
- Build error handling
```

**Why E2E:** Tests download initiation, streaming output display.

---

### Priority 5: Card Interactions (Lower Value - Partial Unit Coverage)

#### 5.1 Card Visibility Toggle
**Suggested file:** `e2e/card-visibility.spec.ts`

```typescript
// Test scenarios:
- Toggle visibility in edit mode
- Hidden cards not visible in view mode
- Hidden cards show differently in edit mode
- Visibility persists after Apply
```

#### 5.2 Placeholder Card Type Selection
**Suggested file:** `e2e/placeholder-cards.spec.ts`

```typescript
// Test scenarios:
- "Add card" button creates placeholder
- Type selection buttons appear
- Selecting type converts card
- Git Repository type opens dialog
- Placeholder removed on Cancel
```

#### 5.3 Individual Card Type Editing
**Suggested file:** `e2e/card-editing.spec.ts`

```typescript
// Test scenarios per card type:
- Markdown: content editing, preview
- HTML: source editing, preview
- Image: URL input, display
- Video: URL input, embed
- Link: URL/title editing
- Divider: style options (if any)
```

---

## Mock Strategy

### What We Mock

1. **Docker Extension API** (`@docker/extension-api-client`)
   - Already mocked via Vite alias in dev mode
   - Mock handles kubectl/helm command execution

2. **HTTP Requests** (via `page.route()`)
   - GitHub API calls (rate limit, repo contents)
   - AppCo API calls (authentication)

3. **localStorage**
   - Pre-seed state via `page.addInitScript()`
   - Verify state after operations

### What We Don't Mock

- React component rendering (real browser)
- CSS/styling (real browser)
- User interactions (real events)
- State management (React hooks)

---

## Running E2E Tests

### Local Development

```bash
cd extension/ui

# Install Playwright browsers (first time)
npx playwright install

# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- e2e/edit-mode.spec.ts

# Run in headed mode (visible browser)
npm run test:e2e -- --headed

# Run with UI mode (interactive)
npm run test:e2e -- --ui

# Debug a failing test
npm run test:e2e -- --debug
```

### CI Pipeline

E2E tests run in the CI workflow with:
- Chromium browser only (for speed)
- HTML report generation
- Screenshot on failure
- Trace on retry

---

## Test Data Patterns

### State Setup Patterns

```typescript
// 1. Clean slate (default manifest)
await clearLocalStorage(page);
await page.goto('/');

// 2. Pre-configured state
await setupLocalStorage(page, {
  manifest: { app: { name: 'My App' }, ... },
  cardOrder: ['fleet-status', 'card-1'],
  ...
});
await page.goto('/');

// 3. With specific repos (requires mocking kubectl responses)
// Use mock service configuration
```

### Assertion Patterns

```typescript
// Visual state
await expect(page.getByRole('button', { name: /apply/i })).toBeVisible();
await expect(page.getByTestId('card-1')).toHaveAttribute('data-testid', 'card-1');

// State persistence
const state = await getLocalStorageState(page);
expect(state?.cardOrder).toContain('new-card');

// After reload
await page.reload();
await expect(page.getByText('My Title')).toBeVisible();
```

---

## Estimated Implementation Effort

| Priority | Tests | Estimated Time | Value |
|----------|-------|----------------|-------|
| P1 | Edit Mode, DnD, Add Repo | **Done** | High |
| P2 | Auth flows (2 tests) | 4-6 hours | High |
| P3 | Path discovery, Dependencies | 4-6 hours | Medium |
| P4 | Palette, Load, Build | 6-8 hours | Medium |
| P5 | Card interactions | 4-6 hours | Low |

**Recommended approach:** Implement P2 next, as authentication is critical and commonly used.

---

## Future Considerations

### Visual Regression Testing
- Add `@playwright/test` screenshot comparisons
- Useful for palette/theme changes

### Performance Testing
- Measure render times for large card lists
- Monitor palette generation performance

### Accessibility Testing
- Add `@axe-core/playwright` for a11y checks
- Verify keyboard navigation

### Cross-Browser Testing
- Enable Firefox/WebKit in `playwright.config.ts`
- Currently Chromium-only for speed
