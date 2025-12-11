# Testing Plan - Fleet GitOps Extension

This document summarizes the test suite and remaining work.

## Testing Stack

| Tool | Purpose |
|------|---------|
| **Vitest** | Test runner for unit/component tests |
| **@testing-library/react** | Component testing |
| **@testing-library/user-event** | User interaction simulation |
| **msw** (Mock Service Worker) | API mocking |
| **Playwright** | E2E browser testing |

> **E2E Testing**: See [E2E Testing Plan](../extension/ui/e2e/E2E_TESTING_PLAN.md).

---

## Current Test Coverage

| Category | Coverage | Status |
|----------|----------|--------|
| **Utilities** | 4/6 files | errors, github, colorExtractor, paletteGenerator |
| **Hooks** | 5/5 files | ✅ Complete |
| **Components** | 6/7 files | EditModePanel pending |
| **Cards** | 7/7 files | ✅ Complete |
| **Theme** | 1/2 files | palette |

**Total: ~450+ tests across 23 test files**

---

## Test File Locations

```
extension/ui/src/
├── utils/
│   ├── errors.test.ts           ✅
│   ├── github.test.ts           ✅
│   ├── colorExtractor.test.ts   ✅
│   └── paletteGenerator.test.ts ✅
├── hooks/
│   ├── useFleetStatus.test.ts       ✅
│   ├── useGitRepoManagement.test.ts ✅
│   ├── usePathDiscovery.test.ts     ✅
│   ├── useDependencyResolver.test.ts ✅
│   └── usePalette.test.ts           ✅
├── components/
│   ├── AddRepoDialog.test.tsx       ✅
│   ├── SortableCard.test.tsx        ✅
│   ├── EditableTitle.test.tsx       ✅
│   ├── ConfirmDialog.test.tsx       ✅
│   ├── IconUpload.test.tsx          ✅
│   └── EditableHeaderIcon.test.tsx  ✅
├── cards/
│   ├── CardWrapper.test.tsx   ✅
│   ├── MarkdownCard.test.tsx  ✅
│   ├── HtmlCard.test.tsx      ✅
│   ├── ImageCard.test.tsx     ✅
│   ├── VideoCard.test.tsx     ✅
│   ├── LinkCard.test.tsx      ✅
│   └── DividerCard.test.tsx   ✅
└── theme/
    └── palette.test.ts        ✅
```

---

## Remaining Work

| Component | Priority | Notes |
|-----------|----------|-------|
| `EditModePanel.tsx` | Medium | Large, complex component |
| `extensionBuilder.ts` | Low | Enterprise feature |
| `App.tsx` integration | Low | Requires significant setup |

---

## Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage

# Specific file
npm test -- utils/errors.test.ts
```

---

## Mocking Strategy

### ddClient Mock
```typescript
// __mocks__/lib/ddClient.ts
export const ddClient = {
  extension: {
    host: { cli: { exec: vi.fn() } },
  },
};
```

### GitHub API Mock (msw)
```typescript
const handlers = [
  http.get('https://api.github.com/repos/:owner/:repo/git/trees/:branch', () => {
    return HttpResponse.json({ tree: [...] });
  }),
];
```

---

## Related Documentation

- [E2E Testing Plan](../extension/ui/e2e/E2E_TESTING_PLAN.md) - Playwright E2E tests
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture for developers
