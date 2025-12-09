# Test Suite Analysis and Fixes

This document tracks test issues discovered during a comprehensive test suite audit.

**Analysis Date**: 2025-12-09
**Files Analyzed**: 42 test files (5 backend, 32 UI unit tests, 5 E2E tests)

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

**All 115 backend tests now pass and verify actual production code.**

---

## Minor Issues - FIXED ✅

| Status | Location | Fix Applied |
|--------|----------|-------------|
| ✅ FIXED | `SortableCard.test.tsx` | Opacity test now uses controllable mock and verifies actual opacity value (0.5 during drag, 1 otherwise) |
| ✅ FIXED | `add-repo-dialog.spec.ts` | Replaced `waitForTimeout(500)` with helper that uses proper `waitFor` |
| ✅ FIXED | `drag-drop.spec.ts:71` | Changed `test.skip` to `test.fixme` with documentation about dnd-kit mouse event limitations |

---

## Missing Test Coverage (Lower Priority)

These items require external dependencies (K8s cluster, Docker daemon) and are deferred:

| Status | What's Missing |
|--------|----------------|
| 📝 DEFERRED | Integration tests for `GitRepoService` K8s operations - requires K8s cluster |
| 📝 DEFERRED | Integration tests for `FleetService` K8s operations - requires K8s cluster |
| 📝 DEFERRED | Integration tests for `GitService` methods (`discoverPaths`, `shallowClone`) - requires git repos |
| 📝 DEFERRED | Error handling paths in backend service public methods |

---

## Functions Exported for Testability - ✅ COMPLETE

The following functions were exported and unit tests were added:

### Backend - DONE ✅

| Status | File | Function | Tests Added |
|--------|------|----------|-------------|
| ✅ DONE | `build.ts` | `generateDockerfile()` | 7 tests in `build.test.ts` |
| ✅ DONE | `build.ts` | `createBuildContext()` | 7 tests in `build.test.ts` |
| ✅ DONE | `icons.ts` | `getMimeType()` | 9 tests in `icons.test.ts` |
| ✅ DONE | `icons.ts` | `matchesTarEntry()` | 9 tests in `icons.test.ts` |
| ✅ DONE | `git.ts` | `findFleetFiles()` | Used in integration tests in `git.test.ts` |
| ⏭️ SKIP | `icons.ts` | `extractFileFromTar()` | Kept private (tightly coupled to stream handling) |
| ⏭️ SKIP | `icons.ts` | `getIconPathFromMetadata()` | Kept private (tightly coupled to Docker API) |
| ⏭️ SKIP | `fleet.ts` | `getHelmJobStatus()` | Kept private (tightly coupled to K8s APIs) |

### UI - DONE ✅

| Status | File | Function | Notes |
|--------|------|----------|-------|
| ✅ DONE | `paletteGenerator.ts` | `buildUiPalette()` | Exported |
| ✅ DONE | `paletteGenerator.ts` | `isHighChromaHarmony()` | Exported (bonus) |
| ✅ DONE | `extensionBuilder.ts` | `getIconPath()` | Exported |
| ✅ DONE | `extensionBuilder.ts` | `isCustomIcon()` | Exported (bonus) |
| ✅ DONE | `colorExtractor.ts` | `isNearWhite()` | Exported |
| ✅ DONE | `colorExtractor.ts` | `isNearBlack()` | Exported |

### Export Pattern

```typescript
// Before (private method in class)
class BuildService {
  private generateDockerfile(config: BuildConfig): string { ... }
}

// After (exported function, class uses it)
export function generateDockerfile(config: BuildConfig): string { ... }

class BuildService {
  private buildImage(config: BuildConfig) {
    const dockerfile = generateDockerfile(config);  // uses exported function
    // ...
  }
}
```

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

### Phase 2: Fix Minor Issues - ✅ COMPLETE

1. ✅ Fixed SortableCard opacity test - now verifies actual opacity value
2. ✅ Replaced `waitForTimeout` with proper `waitFor` helper in E2E tests
3. ✅ Changed skipped drag-drop test to `test.fixme` with clear documentation

### Phase 3: Add Test Coverage - ✅ COMPLETE

1. ✅ Created `build.test.ts` with 14 tests for `generateDockerfile()` and `createBuildContext()`
2. ✅ Created `icons.test.ts` with 18 tests for `getMimeType()` and `matchesTarEntry()`
3. ✅ Updated `git.test.ts` to use exported `findFleetFiles()` instead of local duplicate
4. ✅ Total backend tests: 115 (up from 83)

### Remaining TODOs (Lower Priority)

1. Integration tests for K8s operations (`GitRepoService`, `FleetService`) - requires K8s cluster
2. Error handling path tests for backend service public methods
