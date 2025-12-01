import { useState, useCallback, useEffect, useRef } from 'react';
import { KubernetesService } from '../services';
import { getErrorMessage } from '../utils';
import { GitRepo, FleetState } from '../types';

interface UseGitRepoManagementOptions {
  fleetState: FleetState;
  onReposLoaded?: (repos: GitRepo[]) => void;
  /**
   * Optional KubernetesService for dependency injection.
   * If not provided, the hook must be used within a ServiceProvider.
   */
  kubernetesService?: KubernetesService;
}

interface AddGitRepoResult {
  success: boolean;
  error?: string;
}

interface UseGitRepoManagementResult {
  gitRepos: GitRepo[];
  loadingRepos: boolean;
  repoError: string | null;
  updatingRepo: string | null;
  fetchGitRepos: () => Promise<void>;
  addGitRepo: (name: string, repoUrl: string, branch?: string) => Promise<AddGitRepoResult>;
  deleteGitRepo: (name: string) => Promise<void>;
  updateGitRepoPaths: (repo: GitRepo, newPaths: string[]) => Promise<void>;
  toggleRepoPath: (repo: GitRepo, path: string) => void;
  clearRepoError: () => void;
}

/**
 * Hook for managing GitRepo resources.
 *
 * Can be used in two ways:
 * 1. With injected service (for testing):
 *    ```ts
 *    const mockService = new KubernetesService(mockExecutor);
 *    useGitRepoManagement({ fleetState, kubernetesService: mockService });
 *    ```
 *
 * 2. With ServiceProvider context (for production):
 *    ```tsx
 *    <ServiceProvider>
 *      <ComponentUsingGitRepoManagement />
 *    </ServiceProvider>
 *    ```
 */
export function useGitRepoManagement(options: UseGitRepoManagementOptions): UseGitRepoManagementResult {
  const { fleetState, onReposLoaded, kubernetesService } = options;
  const [gitRepos, setGitRepos] = useState<GitRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [updatingRepo, setUpdatingRepo] = useState<string | null>(null);

  const onReposLoadedRef = useRef(onReposLoaded);
  const serviceRef = useRef(kubernetesService);

  useEffect(() => {
    onReposLoadedRef.current = onReposLoaded;
  }, [onReposLoaded]);

  useEffect(() => {
    serviceRef.current = kubernetesService;
  }, [kubernetesService]);

  const fetchGitRepos = useCallback(async () => {
    const service = serviceRef.current;
    if (!service) {
      console.error('KubernetesService not available');
      return;
    }

    setLoadingRepos(true);
    setRepoError(null);
    try {
      const repos = await service.fetchGitRepos();

      // Only update state if data actually changed (prevents scroll reset)
      setGitRepos((prevRepos) => {
        const prevJson = JSON.stringify(prevRepos);
        const newJson = JSON.stringify(repos);
        if (prevJson !== newJson) {
          onReposLoadedRef.current?.(repos);
          return repos;
        }
        return prevRepos;
      });
    } catch (err) {
      const errMsg = getErrorMessage(err);
      if (errMsg.includes('No resources found')) {
        setGitRepos([]);
      } else {
        console.error('Failed to fetch GitRepos:', err);
        setRepoError(errMsg);
      }
    } finally {
      setLoadingRepos(false);
    }
  }, []);

  // Update GitRepo paths
  const updateGitRepoPaths = useCallback(async (repo: GitRepo, newPaths: string[]) => {
    const service = serviceRef.current;
    if (!service) {
      console.error('KubernetesService not available');
      return;
    }

    setUpdatingRepo(repo.name);

    // Optimistic update - update local state immediately to prevent scroll jump
    setGitRepos((prev) =>
      prev.map((r) =>
        r.name === repo.name ? { ...r, paths: newPaths } : r
      )
    );

    try {
      await service.applyGitRepo(repo.name, repo.repo, repo.branch, newPaths);
      // Don't call fetchGitRepos() - optimistic update is sufficient
      // The periodic refresh will sync any server-side changes
    } catch (err) {
      console.error('Failed to update GitRepo:', err);
      setRepoError(getErrorMessage(err));
      // Revert optimistic update on error
      await fetchGitRepos();
    } finally {
      setUpdatingRepo(null);
    }
  }, [fetchGitRepos]);

  // Toggle a path for an existing repo
  const toggleRepoPath = useCallback((repo: GitRepo, path: string) => {
    const currentPaths = repo.paths || [];
    const newPaths = currentPaths.includes(path)
      ? currentPaths.filter((p) => p !== path)
      : [...currentPaths, path];
    updateGitRepoPaths(repo, newPaths);
  }, [updateGitRepoPaths]);

  // Add a new GitRepo
  const addGitRepo = useCallback(async (name: string, repoUrl: string, branch?: string): Promise<AddGitRepoResult> => {
    const service = serviceRef.current;
    if (!service) {
      return { success: false, error: 'Service not configured' };
    }

    if (!name || !repoUrl) return { success: false, error: 'Name and URL are required' };

    // Check if a repo with this name already exists
    if (gitRepos.some((r) => r.name === name)) {
      const error = `A repository named "${name}" already exists. Please choose a different name.`;
      setRepoError(error);
      return { success: false, error };
    }

    try {
      await service.applyGitRepo(name, repoUrl, branch);
      await fetchGitRepos();
      return { success: true };
    } catch (err) {
      console.error('Failed to add GitRepo:', err);
      const error = getErrorMessage(err);
      setRepoError(error);
      return { success: false, error };
    }
  }, [gitRepos, fetchGitRepos]);

  // Delete a GitRepo
  const deleteGitRepo = useCallback(async (name: string) => {
    const service = serviceRef.current;
    if (!service) {
      console.error('KubernetesService not available');
      return;
    }

    try {
      await service.deleteGitRepo(name);
      await fetchGitRepos();
    } catch (err) {
      console.error('Failed to delete GitRepo:', err);
      setRepoError(getErrorMessage(err));
    }
  }, [fetchGitRepos]);

  const clearRepoError = useCallback(() => {
    setRepoError(null);
  }, []);

  // Auto-refresh when there are repos that aren't ready yet
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldRefreshRef = useRef(false);

  // Update the ref when conditions change
  useEffect(() => {
    const hasUnreadyRepos = gitRepos.some((repo) => !repo.status?.ready);
    shouldRefreshRef.current = hasUnreadyRepos && fleetState.status === 'running';
  }, [gitRepos, fleetState.status]);

  // Set up polling interval once
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      if (shouldRefreshRef.current) {
        fetchGitRepos();
      }
    }, 5000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchGitRepos]);

  return {
    gitRepos,
    loadingRepos,
    repoError,
    updatingRepo,
    fetchGitRepos,
    addGitRepo,
    deleteGitRepo,
    updateGitRepoPaths,
    toggleRepoPath,
    clearRepoError,
  };
}
