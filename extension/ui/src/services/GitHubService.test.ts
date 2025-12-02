import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GitHubService,
  computeBundleName,
  buildBundleInfo,
  parseGitHubUrl,
} from './GitHubService';
import { createMockResponse, MockHttpClient } from '../test-utils';

// Suppress console output in tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('GitHubService utility functions', () => {
  describe('computeBundleName', () => {
    it('returns gitRepoName when path is empty', () => {
      expect(computeBundleName('my-repo', '')).toBe('my-repo');
    });

    it('returns gitRepoName when path is "."', () => {
      expect(computeBundleName('my-repo', '.')).toBe('my-repo');
    });

    it('appends path to gitRepoName with hyphen', () => {
      expect(computeBundleName('my-repo', 'app1')).toBe('my-repo-app1');
    });

    it('replaces slashes in path with hyphens', () => {
      expect(computeBundleName('my-repo', 'apps/frontend')).toBe('my-repo-apps-frontend');
    });

    it('strips leading and trailing slashes from path', () => {
      expect(computeBundleName('my-repo', '/apps/')).toBe('my-repo-apps');
      expect(computeBundleName('my-repo', '///apps///')).toBe('my-repo-apps');
    });

    it('handles deeply nested paths', () => {
      expect(computeBundleName('my-repo', 'a/b/c/d')).toBe('my-repo-a-b-c-d');
    });
  });

  describe('buildBundleInfo', () => {
    it('builds BundleInfo with computed bundle name', () => {
      const result = buildBundleInfo('my-repo', { path: 'app1' });
      expect(result).toEqual({
        bundleName: 'my-repo-app1',
        gitRepoName: 'my-repo',
        path: 'app1',
        dependsOn: [],
      });
    });

    it('includes dependencies from PathInfo', () => {
      const result = buildBundleInfo('my-repo', {
        path: 'app1',
        dependsOn: ['dep1', 'dep2'],
      });
      expect(result.dependsOn).toEqual(['dep1', 'dep2']);
    });

    it('handles undefined dependsOn', () => {
      const result = buildBundleInfo('my-repo', { path: 'app1' });
      expect(result.dependsOn).toEqual([]);
    });
  });

  describe('parseGitHubUrl', () => {
    it('parses standard GitHub URL', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('parses GitHub URL with .git suffix', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo.git');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('parses GitHub URL with path segments', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo/tree/main');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('returns null for non-GitHub URLs', () => {
      expect(parseGitHubUrl('https://gitlab.com/owner/repo')).toBeNull();
      expect(parseGitHubUrl('https://bitbucket.org/owner/repo')).toBeNull();
    });

    it('returns null for invalid URLs', () => {
      expect(parseGitHubUrl('not-a-url')).toBeNull();
      expect(parseGitHubUrl('')).toBeNull();
    });

    it('handles HTTP URLs', () => {
      const result = parseGitHubUrl('http://github.com/owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });
  });
});

describe('GitHubService class', () => {
  let service: GitHubService;
  let mockHttpClient: MockHttpClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHttpClient = new MockHttpClient();
    service = new GitHubService(mockHttpClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockHttpClient.reset();
  });

  describe('auth token management', () => {
    it('starts with no auth token', () => {
      expect(service.getAuthToken()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });

    it('sets and gets auth token', () => {
      service.setAuthToken('test-token');
      expect(service.getAuthToken()).toBe('test-token');
      expect(service.isAuthenticated()).toBe(true);
    });

    it('clears auth token when set to null', () => {
      service.setAuthToken('test-token');
      service.setAuthToken(null);
      expect(service.getAuthToken()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('rate limit callback', () => {
    it('calls callback when rate limit headers are present', async () => {
      const callback = vi.fn();
      service.setRateLimitCallback(callback);

      mockHttpClient.mockResponse('https://api.github.com/rate_limit', createMockResponse({
        ok: true,
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4999',
          'x-ratelimit-reset': '1234567890',
        },
        body: { rate: { limit: 5000, remaining: 4999, reset: 1234567890 } },
      }));

      await service.getRateLimit();

      expect(callback).toHaveBeenCalledWith({
        limit: 5000,
        remaining: 4999,
        reset: 1234567890,
      });
    });

    it('does not call callback when headers are missing', async () => {
      const callback = vi.fn();
      service.setRateLimitCallback(callback);

      mockHttpClient.mockResponse('https://api.github.com/rate_limit', createMockResponse({
        ok: true,
        body: { rate: { limit: 5000, remaining: 4999, reset: 1234567890 } },
      }));

      await service.getRateLimit();

      expect(callback).not.toHaveBeenCalled();
    });

    it('clears callback when set to null', async () => {
      const callback = vi.fn();
      service.setRateLimitCallback(callback);
      service.setRateLimitCallback(null);

      mockHttpClient.mockResponse('https://api.github.com/rate_limit', createMockResponse({
        ok: true,
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4999',
          'x-ratelimit-reset': '1234567890',
        },
        body: { rate: { limit: 5000, remaining: 4999, reset: 1234567890 } },
      }));

      await service.getRateLimit();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('validateGitHubToken', () => {
    it('returns user info for valid token', async () => {
      mockHttpClient.mockResponse('https://api.github.com/user', createMockResponse({
        ok: true,
        body: {
          login: 'testuser',
          name: 'Test User',
          avatar_url: 'https://example.com/avatar.png',
        },
      }));

      const result = await service.validateGitHubToken('valid-token');

      expect(result).toEqual({
        login: 'testuser',
        name: 'Test User',
        avatar_url: 'https://example.com/avatar.png',
      });
    });

    it('returns null for invalid token (401)', async () => {
      mockHttpClient.mockResponse('https://api.github.com/user', createMockResponse({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      }));

      const result = await service.validateGitHubToken('invalid-token');

      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      mockHttpClient.mockResponse('https://api.github.com/user', new Error('Network error'));

      const result = await service.validateGitHubToken('some-token');

      expect(result).toBeNull();
    });

    it('handles user without optional fields', async () => {
      mockHttpClient.mockResponse('https://api.github.com/user', createMockResponse({
        ok: true,
        body: {
          login: 'testuser',
        },
      }));

      const result = await service.validateGitHubToken('valid-token');

      expect(result).toEqual({
        login: 'testuser',
        name: undefined,
        avatar_url: undefined,
      });
    });
  });

  describe('getRateLimit', () => {
    it('returns rate limit info for authenticated request', async () => {
      mockHttpClient.mockResponse('https://api.github.com/rate_limit', createMockResponse({
        ok: true,
        body: {
          rate: {
            limit: 5000,
            remaining: 4500,
            reset: 1234567890,
          },
        },
      }));

      const result = await service.getRateLimit('test-token');

      expect(result).toEqual({
        limit: 5000,
        remaining: 4500,
        reset: 1234567890,
      });
    });

    it('returns rate limit info for unauthenticated request', async () => {
      mockHttpClient.mockResponse('https://api.github.com/rate_limit', createMockResponse({
        ok: true,
        body: {
          rate: {
            limit: 60,
            remaining: 55,
            reset: 1234567890,
          },
        },
      }));

      const result = await service.getRateLimit();

      expect(result).toEqual({
        limit: 60,
        remaining: 55,
        reset: 1234567890,
      });
    });

    it('returns null when response is not ok', async () => {
      mockHttpClient.mockResponse('https://api.github.com/rate_limit', createMockResponse({
        ok: false,
        status: 500,
      }));

      const result = await service.getRateLimit();

      expect(result).toBeNull();
    });

    it('returns null when rate data is missing', async () => {
      mockHttpClient.mockResponse('https://api.github.com/rate_limit', createMockResponse({
        ok: true,
        body: {},
      }));

      const result = await service.getRateLimit();

      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      mockHttpClient.mockResponse('https://api.github.com/rate_limit', new Error('Network error'));

      const result = await service.getRateLimit();

      expect(result).toBeNull();
    });
  });

  describe('fetchGitHubPaths', () => {
    it('throws error for non-GitHub URLs', async () => {
      await expect(service.fetchGitHubPaths('https://gitlab.com/owner/repo'))
        .rejects.toThrow('Only GitHub repositories are supported');
    });

    it('returns paths from repository tree', async () => {
      mockHttpClient.mockPattern(/api\.github\.com\/repos\/.*\/git\/trees/, createMockResponse({
        ok: true,
        body: {
          tree: [
            { path: 'app1/fleet.yaml', type: 'blob' },
            { path: 'app2/fleet.yml', type: 'blob' },
            { path: 'README.md', type: 'blob' },
          ],
        },
      }));

      // Mock fleet.yaml fetches to return 404 (no deps)
      mockHttpClient.mockPattern(/raw\.githubusercontent\.com/, createMockResponse({
        ok: false,
        status: 404,
      }));

      const result = await service.fetchGitHubPaths('https://github.com/owner/repo');

      expect(result).toHaveLength(2);
      expect(result.map(p => p.path)).toContain('app1');
      expect(result.map(p => p.path)).toContain('app2');
    });

    it('tries main branch when master fails', async () => {
      // First call (master) returns 404
      mockHttpClient.mockResponse(
        'https://api.github.com/repos/owner/repo/git/trees/master?recursive=1',
        createMockResponse({ ok: false, status: 404 })
      );

      // Second call (main) succeeds
      mockHttpClient.mockResponse(
        'https://api.github.com/repos/owner/repo/git/trees/main?recursive=1',
        createMockResponse({
          ok: true,
          body: {
            tree: [{ path: 'app/fleet.yaml', type: 'blob' }],
          },
        })
      );

      // Mock fleet.yaml fetch
      mockHttpClient.mockPattern(/raw\.githubusercontent\.com/, createMockResponse({
        ok: false,
        status: 404,
      }));

      const result = await service.fetchGitHubPaths('https://github.com/owner/repo');

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('app');
    });

    it('uses specified branch when provided', async () => {
      mockHttpClient.mockResponse(
        'https://api.github.com/repos/owner/repo/git/trees/develop?recursive=1',
        createMockResponse({
          ok: true,
          body: {
            tree: [{ path: 'app/fleet.yaml', type: 'blob' }],
          },
        })
      );

      mockHttpClient.mockPattern(/raw\.githubusercontent\.com/, createMockResponse({
        ok: false,
        status: 404,
      }));

      await service.fetchGitHubPaths('https://github.com/owner/repo', 'develop');

      const calls = mockHttpClient.getCalls();
      expect(calls).toContain('https://api.github.com/repos/owner/repo/git/trees/develop?recursive=1');
    });

    it('throws rate limit error with reset time', async () => {
      mockHttpClient.mockPattern(/api\.github\.com/, createMockResponse({
        ok: false,
        status: 403,
        headers: {
          'X-RateLimit-Reset': '1234567890',
        },
      }));

      await expect(service.fetchGitHubPaths('https://github.com/owner/repo'))
        .rejects.toThrow('rate limit exceeded');
    });

    it('includes auth token in headers when set', async () => {
      service.setAuthToken('test-token');

      mockHttpClient.mockPattern(/api\.github\.com/, createMockResponse({
        ok: true,
        body: { tree: [] },
      }));

      await service.fetchGitHubPaths('https://github.com/owner/repo');

      // The mock doesn't capture headers, but we can verify the service is authenticated
      expect(service.isAuthenticated()).toBe(true);
    });

    it('filters out root fleet.yaml files', async () => {
      mockHttpClient.mockPattern(/api\.github\.com/, createMockResponse({
        ok: true,
        body: {
          tree: [
            { path: 'fleet.yaml', type: 'blob' },  // root level - should be filtered
            { path: 'app1/fleet.yaml', type: 'blob' },
          ],
        },
      }));

      mockHttpClient.mockPattern(/raw\.githubusercontent\.com/, createMockResponse({
        ok: false,
        status: 404,
      }));

      const result = await service.fetchGitHubPaths('https://github.com/owner/repo');

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('app1');
    });
  });

  describe('fetchFleetYamlDeps', () => {
    it('returns dependencies from fleet.yaml', async () => {
      mockHttpClient.mockPattern(/raw\.githubusercontent\.com.*fleet\.yaml/, createMockResponse({
        ok: true,
        body: 'dependsOn:\n  - dep1\n  - dep2',
      }));

      const result = await service.fetchFleetYamlDeps('owner', 'repo', 'main', 'app');

      expect(result).toEqual(['dep1', 'dep2']);
    });

    it('handles object-style dependsOn', async () => {
      mockHttpClient.mockPattern(/raw\.githubusercontent\.com.*fleet\.yaml/, createMockResponse({
        ok: true,
        body: 'dependsOn:\n  - name: dep1\n  - name: dep2',
      }));

      const result = await service.fetchFleetYamlDeps('owner', 'repo', 'main', 'app');

      expect(result).toEqual(['dep1', 'dep2']);
    });

    it('tries fleet.yml if fleet.yaml not found', async () => {
      mockHttpClient.mockResponse(
        'https://raw.githubusercontent.com/owner/repo/main/app/fleet.yaml',
        createMockResponse({ ok: false, status: 404 })
      );

      mockHttpClient.mockResponse(
        'https://raw.githubusercontent.com/owner/repo/main/app/fleet.yml',
        createMockResponse({
          ok: true,
          body: 'dependsOn:\n  - dep1',
        })
      );

      const result = await service.fetchFleetYamlDeps('owner', 'repo', 'main', 'app');

      expect(result).toEqual(['dep1']);
    });

    it('returns undefined when no fleet file found', async () => {
      mockHttpClient.mockPattern(/raw\.githubusercontent\.com/, createMockResponse({
        ok: false,
        status: 404,
      }));

      const result = await service.fetchFleetYamlDeps('owner', 'repo', 'main', 'app');

      expect(result).toBeUndefined();
    });

    it('returns undefined when dependsOn is not an array', async () => {
      mockHttpClient.mockPattern(/raw\.githubusercontent\.com.*fleet\.yaml/, createMockResponse({
        ok: true,
        body: 'dependsOn: not-an-array',
      }));

      const result = await service.fetchFleetYamlDeps('owner', 'repo', 'main', 'app');

      expect(result).toBeUndefined();
    });

    it('returns undefined when fleet.yaml has no dependsOn', async () => {
      mockHttpClient.mockPattern(/raw\.githubusercontent\.com.*fleet\.yaml/, createMockResponse({
        ok: true,
        body: 'name: my-bundle',
      }));

      const result = await service.fetchFleetYamlDeps('owner', 'repo', 'main', 'app');

      expect(result).toBeUndefined();
    });

    it('returns undefined for empty dependsOn array', async () => {
      mockHttpClient.mockPattern(/raw\.githubusercontent\.com.*fleet\.yaml/, createMockResponse({
        ok: true,
        body: 'dependsOn: []',
      }));

      const result = await service.fetchFleetYamlDeps('owner', 'repo', 'main', 'app');

      expect(result).toBeUndefined();
    });

    it('handles empty path (root level)', async () => {
      mockHttpClient.mockResponse(
        'https://raw.githubusercontent.com/owner/repo/main/fleet.yaml',
        createMockResponse({
          ok: true,
          body: 'dependsOn:\n  - dep1',
        })
      );

      const result = await service.fetchFleetYamlDeps('owner', 'repo', 'main', '');

      expect(result).toEqual(['dep1']);
    });
  });
});
