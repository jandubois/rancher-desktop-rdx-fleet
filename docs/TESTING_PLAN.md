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

### Phase 2: GitHub Utility Tests (github.ts)
- [ ] Write `utils/github.test.ts`
- [ ] `parseGitHubUrl()` tests:
  - [ ] Test: parses https://github.com/owner/repo
  - [ ] Test: parses https://github.com/owner/repo.git
  - [ ] Test: returns null for non-GitHub URLs
  - [ ] Test: handles URLs with extra paths
- [ ] `fetchFleetYamlDeps()` tests:
  - [ ] Test: parses dependsOn from fleet.yaml
  - [ ] Test: handles missing dependsOn
  - [ ] Test: tries fleet.yml fallback
  - [ ] Test: handles fetch errors
- [ ] `fetchGitHubPaths()` tests:
  - [ ] Test: finds paths with fleet.yaml
  - [ ] Test: tries main then master branch
  - [ ] Test: handles rate limiting (403)
  - [ ] Test: handles 404 errors
  - [ ] Test: fetches dependencies for each path

### Phase 3: usePathDiscovery Hook Tests
- [ ] Write `hooks/usePathDiscovery.test.ts`
- [ ] Test: initializes with empty cache
- [ ] Test: caches discovered paths
- [ ] Test: prevents duplicate requests
- [ ] Test: allows retry with isRetry flag
- [ ] Test: tracks discovery errors
- [ ] Test: tracks discovery start times
- [ ] Test: clearDiscoveryCache removes cached data

### Phase 4: useFleetStatus Hook Tests
- [ ] Write `hooks/useFleetStatus.test.ts`
- [ ] Test: starts with 'checking' status
- [ ] Test: detects Fleet CRD exists
- [ ] Test: detects Fleet controller running
- [ ] Test: returns 'not-installed' when CRD missing
- [ ] Test: returns 'not-installed' when pod not running
- [ ] Test: extracts Fleet version from helm list
- [ ] Test: calls onFleetReady callback when ready
- [ ] Test: handles check errors gracefully
- [ ] Test: installFleet calls helm commands in order
- [ ] Test: installFleet calls checkFleetStatus after install

### Phase 5: useGitRepoManagement Hook Tests
- [ ] Write `hooks/useGitRepoManagement.test.ts`
- [ ] Test: fetches GitRepos via kubectl
- [ ] Test: parses GitRepo status correctly
- [ ] Test: only updates state when data changes
- [ ] Test: calls onReposLoaded callback
- [ ] Test: addGitRepo creates resource via kubectl
- [ ] Test: addGitRepo rejects duplicate names
- [ ] Test: addGitRepo returns false on error
- [ ] Test: deleteGitRepo removes resource
- [ ] Test: updateGitRepoPaths updates optimistically
- [ ] Test: updateGitRepoPaths reverts on error
- [ ] Test: toggleRepoPath adds path when missing
- [ ] Test: toggleRepoPath removes path when present
- [ ] Test: auto-refreshes when repos unready
- [ ] Test: stops polling when all repos ready

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
