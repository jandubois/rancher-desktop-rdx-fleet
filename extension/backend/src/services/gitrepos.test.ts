/**
 * Unit tests for GitRepo Service utilities
 *
 * Tests the parsing and utility functions of the GitRepoService.
 * These tests import and test the actual exported functions from gitrepos.ts.
 */

import { describe, it, expect } from '@jest/globals';
import {
  parseGitRepoItem,
  buildGitRepoSpec,
  isNotFoundError,
  FLEET_NAMESPACE,
  FLEET_GROUP,
  FLEET_VERSION,
  GITREPO_PLURAL,
} from './gitrepos';

describe('GitRepo constants', () => {
  it('should export correct Fleet constants', () => {
    expect(FLEET_NAMESPACE).toBe('fleet-local');
    expect(FLEET_GROUP).toBe('fleet.cattle.io');
    expect(FLEET_VERSION).toBe('v1alpha1');
    expect(GITREPO_PLURAL).toBe('gitrepos');
  });
});

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
    expect(result.status?.ready).toBe(false);
    expect(result.status?.desiredReadyClusters).toBe(0);
    expect(result.status?.readyClusters).toBe(0);
    expect(result.status?.resources).toEqual([]);
    expect(result.status?.conditions).toEqual([]);
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

    expect(result.status?.desiredReadyClusters).toBe(2);
    expect(result.status?.readyClusters).toBe(0);
    expect(result.status?.display).toBeUndefined();
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

    expect(parseGitRepoItem(itemReady).status?.ready).toBe(true);
    expect(parseGitRepoItem(itemNotReady).status?.ready).toBe(false);
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

    expect(result.status?.resources).toHaveLength(3);
    expect(result.status?.resources?.[0]).toEqual({
      kind: 'Deployment',
      name: 'nginx',
      state: 'Ready',
    });
  });
});

describe('buildGitRepoSpec', () => {
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

describe('isNotFoundError', () => {
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
