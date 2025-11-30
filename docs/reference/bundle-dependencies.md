# Bundle Naming and Dependency Resolution

This document explains how Fleet names bundles, how dependencies are declared and resolved, and how the extension handles dependency management.

## Bundle Naming Convention

Fleet automatically generates bundle names from the GitRepo resource name and the path within the repository.

### Naming Formula

```
<GitRepo-metadata.name>-<path-with-slashes-replaced-by-hyphens>
```

### Examples

| GitRepo Name | Path | Resulting Bundle Name |
|--------------|------|----------------------|
| `my-repo` | `apps/frontend` | `my-repo-apps-frontend` |
| `my-repo` | `infra/database` | `my-repo-infra-database` |
| `config` | `monitoring/prometheus` | `config-monitoring-prometheus` |
| `one` | `multi-cluster/hello-world` | `one-multi-cluster-hello-world` |

### Critical Implication

**The bundle name depends on the GitRepo resource name, NOT the Git repository URL.**

Two GitRepos pointing to the same GitHub repository but with different `metadata.name` values will produce different bundle names:

```yaml
# This GitRepo...
apiVersion: fleet.cattle.io/v1alpha1
kind: GitRepo
metadata:
  name: production    # <-- This name determines bundle naming
  namespace: fleet-local
spec:
  repo: https://github.com/org/config
  paths: [apps/frontend]
# ...creates bundle: production-apps-frontend

# This GitRepo pointing to SAME repo...
apiVersion: fleet.cattle.io/v1alpha1
kind: GitRepo
metadata:
  name: staging       # <-- Different name = different bundle names
  namespace: fleet-local
spec:
  repo: https://github.com/org/config
  paths: [apps/frontend]
# ...creates bundle: staging-apps-frontend
```

### Naming Ambiguity Problem

The naming convention creates ambiguity when reversing from bundle name to GitRepo/path:

| Bundle Name | Possible Sources |
|-------------|------------------|
| `one-multi-cluster-hello` | GitRepo `one`, path `multi-cluster/hello` |
| `one-multi-cluster-hello` | GitRepo `one-multi`, path `cluster/hello` |
| `one-multi-cluster-hello` | GitRepo `one-multi-cluster`, path `hello` |

This ambiguity means **we cannot reliably reverse-engineer a GitRepo and path from just a bundle name**.

### Bundle Name Length Limit

Fleet truncates bundle names longer than 53 characters, appending a hash suffix:
- `opni-fleet-examples-fleets-opni-ui-plugin-opera-021f7`

## Dependency Declaration

Dependencies are declared in the `fleet.yaml` file within each bundle directory using the `dependsOn` field.

### Supported Formats

#### Direct Name Reference
```yaml
dependsOn:
  - name: my-repo-infra-database
  - name: my-repo-cert-manager
```

#### Simple String Format
```yaml
dependsOn:
  - my-repo-infra-database
  - my-repo-cert-manager
```

#### Label Selector (Advanced)
```yaml
dependsOn:
  - selector:
      matchLabels:
        tier: infrastructure
```

### Complete Example

```yaml
# apps/frontend/fleet.yaml
name: frontend-app

labels:
  tier: application
  team: frontend

dependsOn:
  - name: my-repo-infra-database
  - name: my-repo-infra-redis

helm:
  chart: ./chart
  values:
    replicas: 3
```

## How Fleet Resolves Dependencies

Fleet resolves dependencies **at runtime in Kubernetes**, not at configuration time.

### Resolution Process

1. **Bundle Creation**: When Fleet processes a GitRepo, it creates Bundle CRDs for each path
2. **Label Assignment**: Each Bundle gets labels:
   - `fleet.cattle.io/bundle-name: <bundle-name>`
   - `fleet.cattle.io/bundle-namespace: <namespace>`
3. **Deployment Check**: Before deploying a bundle, Fleet queries for BundleDeployments matching each dependency
4. **Ready Gate**: Deployment proceeds only when all dependencies have `Ready=True` condition

### Kubernetes Query (Simplified)

```go
// For each dependency in bundle.Spec.DependsOn:
selector := labels.Set{
    "fleet.cattle.io/bundle-name":      dependencyName,
    "fleet.cattle.io/bundle-namespace": bundleNamespace,
}

matchingBundles := client.List(BundleDeployments, selector)

for _, dep := range matchingBundles {
    if !dep.Status.Ready {
        return "waiting for dependency"
    }
}
```

### Key Characteristics

- **No Static Mapping**: Fleet doesn't maintain a pre-computed dependency graph
- **Runtime Resolution**: Dependencies are checked against live cluster state
- **Cross-Namespace**: Dependencies can span namespaces (via bundle-namespace label)
- **Cross-GitRepo**: Dependencies can reference bundles from any GitRepo
- **Wait Behavior**: Fleet continuously retries until dependencies are Ready

## Extension Dependency Handling

### Constraints

The extension operates at configuration time (before deployment), so we cannot use Fleet's runtime resolution. Instead, we must:

1. Build our own bundle name registry from configured GitRepos
2. Match dependency names against this registry
3. Handle cases where dependencies are external or unknown

### Extension Bundle Registry

When paths are discovered, we can compute what bundle names would be created:

```typescript
interface BundleInfo {
  gitRepoName: string;      // GitRepo metadata.name
  path: string;             // Path within repo
  bundleName: string;       // Computed: gitRepoName-path.replace(/\//g, '-')
  dependsOn: string[];      // From fleet.yaml
}

// Build registry from all configured GitRepos
const bundleRegistry = new Map<string, BundleInfo>();

for (const repo of gitRepos) {
  for (const pathInfo of repo.discoveredPaths) {
    const bundleName = computeBundleName(repo.name, pathInfo.path);
    bundleRegistry.set(bundleName, {
      gitRepoName: repo.name,
      path: pathInfo.path,
      bundleName,
      dependsOn: pathInfo.dependsOn ?? [],
    });
  }
}
```

### Dependency Categories

When a bundle declares a dependency, it falls into one of these categories:

| Category | Description | Extension Behavior |
|----------|-------------|-------------------|
| **Same-Repo** | Dependency bundle is in the same GitRepo | Auto-select when parent selected |
| **Cross-Repo** | Dependency is in another configured GitRepo | Show warning, require manual selection |
| **External** | Dependency not in any configured GitRepo | Block selection, show error |

### Resolution Algorithm

```typescript
function categorizeDependency(
  depName: string,
  currentGitRepo: string,
  bundleRegistry: Map<string, BundleInfo>
): 'same-repo' | 'cross-repo' | 'external' {
  const depInfo = bundleRegistry.get(depName);

  if (!depInfo) {
    return 'external';  // Not in any configured GitRepo
  }

  if (depInfo.gitRepoName === currentGitRepo) {
    return 'same-repo';
  }

  return 'cross-repo';
}
```

### Transitive Dependencies

Dependencies can have their own dependencies, forming chains:

```
apps/frontend
  └─> dependsOn: infra/database
        └─> dependsOn: infra/postgres-operator
              └─> dependsOn: infra/cert-manager
```

The extension must resolve these transitively:

```typescript
function resolveAllDependencies(
  bundleName: string,
  registry: Map<string, BundleInfo>,
  visited = new Set<string>()
): string[] {
  if (visited.has(bundleName)) return []; // Cycle detection
  visited.add(bundleName);

  const bundle = registry.get(bundleName);
  if (!bundle) return [];

  const allDeps: string[] = [];

  for (const dep of bundle.dependsOn) {
    allDeps.push(dep);
    allDeps.push(...resolveAllDependencies(dep, registry, visited));
  }

  return [...new Set(allDeps)]; // Deduplicate
}
```

## UI Behavior Specification

### Selection Rules

1. **Blocked Selection**: If any dependency is external (not in any configured GitRepo), the path cannot be selected
2. **Auto-Selection**: When selecting a path, all same-repo and cross-repo dependencies are automatically selected
3. **Protected Dependencies**: A path cannot be deselected if another selected path depends on it
4. **Transitive**: Auto-selection and protection apply to the full transitive dependency chain

### Visual Indicators

| State | Visual Treatment |
|-------|------------------|
| Selectable | Normal checkbox |
| Blocked (external deps) | Disabled, grayed out, tooltip explains |
| Auto-selected (dependency) | Checked, shows "required by: X, Y" |
| Has dependencies | Shows dependency list on selection |

### Selection Flow Example

User selects `apps/frontend` which depends on `infra/database` and `infra/redis`:

1. UI shows confirmation: "Will also enable: infra/database, infra/redis"
2. All three paths are checked
3. `infra/database` and `infra/redis` show "required by: apps/frontend"
4. User cannot uncheck `infra/database` while `apps/frontend` is selected
5. User unchecks `apps/frontend` → database and redis remain checked (may have been independently needed)

### Future Enhancement: Direct Selection State

**TODO**: Implement a three-state selection model:

| State | Meaning | Behavior |
|-------|---------|----------|
| **Unselected** | Not deployed | Can be selected |
| **Directly Selected** | User explicitly chose this | Can be deselected (if not a dependency) |
| **Indirectly Selected** | Auto-selected as dependency | Cannot be deselected; auto-removed when no longer needed |

This enables automatic cleanup: when all bundles depending on X are deselected, X can be automatically deselected (if it was only indirectly selected).

## Implementation Checklist

### Phase 1: Bundle Registry
- [ ] Compute bundle names for all discovered paths
- [ ] Build global registry across all GitRepos
- [ ] Parse `dependsOn` from fleet.yaml (existing code)

### Phase 2: Dependency Resolution
- [ ] Categorize dependencies (same-repo, cross-repo, external)
- [ ] Resolve transitive dependencies
- [ ] Detect circular dependencies

### Phase 3: UI Integration
- [ ] Block paths with external dependencies
- [ ] Show dependency information on selection
- [ ] Auto-select dependencies
- [ ] Prevent deselection of required dependencies
- [ ] Show "required by" indicators

### Phase 4: Direct Selection State (Future)
- [ ] Add selection state tracking (direct vs indirect)
- [ ] Implement auto-deselection of unused indirect dependencies
- [ ] UI to promote indirect to direct selection

## References

- Fleet documentation: [Bundle Lifecycle](https://fleet.rancher.io/bundle-lifecycle)
- Fleet source: `pkg/controllers/bundle/` - Bundle controller
- Fleet source: `pkg/deployer/` - Dependency checking in `checkDependency()`
- Extension source: `extension/ui/src/utils/github.ts` - `fetchFleetYamlDeps()`
