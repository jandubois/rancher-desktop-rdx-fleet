import { useState, useCallback, useEffect, useRef } from 'react';
import { backendService } from '../services/BackendService';
import { getErrorMessage } from '../utils';
import { GitRepo, FleetState } from '../types';

interface UseGitRepoManagementOptions {
  fleetState: FleetState;
  onReposLoaded?: (repos: GitRepo[]) => void;
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
 * Hook for managing GitRepo resources via the backend service.
 *
 * All Kubernetes operations are delegated to the backend, which uses
 * the Kubernetes client library directly instead of kubectl CLI.
 */
export function useGitRepoManagement(options: UseGitRepoManagementOptions): UseGitRepoManagementResult {
  const { fleetState, onReposLoaded } = options;
  const [gitRepos, setGitRepos] = useState<GitRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [updatingRepo, setUpdatingRepo] = useState<string | null>(null);

  const onReposLoadedRef = useRef(onReposLoaded);

  useEffect(() => {
    onReposLoadedRef.current = onReposLoaded;
  }, [onReposLoaded]);

  const fetchGitRepos = useCallback(async () => {
    setLoadingRepos(true);
    setRepoError(null);
    try {
      const repos = await backendService.listGitRepos();

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
      // Backend returns empty array for no repos, not an error
      if (errMsg.includes('No resources found') || errMsg.includes('503')) {
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
    setUpdatingRepo(repo.name);

    // Optimistic update - update local state immediately to prevent scroll jump
    setGitRepos((prev) =>
      prev.map((r) =>
        r.name === repo.name ? { ...r, paths: newPaths } : r
      )
    );

    try {
      await backendService.applyGitRepo({
        name: repo.name,
        repo: repo.repo,
        branch: repo.branch,
        paths: newPaths,
        paused: repo.paused,
      });
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
    if (!name || !repoUrl) return { success: false, error: 'Name and URL are required' };

    // Check if a repo with this name already exists
    if (gitRepos.some((r) => r.name === name)) {
      const error = `A repository named "${name}" already exists. Please choose a different name.`;
      setRepoError(error);
      return { success: false, error };
    }

    try {
      await backendService.applyGitRepo({
        name,
        repo: repoUrl,
        branch,
      });
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
    try {
      await backendService.deleteGitRepo(name);
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
