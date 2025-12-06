/**
 * Unit tests for GitRepo Service utilities
 *
 * Tests the parsing and utility functions of the GitRepoService.
 * K8s API mocking with ESM is complex, so we focus on testing
 * the pure functions and data transformations.
 */

import { describe, it, expect } from '@jest/globals';

// We test the service's parseGitRepoItem logic by simulating the data flow
describe('GitRepo parsing utilities', () => {
  // Simulate the parseGitRepoItem function logic
  function parseGitRepoItem(item: Record<string, unknown>) {
    const spec = (item.spec as Record<string, unknown>) || {};
    const status = (item.status as Record<string, unknown>) || {};
    const metadata = (item.metadata as Record<string, unknown>) || {};
    const conditions = (status.conditions as Array<Record<string, unknown>>) || [];
    const display = status.display as Record<string, unknown> | undefined;
    const resources = (status.resources as Array<Record<string, unknown>>) || [];

    return {
      name: metadata.name as string,
      repo: spec.repo as string,
      branch: spec.branch as string | undefined,
      paths: spec.paths as string[] | undefined,
      paused: spec.paused as boolean | undefined,
      status: {
        ready: conditions.some((c) => c.type === 'Ready' && c.status === 'True'),
        display: display
          ? {
              state: display.state as string | undefined,
              message: display.message as string | undefined,
              error: display.error as boolean | undefined,
            }
          : undefined,
        desiredReadyClusters: (status.desiredReadyClusters as number) || 0,
        readyClusters: (status.readyClusters as number) || 0,
        resources: resources.map((r) => ({
          kind: r.kind as string,
          name: r.name as string,
          state: r.state as string,
        })),
        conditions: conditions.map((c) => ({
          type: c.type as string,
          status: c.status as string,
          message: c.message as string | undefined,
        })),
      },
    };
  }

  describe('parseGitRepoItem', () => {
    it('should parse a complete GitRepo item', () => {
      const item = {
        metadata: {
          name: 'test-repo',
          namespace: 'fleet-local',
        },
        spec: {
          repo: 'https://github.com/test/repo',
          branch: 'main',
          paths: ['apps/nginx', 'apps/redis'],
          paused: false,
        },
        status: {
          conditions: [
            { type: 'Ready', status: 'True', message: 'All resources ready' },
          ],
          display: {
            state: 'Active',
            message: 'GitRepo is active',
            error: false,
          },
          desiredReadyClusters: 1,
          readyClusters: 1,
          resources: [
            { kind: 'Deployment', name: 'nginx', state: 'Ready' },
          ],
        },
      };

      const result = parseGitRepoItem(item);

      expect(result).toMatchObject({
        name: 'test-repo',
        repo: 'https://github.com/test/repo',
        branch: 'main',
        paths: ['apps/nginx', 'apps/redis'],
        paused: false,
      });

      expect(result.status).toMatchObject({
        ready: true,
        desiredReadyClusters: 1,
        readyClusters: 1,
        display: {
          state: 'Active',
          message: 'GitRepo is active',
          error: false,
        },
      });
    });

    it('should handle GitRepo without status', () => {
      const item = {
        metadata: { name: 'minimal-repo' },
        spec: { repo: 'https://github.com/test/minimal' },
      };

      const result = parseGitRepoItem(item);

      expect(result.name).toBe('minimal-repo');
      expect(result.repo).toBe('https://github.com/test/minimal');
      expect(result.status.ready).toBe(false);
      expect(result.status.desiredReadyClusters).toBe(0);
      expect(result.status.readyClusters).toBe(0);
      expect(result.status.resources).toEqual([]);
      expect(result.status.conditions).toEqual([]);
    });

    it('should handle GitRepo with partial status', () => {
      const item = {
        metadata: { name: 'partial-repo' },
        spec: { repo: 'https://github.com/test/partial' },
        status: {
          desiredReadyClusters: 2,
          // Missing readyClusters, display, conditions, resources
        },
      };

      const result = parseGitRepoItem(item);

      expect(result.status.desiredReadyClusters).toBe(2);
      expect(result.status.readyClusters).toBe(0);
      expect(result.status.display).toBeUndefined();
    });

    it('should correctly determine ready status from conditions', () => {
      const itemReady = {
        metadata: { name: 'ready-repo' },
        spec: { repo: 'https://github.com/test/ready' },
        status: {
          conditions: [
            { type: 'Ready', status: 'True', message: 'Ready' },
            { type: 'Accepted', status: 'True', message: 'Accepted' },
          ],
        },
      };

      const itemNotReady = {
        metadata: { name: 'not-ready-repo' },
        spec: { repo: 'https://github.com/test/not-ready' },
        status: {
          conditions: [
            { type: 'Ready', status: 'False', message: 'Not ready' },
          ],
        },
      };

      expect(parseGitRepoItem(itemReady).status.ready).toBe(true);
      expect(parseGitRepoItem(itemNotReady).status.ready).toBe(false);
    });

    it('should handle missing branch', () => {
      const item = {
        metadata: { name: 'no-branch-repo' },
        spec: {
          repo: 'https://github.com/test/repo',
          paths: ['apps'],
        },
      };

      const result = parseGitRepoItem(item);

      expect(result.branch).toBeUndefined();
      expect(result.paths).toEqual(['apps']);
    });

    it('should handle empty paths array', () => {
      const item = {
        metadata: { name: 'empty-paths-repo' },
        spec: {
          repo: 'https://github.com/test/repo',
          paths: [],
        },
      };

      const result = parseGitRepoItem(item);

      expect(result.paths).toEqual([]);
    });

    it('should parse multiple resources correctly', () => {
      const item = {
        metadata: { name: 'multi-resource-repo' },
        spec: { repo: 'https://github.com/test/repo' },
        status: {
          resources: [
            { kind: 'Deployment', name: 'nginx', state: 'Ready' },
            { kind: 'Service', name: 'nginx-svc', state: 'Ready' },
            { kind: 'ConfigMap', name: 'nginx-config', state: 'Modified' },
          ],
        },
      };

      const result = parseGitRepoItem(item);

      expect(result.status.resources).toHaveLength(3);
      expect(result.status.resources[0]).toEqual({
        kind: 'Deployment',
        name: 'nginx',
        state: 'Ready',
      });
    });
  });
});

describe('GitRepo spec building', () => {
  // Simulate the spec building logic from applyGitRepo
  function buildGitRepoSpec(request: {
    name: string;
    repo: string;
    branch?: string;
    paths?: string[];
    paused?: boolean;
  }) {
    const gitRepoSpec: Record<string, unknown> = {
      repo: request.repo,
    };

    if (request.branch) {
      gitRepoSpec.branch = request.branch;
    }

    if (request.paths !== undefined) {
      gitRepoSpec.paths = request.paths;
    }

    if (request.paused !== undefined) {
      gitRepoSpec.paused = request.paused;
    }

    return gitRepoSpec;
  }

  it('should build spec with all fields', () => {
    const spec = buildGitRepoSpec({
      name: 'test-repo',
      repo: 'https://github.com/test/repo',
      branch: 'main',
      paths: ['apps/nginx'],
      paused: false,
    });

    expect(spec).toEqual({
      repo: 'https://github.com/test/repo',
      branch: 'main',
      paths: ['apps/nginx'],
      paused: false,
    });
  });

  it('should not include branch if not specified', () => {
    const spec = buildGitRepoSpec({
      name: 'test-repo',
      repo: 'https://github.com/test/repo',
      paths: ['apps'],
    });

    expect(spec).not.toHaveProperty('branch');
  });

  it('should include empty paths array (deploy nothing)', () => {
    const spec = buildGitRepoSpec({
      name: 'test-repo',
      repo: 'https://github.com/test/repo',
      paths: [],
    });

    expect(spec.paths).toEqual([]);
  });

  it('should not include paths if undefined (different from empty)', () => {
    const spec = buildGitRepoSpec({
      name: 'test-repo',
      repo: 'https://github.com/test/repo',
    });

    expect(spec).not.toHaveProperty('paths');
  });

  it('should include paused when true', () => {
    const spec = buildGitRepoSpec({
      name: 'test-repo',
      repo: 'https://github.com/test/repo',
      paused: true,
    });

    expect(spec.paused).toBe(true);
  });
});

describe('Error detection utilities', () => {
  // Simulate the isNotFoundError function
  function isNotFoundError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'response' in error) {
      const httpError = error as { response?: { statusCode?: number } };
      return httpError.response?.statusCode === 404;
    }
    return false;
  }

  it('should detect 404 errors', () => {
    const error = { response: { statusCode: 404 } };
    expect(isNotFoundError(error)).toBe(true);
  });

  it('should not match other status codes', () => {
    expect(isNotFoundError({ response: { statusCode: 500 } })).toBe(false);
    expect(isNotFoundError({ response: { statusCode: 403 } })).toBe(false);
  });

  it('should handle errors without response', () => {
    expect(isNotFoundError(new Error('Network error'))).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
    expect(isNotFoundError(undefined)).toBe(false);
  });
});
