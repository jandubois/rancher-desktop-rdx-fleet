/**
 * usePathDiscovery - Composable for discovering Fleet bundle paths.
 * Demonstrates idiomatic Vue patterns with reactive caching.
 */

import { ref, reactive, computed } from 'vue';
import { backendService, type PathInfo, type GitCredentials } from '../services/BackendService';

interface DiscoveryState {
  loading: boolean;
  error: string | null;
  paths: PathInfo[];
  branch: string | null;
}

// Shared cache across component instances (Vue pattern)
const cache = reactive<Map<string, DiscoveryState>>(new Map());

export function usePathDiscovery() {
  const isDiscovering = ref(false);

  // Get cache key for a repo
  function getCacheKey(repo: string, branch?: string): string {
    return `${repo}@${branch ?? 'default'}`;
  }

  // Get cached state for a repo
  function getCachedPaths(repo: string, branch?: string): DiscoveryState | undefined {
    return cache.get(getCacheKey(repo, branch));
  }

  // Check if we have cached paths
  const hasCachedPaths = computed(() => (repo: string, branch?: string) => {
    const cached = getCachedPaths(repo, branch);
    return cached && cached.paths.length > 0 && !cached.error;
  });

  // Discover paths for a repository
  async function discoverPaths(
    repo: string,
    branch?: string,
    credentials?: GitCredentials,
    forceRefresh = false
  ): Promise<PathInfo[]> {
    const cacheKey = getCacheKey(repo, branch);

    // Return cached if available and not forcing refresh
    if (!forceRefresh && cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)!;
      if (cached.paths.length > 0 && !cached.error) {
        return cached.paths;
      }
    }

    // Initialize cache entry
    cache.set(cacheKey, {
      loading: true,
      error: null,
      paths: [],
      branch: null,
    });

    isDiscovering.value = true;

    try {
      const result = await backendService.discoverPaths({
        repo,
        branch,
        credentials,
      });

      cache.set(cacheKey, {
        loading: false,
        error: null,
        paths: result.paths,
        branch: result.branch,
      });

      return result.paths;
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to discover paths';
      cache.set(cacheKey, {
        loading: false,
        error,
        paths: [],
        branch: null,
      });
      throw e;
    } finally {
      isDiscovering.value = false;
    }
  }

  // Clear cache for a specific repo or all
  function clearCache(repo?: string, branch?: string) {
    if (repo) {
      cache.delete(getCacheKey(repo, branch));
    } else {
      cache.clear();
    }
  }

  return {
    isDiscovering,
    getCachedPaths,
    hasCachedPaths,
    discoverPaths,
    clearCache,
  };
}
