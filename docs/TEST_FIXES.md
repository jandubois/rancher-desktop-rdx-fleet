# Test Suite Analysis and Fixes

This document tracks test issues discovered during a comprehensive test suite audit.

**Analysis Date**: 2025-12-09
**Files Analyzed**: 40 test files (3 backend, 32 UI unit tests, 5 E2E tests)

---

## Critical Issues - FIXED ✅

### Backend Tests Don't Test Actual Code

~~The 3 backend test files were **fundamentally broken**.~~ **FIXED on 2025-12-09.**

The tests were re-implementing functionality instead of testing actual code. They have now been rewritten to import and test the actual exported functions.

| Status | File | Fix Applied |
|--------|------|-------------|
| ✅ FIXED | `gitrepos.test.ts` | Exports `parseGitRepoItem`, `buildGitRepoSpec`, `isNotFoundError` from gitrepos.ts - tests now import and verify actual code |
| ✅ FIXED | `git.test.ts` | Exports `extractDependsOn`, `buildAuthenticatedUrl`, `isFleetFile`, `shouldSkipDirectory`, `sanitizeUrl` from git.ts - tests now import and verify actual code |
| ✅ FIXED | `fleet.test.ts` | Exports `isNotFoundError`, `isConflictError`, `extractVersionFromImage`, `determineFleetStatus` from fleet.ts - tests now import and verify actual code |
| ✅ REMOVED | `fleet.test.ts` | Removed tests for non-existent `getNextState` state machine |
| ✅ BONUS | `fleet.ts:61-72` | Fixed real bug in `extractVersionFromImage` - failed for registry URLs with ports (e.g., `registry:5000/fleet:v1.0.0`) |

**All 83 backend tests now pass and verify actual production code.**

---

## Minor Issues

| Status | Location | Issue |
|--------|----------|-------|
| ⚠️ TODO | `SortableCard.test.tsx:83-104` | Opacity test uses `vi.doMock` incorrectly - doesn't verify opacity |
| ⚠️ TODO | `add-repo-dialog.spec.ts` | Uses `waitForTimeout(500)` - prone to race conditions |
| ⚠️ TODO | `drag-drop.spec.ts:71` | Test is `test.skip` - should be enabled or removed |

---

## Missing Test Coverage

| Status | What's Missing |
|--------|----------------|
| 📝 TODO | Integration tests for `GitRepoService` K8s operations (`listGitRepos`, `getGitRepo`, `applyGitRepo`, `deleteGitRepo`) |
| 📝 TODO | Integration tests for `FleetService` K8s operations (`installFleet`, `checkStatus`, etc.) |
| 📝 TODO | Integration tests for `GitService` methods (`discoverPaths`, `shallowClone`, `cleanup`) |
| 📝 TODO | Error handling paths in backend service public methods |

---

## UI Tests (Good Quality)

The 37 UI test files properly import and test the actual components/hooks/utilities:

- ✅ All card tests (ImageCard, LinkCard, MarkdownCard, etc.)
- ✅ All hook tests (usePathDiscovery, useGitRepoManagement, useDependencyResolver, etc.)
- ✅ All utility tests (colorExtractor, paletteGenerator, errors, etc.)
- ✅ All component tests (AddRepoDialog, EditRepoDialog, ConfirmDialog, etc.)
- ✅ All service tests (GitHubService, CredentialService, AppCoService)
- ✅ E2E tests (edit-mode, auth flows, drag-drop)

---

## Fix Plan

### Phase 1: Fix Backend Tests (Critical) - ✅ COMPLETE

1. ✅ **Exported utility functions** from backend services for testability
2. ✅ **Rewrote tests** to import and test actual functions
3. ✅ **Removed tests** for non-existent `getNextState` functionality
4. ✅ **Fixed real bug** in `extractVersionFromImage` discovered during testing

### Phase 2: Fix Minor Issues - TODO

1. Fix SortableCard opacity test
2. Replace `waitForTimeout` with proper Playwright waits
3. Either enable or remove skipped drag-drop test

### Phase 3: Add Missing Coverage - TODO

1. Add integration tests for backend K8s operations
2. Add error handling path tests
