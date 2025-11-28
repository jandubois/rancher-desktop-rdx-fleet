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

### Phase 6: Component Tests
- [ ] Write `components/AddRepoDialog.test.tsx`
  - [ ] Test: renders form fields
  - [ ] Test: validates required fields
  - [ ] Test: calls onAdd with form values
  - [ ] Test: displays error messages
  - [ ] Test: closes on cancel
  - [ ] Test: resets form on open
- [ ] Write `components/SortableCard.test.tsx`
  - [ ] Test: renders children
  - [ ] Test: shows drag handle in edit mode
  - [ ] Test: hides drag handle when not in edit mode
- [ ] Write `cards/MarkdownCard.test.tsx`
  - [ ] Test: renders markdown content
  - [ ] Test: shows edit textarea in edit mode

---

## File Structure

```
extension/ui/
├── src/
│   ├── __mocks__/
│   │   └── lib/
│   │       └── ddClient.ts
│   ├── utils/
│   │   ├── errors.ts
│   │   ├── errors.test.ts
│   │   ├── github.ts
│   │   └── github.test.ts
│   ├── hooks/
│   │   ├── useFleetStatus.ts
│   │   ├── useFleetStatus.test.ts
│   │   ├── useGitRepoManagement.ts
│   │   ├── useGitRepoManagement.test.ts
│   │   ├── usePathDiscovery.ts
│   │   └── usePathDiscovery.test.ts
│   └── components/
│       ├── AddRepoDialog.tsx
│       ├── AddRepoDialog.test.tsx
│       ├── SortableCard.tsx
│       └── SortableCard.test.tsx
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
