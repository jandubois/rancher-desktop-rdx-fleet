import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDependencyResolver } from './useDependencyResolver';
import { GitRepo } from '../types';
import { PathInfo } from '../utils';

// Helper to create test data
function createTestSetup() {
  const gitRepos: GitRepo[] = [
    { name: 'test-bundles', repo: 'https://github.com/org/test-bundles' },
    { name: 'fleet-examples', repo: 'https://github.com/rancher/fleet-examples' },
  ];

  const repoPathsCache: Record<string, PathInfo[]> = {
    'https://github.com/org/test-bundles': [
      { path: 'infra/postgres-operator', dependsOn: undefined },
      { path: 'infra/database', dependsOn: ['test-bundles-infra-postgres-operator'] },
      { path: 'apps/backend', dependsOn: ['test-bundles-infra-database'] },
      { path: 'apps/frontend', dependsOn: ['test-bundles-apps-backend', 'cert-manager'] },
    ],
    'https://github.com/rancher/fleet-examples': [
      { path: 'simple', dependsOn: undefined },
      { path: 'multi-cluster/helm', dependsOn: undefined },
    ],
  };

  return { gitRepos, repoPathsCache };
}

describe('useDependencyResolver', () => {
  describe('bundleRegistry', () => {
    it('builds registry from all gitrepos and paths', () => {
      const { gitRepos, repoPathsCache } = createTestSetup();
      const { result } = renderHook(() => useDependencyResolver({ gitRepos, repoPathsCache }));

      expect(result.current.bundleRegistry.size).toBe(6);
      expect(result.current.bundleRegistry.has('test-bundles-infra-postgres-operator')).toBe(true);
      expect(result.current.bundleRegistry.has('test-bundles-infra-database')).toBe(true);
      expect(result.current.bundleRegistry.has('fleet-examples-simple')).toBe(true);
    });

    it('stores correct bundle info', () => {
      const { gitRepos, repoPathsCache } = createTestSetup();
      const { result } = renderHook(() => useDependencyResolver({ gitRepos, repoPathsCache }));

      const dbBundle = result.current.bundleRegistry.get('test-bundles-infra-database');
      expect(dbBundle).toEqual({
        bundleName: 'test-bundles-infra-database',
        gitRepoName: 'test-bundles',
        path: 'infra/database',
        dependsOn: ['test-bundles-infra-postgres-operator'],
      });
    });

    it('handles empty repoPathsCache', () => {
      const gitRepos: GitRepo[] = [{ name: 'empty', repo: 'https://github.com/org/empty' }];
      const repoPathsCache: Record<string, PathInfo[]> = {};

      const { result } = renderHook(() => useDependencyResolver({ gitRepos, repoPathsCache }));
      expect(result.current.bundleRegistry.size).toBe(0);
    });
  });

  describe('getSelectionInfo', () => {
    it('returns canSelect=true for path with no dependencies', () => {
      const { gitRepos, repoPathsCache } = createTestSetup();
      const { result } = renderHook(() => useDependencyResolver({ gitRepos, repoPathsCache }));

      const currentlySelected = new Map<string, Set<string>>();
      const info = result.current.getSelectionInfo('test-bundles', 'infra/postgres-operator', currentlySelected);

      expect(info.canSelect).toBe(true);
      expect(info.blockedBy).toEqual([]);
      expect(info.willAutoSelect).toEqual([]);
    });

    it('returns willAutoSelect for path with same-repo dependencies', () => {
      const { gitRepos, repoPathsCache } = createTestSetup();
      const { result } = renderHook(() => useDependencyResolver({ gitRepos, repoPathsCache }));

      const currentlySelected = new Map<string, Set<string>>();
      const info = result.current.getSelectionInfo('test-bundles', 'infra/database', currentlySelected);

      expect(info.canSelect).toBe(true);
      expect(info.willAutoSelect).toHaveLength(1);
      expect(info.willAutoSelect[0].path).toBe('infra/postgres-operator');
    });

    it('returns transitive dependencies', () => {
      const { gitRepos, repoPathsCache } = createTestSetup();
      const { result } = renderHook(() => useDependencyResolver({ gitRepos, repoPathsCache }));

      const currentlySelected = new Map<string, Set<string>>();
      const info = result.current.getSelectionInfo('test-bundles', 'apps/backend', currentlySelected);

      expect(info.canSelect).toBe(true);
      // backend -> database -> postgres-operator (2 deps)
      expect(info.willAutoSelect).toHaveLength(2);
      const paths = info.willAutoSelect.map(b => b.path);
      expect(paths).toContain('infra/database');
      expect(paths).toContain('infra/postgres-operator');
    });

    it('returns canSelect=false for path with external dependency', () => {
      const { gitRepos, repoPathsCache } = createTestSetup();
      const { result } = renderHook(() => useDependencyResolver({ gitRepos, repoPathsCache }));

      const currentlySelected = new Map<string, Set<string>>();
      const info = result.current.getSelectionInfo('test-bundles', 'apps/frontend', currentlySelected);

      expect(info.canSelect).toBe(false);
      expect(info.blockedBy).toContain('cert-manager');
    });

    it('excludes already-selected dependencies from willAutoSelect', () => {
      const { gitRepos, repoPathsCache } = createTestSetup();
      const { result } = renderHook(() => useDependencyResolver({ gitRepos, repoPathsCache }));

      // postgres-operator is already selected
      const currentlySelected = new Map<string, Set<string>>([
        ['test-bundles', new Set(['infra/postgres-operator'])],
      ]);

      const info = result.current.getSelectionInfo('test-bundles', 'infra/database', currentlySelected);

      expect(info.canSelect).toBe(true);
      expect(info.willAutoSelect).toHaveLength(0); // postgres-operator already selected
    });
  });

  describe('canDeselect', () => {
    it('returns canDeselect=true when nothing depends on it', () => {
      const { gitRepos, repoPathsCache } = createTestSetup();
      const { result } = renderHook(() => useDependencyResolver({ gitRepos, repoPathsCache }));

      const currentlySelected = new Map<string, Set<string>>([
        ['test-bundles', new Set(['infra/postgres-operator'])],
      ]);

      const info = result.current.canDeselect('test-bundles', 'infra/postgres-operator', currentlySelected);
      expect(info.canDeselect).toBe(true);
      expect(info.requiredBy).toEqual([]);
    });

    it('returns canDeselect=false when other selected paths depend on it', () => {
      const { gitRepos, repoPathsCache } = createTestSetup();
      const { result } = renderHook(() => useDependencyResolver({ gitRepos, repoPathsCache }));

      // Both postgres-operator and database are selected
      const currentlySelected = new Map<string, Set<string>>([
        ['test-bundles', new Set(['infra/postgres-operator', 'infra/database'])],
      ]);

      const info = result.current.canDeselect('test-bundles', 'infra/postgres-operator', currentlySelected);
      expect(info.canDeselect).toBe(false);
      expect(info.requiredBy).toHaveLength(1);
      expect(info.requiredBy[0].path).toBe('infra/database');
    });

    it('detects transitive dependents', () => {
      const { gitRepos, repoPathsCache } = createTestSetup();
      const { result } = renderHook(() => useDependencyResolver({ gitRepos, repoPathsCache }));

      // All three are selected: postgres-operator, database, backend
      const currentlySelected = new Map<string, Set<string>>([
        ['test-bundles', new Set(['infra/postgres-operator', 'infra/database', 'apps/backend'])],
      ]);

      // postgres-operator is required by both database (direct) and backend (transitive)
      const info = result.current.canDeselect('test-bundles', 'infra/postgres-operator', currentlySelected);
      expect(info.canDeselect).toBe(false);
      expect(info.requiredBy.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getPathsToSelect', () => {
    it('returns target path plus all dependencies', () => {
      const { gitRepos, repoPathsCache } = createTestSetup();
      const { result } = renderHook(() => useDependencyResolver({ gitRepos, repoPathsCache }));

      const pathsToSelect = result.current.getPathsToSelect('test-bundles', 'apps/backend');

      expect(pathsToSelect.get('test-bundles')).toContain('apps/backend');
      expect(pathsToSelect.get('test-bundles')).toContain('infra/database');
      expect(pathsToSelect.get('test-bundles')).toContain('infra/postgres-operator');
    });

    it('returns only target path when no dependencies', () => {
      const { gitRepos, repoPathsCache } = createTestSetup();
      const { result } = renderHook(() => useDependencyResolver({ gitRepos, repoPathsCache }));

      const pathsToSelect = result.current.getPathsToSelect('test-bundles', 'infra/postgres-operator');

      expect(pathsToSelect.get('test-bundles')).toEqual(['infra/postgres-operator']);
    });

    it('groups paths by gitrepo for cross-repo deps', () => {
      // Create a setup with cross-repo dependency
      const gitRepos: GitRepo[] = [
        { name: 'app', repo: 'https://github.com/org/app' },
        { name: 'infra', repo: 'https://github.com/org/infra' },
      ];
      const repoPathsCache: Record<string, PathInfo[]> = {
        'https://github.com/org/app': [
          { path: 'frontend', dependsOn: ['infra-database'] },
        ],
        'https://github.com/org/infra': [
          { path: 'database', dependsOn: undefined },
        ],
      };

      const { result } = renderHook(() => useDependencyResolver({ gitRepos, repoPathsCache }));
      const pathsToSelect = result.current.getPathsToSelect('app', 'frontend');

      expect(pathsToSelect.get('app')).toContain('frontend');
      expect(pathsToSelect.get('infra')).toContain('database');
    });
  });

  describe('cycle detection', () => {
    it('handles circular dependencies without infinite loop', () => {
      const gitRepos: GitRepo[] = [
        { name: 'cycle', repo: 'https://github.com/org/cycle' },
      ];
      const repoPathsCache: Record<string, PathInfo[]> = {
        'https://github.com/org/cycle': [
          { path: 'a', dependsOn: ['cycle-b'] },
          { path: 'b', dependsOn: ['cycle-a'] }, // Circular!
        ],
      };

      const { result } = renderHook(() => useDependencyResolver({ gitRepos, repoPathsCache }));

      // Should not hang or throw
      const deps = result.current.resolveAllDependencies('cycle-a');
      expect(deps).toBeDefined();
      // Should include 'b' but stop at the cycle
      expect(deps.some(d => d.path === 'b')).toBe(true);
    });
  });
});
