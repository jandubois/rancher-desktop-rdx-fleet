import { useState, useCallback, useRef, useEffect } from 'react';
import { GitHubService, PathInfo } from '../services';
import { useGitHubService } from '../context/ServiceContext';
import { getErrorMessage } from '../utils';

interface UsePathDiscoveryOptions {
  /**
   * Optional GitHubService for dependency injection (primarily for testing).
   * If not provided, uses the service from ServiceContext.
   */
  gitHubService?: GitHubService;
}

interface UsePathDiscoveryResult {
  repoPathsCache: Record<string, PathInfo[]>;
  discoveryErrors: Record<string, string>;
  discoveryStartTimes: Record<string, number>;
  isLoadingPaths: (repoUrl: string) => boolean;
  discoverPathsForRepo: (repoUrl: string, branch?: string, isRetry?: boolean) => Promise<void>;
  clearDiscoveryCache: (repoUrl: string) => void;
}

/**
 * Hook for discovering Fleet bundle paths in Git repositories.
 *
 * Uses GitHubService from ServiceContext by default, which ensures:
 * - Auth token is shared across the application
 * - Rate limit callbacks work properly
 *
 * Can also inject a service for testing:
 * ```ts
 * const mockService = new GitHubService(mockHttpClient);
 * usePathDiscovery({ gitHubService: mockService });
 * ```
 */
export function usePathDiscovery(options: UsePathDiscoveryOptions = {}): UsePathDiscoveryResult {
  // Use service from context by default, allow override for testing
  const contextService = useGitHubService();
  const gitHubService = options.gitHubService ?? contextService;

  // Cache of available paths per repo URL
  const [repoPathsCache, setRepoPathsCache] = useState<Record<string, PathInfo[]>>({});
  const repoPathsCacheRef = useRef<Record<string, PathInfo[]>>({});
  const loadingRepoPathsRef = useRef<Set<string>>(new Set());

  // Track discovery start time for timeout handling (30s)
  const [discoveryStartTimes, setDiscoveryStartTimes] = useState<Record<string, number>>({});
  const [discoveryErrors, setDiscoveryErrors] = useState<Record<string, string>>({});

  // Keep cache ref in sync
  useEffect(() => {
    repoPathsCacheRef.current = repoPathsCache;
  }, [repoPathsCache]);

  // Check if paths are loading for a repo
  const isLoadingPaths = useCallback((repoUrl: string): boolean => {
    return loadingRepoPathsRef.current.has(repoUrl);
  }, []);

  // Clear discovery cache for a repo (used before retry)
  const clearDiscoveryCache = useCallback((repoUrl: string) => {
    setRepoPathsCache((prev) => {
      const next = { ...prev };
      delete next[repoUrl];
      return next;
    });
    delete repoPathsCacheRef.current[repoUrl];
    setDiscoveryErrors((prev) => {
      const next = { ...prev };
      delete next[repoUrl];
      return next;
    });
  }, []);

  // Discover paths for an existing repo and cache them
  const discoverPathsForRepo = useCallback(async (repoUrl: string, branch?: string, isRetry = false) => {
    // Check ref to prevent duplicate requests (unless retry)
    if (!isRetry && (repoPathsCacheRef.current[repoUrl] !== undefined || loadingRepoPathsRef.current.has(repoUrl))) {
      return;
    }

    loadingRepoPathsRef.current.add(repoUrl);

    // Track start time for timeout display
    setDiscoveryStartTimes((prev) => ({ ...prev, [repoUrl]: Date.now() }));
    // Clear any previous error
    setDiscoveryErrors((prev) => {
      const next = { ...prev };
      delete next[repoUrl];
      return next;
    });

    try {
      const paths = await gitHubService.fetchGitHubPaths(repoUrl, branch);
      // Update both ref and state immediately
      repoPathsCacheRef.current[repoUrl] = paths;
      setRepoPathsCache((prev) => ({ ...prev, [repoUrl]: paths }));
      // Clear start time on success
      setDiscoveryStartTimes((prev) => {
        const next = { ...prev };
        delete next[repoUrl];
        return next;
      });
    } catch (err) {
      console.error(`Failed to discover paths for ${repoUrl}:`, err);
      const errorMsg = getErrorMessage(err);
      setDiscoveryErrors((prev) => ({ ...prev, [repoUrl]: errorMsg }));
      // Don't cache empty array on error - allow retry
    } finally {
      loadingRepoPathsRef.current.delete(repoUrl);
    }
  }, [gitHubService]);

  return {
    repoPathsCache,
    discoveryErrors,
    discoveryStartTimes,
    isLoadingPaths,
    discoverPathsForRepo,
    clearDiscoveryCache,
  };
}
