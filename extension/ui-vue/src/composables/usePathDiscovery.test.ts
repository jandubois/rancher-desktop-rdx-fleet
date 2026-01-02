/**
 * Unit tests for the usePathDiscovery composable.
 * Tests path discovery and caching behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePathDiscovery } from './usePathDiscovery';
import type { PathInfo } from '../services/BackendService';

// Mock the backend service
vi.mock('../services/BackendService', () => ({
  backendService: {
    discoverPaths: vi.fn(),
  },
}));

import { backendService } from '../services/BackendService';
const mockDiscoverPaths = vi.mocked(backendService.discoverPaths);

describe('usePathDiscovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the cache by getting a fresh composable and clearing
    const { clearCache } = usePathDiscovery();
    clearCache();
  });

  describe('discoverPaths', () => {
    it('should discover paths from backend', async () => {
      const mockPaths: PathInfo[] = [
        { path: 'bundle1' },
        { path: 'bundle2', dependsOn: ['bundle1'] },
      ];
      mockDiscoverPaths.mockResolvedValue({
        paths: mockPaths,
        branch: 'main',
        cloneTimeMs: 100,
        scanTimeMs: 50,
      });

      const { discoverPaths, isDiscovering } = usePathDiscovery();

      const result = await discoverPaths('https://github.com/test/repo');

      expect(result).toEqual(mockPaths);
      expect(mockDiscoverPaths).toHaveBeenCalledWith({
        repo: 'https://github.com/test/repo',
        branch: undefined,
        credentials: undefined,
      });
      expect(isDiscovering.value).toBe(false);
    });

    it('should pass branch and credentials to backend', async () => {
      mockDiscoverPaths.mockResolvedValue({
        paths: [],
        branch: 'develop',
        cloneTimeMs: 100,
        scanTimeMs: 50,
      });

      const { discoverPaths } = usePathDiscovery();
      const credentials = { username: 'user', password: 'token' };

      await discoverPaths('https://github.com/test/repo', 'develop', credentials);

      expect(mockDiscoverPaths).toHaveBeenCalledWith({
        repo: 'https://github.com/test/repo',
        branch: 'develop',
        credentials,
      });
    });

    it('should cache results', async () => {
      const mockPaths: PathInfo[] = [{ path: 'bundle' }];
      mockDiscoverPaths.mockResolvedValue({
        paths: mockPaths,
        branch: 'main',
        cloneTimeMs: 100,
        scanTimeMs: 50,
      });

      const { discoverPaths } = usePathDiscovery();

      // First call
      await discoverPaths('https://github.com/test/repo');
      expect(mockDiscoverPaths).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result = await discoverPaths('https://github.com/test/repo');
      expect(mockDiscoverPaths).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockPaths);
    });

    it('should use different cache keys for different branches', async () => {
      mockDiscoverPaths.mockResolvedValue({
        paths: [{ path: 'bundle' }],
        branch: 'main',
        cloneTimeMs: 100,
        scanTimeMs: 50,
      });

      const { discoverPaths } = usePathDiscovery();

      await discoverPaths('https://github.com/test/repo', 'main');
      await discoverPaths('https://github.com/test/repo', 'develop');

      expect(mockDiscoverPaths).toHaveBeenCalledTimes(2);
    });

    it('should force refresh when requested', async () => {
      mockDiscoverPaths.mockResolvedValue({
        paths: [{ path: 'bundle' }],
        branch: 'main',
        cloneTimeMs: 100,
        scanTimeMs: 50,
      });

      const { discoverPaths } = usePathDiscovery();

      await discoverPaths('https://github.com/test/repo');
      await discoverPaths('https://github.com/test/repo', undefined, undefined, true);

      expect(mockDiscoverPaths).toHaveBeenCalledTimes(2);
    });

    it('should handle errors', async () => {
      mockDiscoverPaths.mockRejectedValue(new Error('Clone failed'));

      const { discoverPaths, getCachedPaths } = usePathDiscovery();

      await expect(discoverPaths('https://github.com/test/repo')).rejects.toThrow('Clone failed');

      const cached = getCachedPaths('https://github.com/test/repo');
      expect(cached?.error).toBe('Clone failed');
      expect(cached?.paths).toEqual([]);
    });
  });

  describe('getCachedPaths', () => {
    it('should return cached state', async () => {
      mockDiscoverPaths.mockResolvedValue({
        paths: [{ path: 'bundle' }],
        branch: 'main',
        cloneTimeMs: 100,
        scanTimeMs: 50,
      });

      const { discoverPaths, getCachedPaths } = usePathDiscovery();

      await discoverPaths('https://github.com/test/repo');

      const cached = getCachedPaths('https://github.com/test/repo');
      expect(cached?.paths).toEqual([{ path: 'bundle' }]);
      expect(cached?.branch).toBe('main');
      expect(cached?.loading).toBe(false);
      expect(cached?.error).toBeNull();
    });

    it('should return undefined for uncached repo', () => {
      const { getCachedPaths } = usePathDiscovery();

      expect(getCachedPaths('https://github.com/uncached/repo')).toBeUndefined();
    });
  });

  describe('hasCachedPaths', () => {
    it('should return true when valid paths are cached', async () => {
      mockDiscoverPaths.mockResolvedValue({
        paths: [{ path: 'bundle' }],
        branch: 'main',
        cloneTimeMs: 100,
        scanTimeMs: 50,
      });

      const { discoverPaths, hasCachedPaths } = usePathDiscovery();

      await discoverPaths('https://github.com/test/repo');

      expect(hasCachedPaths.value('https://github.com/test/repo')).toBe(true);
    });

    it('should return falsy for empty cache', () => {
      const { hasCachedPaths } = usePathDiscovery();

      expect(hasCachedPaths.value('https://github.com/test/repo')).toBeFalsy();
    });

    it('should return falsy when cache has error', async () => {
      mockDiscoverPaths.mockRejectedValue(new Error('Failed'));

      const { discoverPaths, hasCachedPaths } = usePathDiscovery();

      try {
        await discoverPaths('https://github.com/test/repo');
      } catch {
        // Expected
      }

      expect(hasCachedPaths.value('https://github.com/test/repo')).toBeFalsy();
    });
  });

  describe('clearCache', () => {
    it('should clear cache for specific repo', async () => {
      mockDiscoverPaths.mockResolvedValue({
        paths: [{ path: 'bundle' }],
        branch: 'main',
        cloneTimeMs: 100,
        scanTimeMs: 50,
      });

      const { discoverPaths, clearCache, getCachedPaths } = usePathDiscovery();

      await discoverPaths('https://github.com/test/repo1');
      await discoverPaths('https://github.com/test/repo2');

      clearCache('https://github.com/test/repo1');

      expect(getCachedPaths('https://github.com/test/repo1')).toBeUndefined();
      expect(getCachedPaths('https://github.com/test/repo2')).toBeDefined();
    });

    it('should clear all cache when no repo specified', async () => {
      mockDiscoverPaths.mockResolvedValue({
        paths: [{ path: 'bundle' }],
        branch: 'main',
        cloneTimeMs: 100,
        scanTimeMs: 50,
      });

      const { discoverPaths, clearCache, getCachedPaths } = usePathDiscovery();

      await discoverPaths('https://github.com/test/repo1');
      await discoverPaths('https://github.com/test/repo2');

      clearCache();

      expect(getCachedPaths('https://github.com/test/repo1')).toBeUndefined();
      expect(getCachedPaths('https://github.com/test/repo2')).toBeUndefined();
    });
  });
});
