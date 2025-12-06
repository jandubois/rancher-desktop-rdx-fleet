import { useState, useCallback, useRef, useEffect } from 'react';
import { backendService } from '../services';
import { PathInfo } from '../services/BackendService';
import { getErrorMessage } from '../utils';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- kept for API compatibility
interface UsePathDiscoveryOptions {
  // Options are no longer used. Path discovery is handled by the backend.
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
 * Uses backend shallow clone approach which:
 * - Works with any Git provider (GitHub, GitLab, Bitbucket, etc.)
 * - Has no API rate limits
 * - Handles private repos with credentials
 *
 * The options parameter is kept for API compatibility but is no longer used.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for API compatibility
export function usePathDiscovery(_options: UsePathDiscoveryOptions = {}): UsePathDiscoveryResult {

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
      // Use backend shallow clone approach (provider-agnostic, no rate limits)
      const result = await backendService.discoverPaths({
        repo: repoUrl,
        branch: branch || undefined,
      });

      // Update both ref and state immediately
      repoPathsCacheRef.current[repoUrl] = result.paths;
      setRepoPathsCache((prev) => ({ ...prev, [repoUrl]: result.paths }));
      // Clear start time on success
      setDiscoveryStartTimes((prev) => {
        const next = { ...prev };
        delete next[repoUrl];
        return next;
      });

      console.log(`[PathDiscovery] Discovered ${result.paths.length} paths in ${repoUrl} (clone: ${result.cloneTimeMs}ms, scan: ${result.scanTimeMs}ms)`);
    } catch (err) {
      console.error(`Failed to discover paths for ${repoUrl}:`, err);
      const errorMsg = getErrorMessage(err);
      setDiscoveryErrors((prev) => ({ ...prev, [repoUrl]: errorMsg }));
      // Don't cache empty array on error - allow retry
    } finally {
      loadingRepoPathsRef.current.delete(repoUrl);
    }
  }, []);

  return {
    repoPathsCache,
    discoveryErrors,
    discoveryStartTimes,
    isLoadingPaths,
    discoverPathsForRepo,
    clearDiscoveryCache,
  };
}
