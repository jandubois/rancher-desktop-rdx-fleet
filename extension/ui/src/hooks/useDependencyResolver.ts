import { useMemo, useCallback } from 'react';
import { BundleInfo, DependencyResolution, GitRepo } from '../types';
import { PathInfo, buildBundleInfo } from '../utils';

/**
 * Bundle registry: maps bundle names to their info
 */
export type BundleRegistry = Map<string, BundleInfo>;

/**
 * Dependency category for a single dependency
 */
export type DependencyCategory = 'same-repo' | 'cross-repo' | 'external';

interface UseDependencyResolverProps {
  gitRepos: GitRepo[];
  repoPathsCache: Record<string, PathInfo[]>;
}

interface UseDependencyResolverResult {
  /**
   * Global registry of all bundles from all configured GitRepos
   */
  bundleRegistry: BundleRegistry;

  /**
   * Get BundleInfo for a specific path in a GitRepo
   */
  getBundleInfo: (gitRepoName: string, path: string) => BundleInfo | undefined;

  /**
   * Categorize a dependency (same-repo, cross-repo, or external)
   */
  categorizeDependency: (depName: string, currentGitRepoName: string) => DependencyCategory;

  /**
   * Resolve all dependencies (including transitive) for a bundle
   * Returns list of BundleInfo that would need to be selected
   */
  resolveAllDependencies: (bundleName: string) => BundleInfo[];

  /**
   * Check if a path can be selected, and what will be auto-selected
   */
  getSelectionInfo: (gitRepoName: string, path: string, currentlySelected: Map<string, Set<string>>) => DependencyResolution;

  /**
   * Get all paths that would need to be selected when selecting a given path
   * Returns a map of gitRepoName -> paths to select
   */
  getPathsToSelect: (gitRepoName: string, path: string) => Map<string, string[]>;

  /**
   * Check if a path can be deselected (not required by any other selected path)
   */
  canDeselect: (gitRepoName: string, path: string, currentlySelected: Map<string, Set<string>>) => {
    canDeselect: boolean;
    requiredBy: BundleInfo[];
  };

  /**
   * Get what depends on a given bundle (reverse dependency lookup)
   */
  getDependents: (bundleName: string, currentlySelected: Map<string, Set<string>>) => BundleInfo[];
}

export function useDependencyResolver({
  gitRepos,
  repoPathsCache,
}: UseDependencyResolverProps): UseDependencyResolverResult {
  /**
   * Build the global bundle registry from all GitRepos and their discovered paths
   */
  const bundleRegistry = useMemo(() => {
    const registry = new Map<string, BundleInfo>();

    for (const repo of gitRepos) {
      const paths = repoPathsCache[repo.repo];
      if (!paths) continue;

      for (const pathInfo of paths) {
        const bundleInfo = buildBundleInfo(repo.name, pathInfo);
        registry.set(bundleInfo.bundleName, bundleInfo);
      }
    }

    return registry;
  }, [gitRepos, repoPathsCache]);

  /**
   * Get BundleInfo for a specific path
   */
  const getBundleInfo = useCallback(
    (gitRepoName: string, path: string): BundleInfo | undefined => {
      const repo = gitRepos.find((r) => r.name === gitRepoName);
      if (!repo) return undefined;

      const paths = repoPathsCache[repo.repo];
      if (!paths) return undefined;

      const pathInfo = paths.find((p) => p.path === path);
      if (!pathInfo) return undefined;

      return buildBundleInfo(gitRepoName, pathInfo);
    },
    [gitRepos, repoPathsCache]
  );

  /**
   * Categorize a dependency
   */
  const categorizeDependency = useCallback(
    (depName: string, currentGitRepoName: string): DependencyCategory => {
      const depInfo = bundleRegistry.get(depName);

      if (!depInfo) {
        return 'external';
      }

      if (depInfo.gitRepoName === currentGitRepoName) {
        return 'same-repo';
      }

      return 'cross-repo';
    },
    [bundleRegistry]
  );

  /**
   * Resolve all dependencies transitively, with cycle detection
   */
  const resolveAllDependencies = useCallback(
    (bundleName: string, visited = new Set<string>()): BundleInfo[] => {
      if (visited.has(bundleName)) {
        // Cycle detected, stop recursion
        return [];
      }
      visited.add(bundleName);

      const bundle = bundleRegistry.get(bundleName);
      if (!bundle) {
        return [];
      }

      const allDeps: BundleInfo[] = [];

      for (const depName of bundle.dependsOn) {
        const depInfo = bundleRegistry.get(depName);
        if (depInfo) {
          allDeps.push(depInfo);
          // Recursively resolve transitive dependencies
          const transitiveDeps = resolveAllDependencies(depName, visited);
          allDeps.push(...transitiveDeps);
        }
      }

      // Deduplicate by bundle name
      const seen = new Set<string>();
      return allDeps.filter((dep) => {
        if (seen.has(dep.bundleName)) return false;
        seen.add(dep.bundleName);
        return true;
      });
    },
    [bundleRegistry]
  );

  /**
   * Get selection info for a path
   */
  const getSelectionInfo = useCallback(
    (gitRepoName: string, path: string, currentlySelected: Map<string, Set<string>>): DependencyResolution => {
      const bundleInfo = getBundleInfo(gitRepoName, path);

      if (!bundleInfo) {
        return {
          canSelect: false,
          blockedBy: ['Bundle not found in registry'],
          willAutoSelect: [],
          requiredBy: [],
        };
      }

      const blockedBy: string[] = [];
      const willAutoSelect: BundleInfo[] = [];

      // Check each direct dependency
      for (const depName of bundleInfo.dependsOn) {
        const category = categorizeDependency(depName, gitRepoName);

        if (category === 'external') {
          blockedBy.push(depName);
        }
      }

      // If blocked by external deps, can't select
      if (blockedBy.length > 0) {
        return {
          canSelect: false,
          blockedBy,
          willAutoSelect: [],
          requiredBy: [],
        };
      }

      // Resolve all transitive dependencies
      const allDeps = resolveAllDependencies(bundleInfo.bundleName);

      // Check if any transitive dependency is external
      for (const dep of allDeps) {
        for (const transDepName of dep.dependsOn) {
          if (!bundleRegistry.has(transDepName)) {
            blockedBy.push(transDepName);
          }
        }
      }

      if (blockedBy.length > 0) {
        return {
          canSelect: false,
          blockedBy: [...new Set(blockedBy)], // Deduplicate
          willAutoSelect: [],
          requiredBy: [],
        };
      }

      // Filter out already-selected dependencies
      for (const dep of allDeps) {
        const selectedPaths = currentlySelected.get(dep.gitRepoName);
        if (!selectedPaths || !selectedPaths.has(dep.path)) {
          willAutoSelect.push(dep);
        }
      }

      // Find what depends on this bundle (for requiredBy)
      const requiredBy: string[] = [];
      for (const [, bundle] of bundleRegistry) {
        if (bundle.dependsOn.includes(bundleInfo.bundleName)) {
          const selectedPaths = currentlySelected.get(bundle.gitRepoName);
          if (selectedPaths && selectedPaths.has(bundle.path)) {
            requiredBy.push(bundle.bundleName);
          }
        }
      }

      return {
        canSelect: true,
        blockedBy: [],
        willAutoSelect,
        requiredBy,
      };
    },
    [getBundleInfo, categorizeDependency, resolveAllDependencies, bundleRegistry]
  );

  /**
   * Get all paths to select (grouped by GitRepo)
   */
  const getPathsToSelect = useCallback(
    (gitRepoName: string, path: string): Map<string, string[]> => {
      const result = new Map<string, string[]>();

      const bundleInfo = getBundleInfo(gitRepoName, path);
      if (!bundleInfo) return result;

      // Add the target path itself
      if (!result.has(gitRepoName)) {
        result.set(gitRepoName, []);
      }
      result.get(gitRepoName)!.push(path);

      // Add all dependencies
      const allDeps = resolveAllDependencies(bundleInfo.bundleName);
      for (const dep of allDeps) {
        if (!result.has(dep.gitRepoName)) {
          result.set(dep.gitRepoName, []);
        }
        if (!result.get(dep.gitRepoName)!.includes(dep.path)) {
          result.get(dep.gitRepoName)!.push(dep.path);
        }
      }

      return result;
    },
    [getBundleInfo, resolveAllDependencies]
  );

  /**
   * Check if a path can be deselected
   */
  const canDeselect = useCallback(
    (
      gitRepoName: string,
      path: string,
      currentlySelected: Map<string, Set<string>>
    ): { canDeselect: boolean; requiredBy: BundleInfo[] } => {
      const bundleInfo = getBundleInfo(gitRepoName, path);
      if (!bundleInfo) {
        return { canDeselect: true, requiredBy: [] };
      }

      const requiredBy: BundleInfo[] = [];

      // Check all bundles to see if any selected one depends on this
      for (const [bundleName, bundle] of bundleRegistry) {
        // Skip self
        if (bundleName === bundleInfo.bundleName) continue;

        // Check if this bundle is selected
        const selectedPaths = currentlySelected.get(bundle.gitRepoName);
        if (!selectedPaths || !selectedPaths.has(bundle.path)) continue;

        // Check if this bundle depends on our target (directly or transitively)
        const deps = resolveAllDependencies(bundleName);
        if (deps.some((d) => d.bundleName === bundleInfo.bundleName)) {
          requiredBy.push(bundle);
        }
      }

      return {
        canDeselect: requiredBy.length === 0,
        requiredBy,
      };
    },
    [getBundleInfo, bundleRegistry, resolveAllDependencies]
  );

  /**
   * Get dependents of a bundle (what depends on it)
   */
  const getDependents = useCallback(
    (bundleName: string, currentlySelected: Map<string, Set<string>>): BundleInfo[] => {
      const dependents: BundleInfo[] = [];

      for (const [name, bundle] of bundleRegistry) {
        if (name === bundleName) continue;

        // Check if selected
        const selectedPaths = currentlySelected.get(bundle.gitRepoName);
        if (!selectedPaths || !selectedPaths.has(bundle.path)) continue;

        // Check if depends on target
        const deps = resolveAllDependencies(name);
        if (deps.some((d) => d.bundleName === bundleName)) {
          dependents.push(bundle);
        }
      }

      return dependents;
    },
    [bundleRegistry, resolveAllDependencies]
  );

  return {
    bundleRegistry,
    getBundleInfo,
    categorizeDependency,
    resolveAllDependencies,
    getSelectionInfo,
    getPathsToSelect,
    canDeselect,
    getDependents,
  };
}
