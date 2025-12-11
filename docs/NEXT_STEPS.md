# Next Steps - Fleet GitOps Extension

This document tracks the remaining development work. Items are prioritized by impact and dependency order.

> **For architecture details**, see [ARCHITECTURE.md](ARCHITECTURE.md).
> **For product requirements**, see [PRD.md](PRD.md).

---

## Priority 1: Dependency-Aware Path Selection

Smart path handling to prevent user errors when bundles have dependencies.

**Background**: Fleet bundles can declare `dependsOn` in their `fleet.yaml`. If a user selects a bundle that depends on another bundle that isn't selected (or doesn't exist), the deployment will fail.

**Current State**: Backend can parse `dependsOn` from `fleet.yaml` files during path discovery. Frontend has a `useDependencyResolver` hook with bundle registry.

**Remaining Work**:
- [ ] Update path selection UI to show dependency relationships
- [ ] Block selection of paths with external (unresolvable) dependencies
- [ ] Auto-select dependencies when selecting a dependent path
- [ ] Prevent deselection of paths required by other selected paths
- [ ] Visual indicators (warning icons, "required by" labels)

**Reference**: [bundle-dependencies.md](reference/bundle-dependencies.md)

---

## Priority 2: Generic Git Authentication Card

The `auth-git` card type is defined but not implemented. This enables private repositories on self-hosted Git servers.

**Current State**: `auth-github` and `auth-appco` cards are complete and working.

**Remaining Work**:
- [ ] Implement `AuthGitCard` component (`extension/ui/src/cards/AuthGitCard.tsx`)
- [ ] Support username/token authentication
- [ ] Support SSH key authentication (optional, can be deferred)
- [ ] Server URL field for self-hosted Git servers
- [ ] Store credentials in Kubernetes Secret (backend already has secrets service)

---

## Priority 3: Edit Mode Enhancements

Improve the visual extension builder experience.

**Current State**: Basic edit mode works with drag-and-drop card reordering and card deletion.

**Remaining Work**:
- [ ] Global Config card (app name, description, primary color, logo upload)
- [ ] Card settings panel for type-specific configuration
- [ ] Better "Add Card" type picker UI (currently just a dropdown)
- [ ] Logo/icon upload with drag & drop

---

## Priority 4: Extension Builder Export

Enable users to package customized extensions for distribution.

**Current State**: Extension can be customized via manifest.yaml, but there's no UI to export the configuration.

**Remaining Work**:
- [ ] "Download Build Files" button - generates ZIP with Dockerfile + manifest.yaml + assets
- [ ] "Build Extension Now" button - direct Docker build via ddClient API with progress
- [ ] Import from existing extension image (extract manifest/assets)

---

## Priority 5: Fleet Robustness

Handle edge cases in cluster lifecycle.

**Current State**: Fleet auto-installs on backend startup and reports status accurately.

**Remaining Work**:
- [ ] Periodic Fleet health check (detect controller crashes, update state to 'error')
- [ ] Detect cluster recreation and trigger Fleet reinstall
- [ ] Handle kubeconfig changes (reload on auth errors)

---

## Priority 6: Backend Integration Tests

Unit tests cover exported functions; integration tests require external dependencies.

**Remaining Work** (lower priority - requires K8s cluster):
- [ ] Integration tests for `GitRepoService` K8s operations
- [ ] Integration tests for `FleetService` K8s operations
- [ ] Integration tests for `GitService.discoverPaths()` with real git repos

---

## Technical Decisions

| Topic | Decision |
|-------|----------|
| Kubernetes context | Always `rancher-desktop` |
| Fleet namespace | `fleet-local` |
| Credential storage | Docker credential helpers (via host scripts) |
| Path discovery | Backend shallow clone (provider agnostic) |
| Manifest parsing | Permissive (ignore unknown fields with warnings) |

---

## Related Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture for developers
- [PRD.md](PRD.md) - Product requirements and feature specifications
- [reference/](reference/) - Technical reference documentation
