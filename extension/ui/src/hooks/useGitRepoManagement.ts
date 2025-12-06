import { useState, useCallback, useEffect, useRef } from 'react';
import { backendService } from '../services/BackendService';
import { getErrorMessage } from '../utils';
import { GitRepo, FleetState } from '../types';

const STORAGE_KEY = 'fleet-gitrepo-configs';

// Debug logging helper
function debugLog(message: string, data?: unknown): void {
  console.log(`[GitRepoMgmt] ${message}`, data);
  backendService.debugLog('GitRepoMgmt', message, data).catch(() => {
    // Ignore logging errors
  });
}

/** Repo configuration stored in localStorage (independent of Kubernetes) */
interface RepoConfig {
  name: string;
  repo: string;
  branch?: string;
  paths: string[];
}

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
  clearAllGitRepos: () => Promise<void>;
}

/** Load repo configs from localStorage */
function loadRepoConfigs(): RepoConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    debugLog('loadRepoConfigs: loading from localStorage', { hasData: !!stored, rawData: stored });
    if (stored) {
      const configs = JSON.parse(stored);
      debugLog('loadRepoConfigs: parsed configs', configs);
      return configs;
    }
  } catch (err) {
    console.error('Failed to load repo configs from localStorage:', err);
  }
  debugLog('loadRepoConfigs: no configs found, returning empty array');
  return [];
}

/** Save repo configs to localStorage */
function saveRepoConfigs(configs: RepoConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  } catch (err) {
    console.error('Failed to save repo configs to localStorage:', err);
  }
}

/**
 * Hook for managing GitRepo resources via the backend service.
 *
 * Repo configurations are stored in localStorage. Kubernetes GitRepo resources
 * are only created when paths are selected (paths.length > 0). When all paths
 * are deselected, the Kubernetes resource is deleted but the config remains
 * in localStorage so users can re-select paths without re-adding the repo.
 */
export function useGitRepoManagement(options: UseGitRepoManagementOptions): UseGitRepoManagementResult {
  const { fleetState, onReposLoaded } = options;
  const [repoConfigs, setRepoConfigs] = useState<RepoConfig[]>(() => loadRepoConfigs());
  const [k8sRepos, setK8sRepos] = useState<GitRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [updatingRepo, setUpdatingRepo] = useState<string | null>(null);

  const onReposLoadedRef = useRef(onReposLoaded);

  useEffect(() => {
    onReposLoadedRef.current = onReposLoaded;
  }, [onReposLoaded]);

  // Persist repo configs to localStorage whenever they change
  useEffect(() => {
    saveRepoConfigs(repoConfigs);
  }, [repoConfigs]);

  // Merge localStorage configs with Kubernetes state for display
  // localStorage is the source of truth for repo list; K8s provides status
  const gitRepos: GitRepo[] = repoConfigs.map((config) => {
    const k8sRepo = k8sRepos.find((r) => r.name === config.name);
    return {
      name: config.name,
      repo: config.repo,
      branch: config.branch,
      paths: config.paths,
      paused: k8sRepo?.paused,
      status: k8sRepo?.status,
    };
  });

  const fetchGitRepos = useCallback(async () => {
    setLoadingRepos(true);
    setRepoError(null);
    try {
      const repos = await backendService.listGitRepos();

      // Only update state if data actually changed (prevents scroll reset)
      setK8sRepos((prevRepos) => {
        const prevJson = JSON.stringify(prevRepos);
        const newJson = JSON.stringify(repos);
        if (prevJson !== newJson) {
          return repos;
        }
        return prevRepos;
      });
    } catch (err) {
      const errMsg = getErrorMessage(err);
      // Backend returns empty array for no repos, not an error
      if (errMsg.includes('No resources found') || errMsg.includes('503')) {
        setK8sRepos([]);
      } else {
        console.error('Failed to fetch GitRepos:', err);
        setRepoError(errMsg);
      }
    } finally {
      setLoadingRepos(false);
    }
  }, []);

  // Notify when gitRepos changes
  useEffect(() => {
    onReposLoadedRef.current?.(gitRepos);
  }, [gitRepos]);

  // Update GitRepo paths - creates/deletes K8s resource as needed
  const updateGitRepoPaths = useCallback(async (repo: GitRepo, newPaths: string[]) => {
    debugLog('updateGitRepoPaths called', { repoName: repo.name, newPaths, currentPaths: repo.paths });
    setUpdatingRepo(repo.name);

    // Update local config immediately (optimistic update)
    setRepoConfigs((prev) =>
      prev.map((r) =>
        r.name === repo.name ? { ...r, paths: newPaths } : r
      )
    );

    try {
      const k8sRepoExists = k8sRepos.some((r) => r.name === repo.name);
      debugLog('updateGitRepoPaths k8s check', { k8sRepoExists, newPathsLength: newPaths.length });

      if (newPaths.length > 0) {
        // Paths selected - create or update K8s resource
        debugLog('updateGitRepoPaths: calling applyGitRepo', { name: repo.name, paths: newPaths });
        await backendService.applyGitRepo({
          name: repo.name,
          repo: repo.repo,
          branch: repo.branch,
          paths: newPaths,
          paused: repo.paused,
        });
      } else if (k8sRepoExists) {
        // No paths selected and K8s resource exists - delete it
        debugLog('updateGitRepoPaths: calling deleteGitRepo', { name: repo.name });
        await backendService.deleteGitRepo(repo.name);
      } else {
        debugLog('updateGitRepoPaths: no action needed (no paths, no k8s resource)');
      }

      await fetchGitRepos();
    } catch (err) {
      console.error('Failed to update GitRepo:', err);
      setRepoError(getErrorMessage(err));
      // Revert optimistic update on error
      setRepoConfigs((prev) =>
        prev.map((r) =>
          r.name === repo.name ? { ...r, paths: repo.paths || [] } : r
        )
      );
      await fetchGitRepos();
    } finally {
      setUpdatingRepo(null);
    }
  }, [k8sRepos, fetchGitRepos]);

  // Toggle a path for an existing repo
  const toggleRepoPath = useCallback((repo: GitRepo, path: string) => {
    const currentPaths = repo.paths || [];
    const newPaths = currentPaths.includes(path)
      ? currentPaths.filter((p) => p !== path)
      : [...currentPaths, path];
    updateGitRepoPaths(repo, newPaths);
  }, [updateGitRepoPaths]);

  // Add a new GitRepo - stores config locally without creating K8s resource
  const addGitRepo = useCallback(async (name: string, repoUrl: string, branch?: string): Promise<AddGitRepoResult> => {
    debugLog('addGitRepo called', { name, repoUrl, branch });

    if (!name || !repoUrl) return { success: false, error: 'Name and URL are required' };

    // Check if a repo with this name already exists in local config
    if (repoConfigs.some((r) => r.name === name)) {
      const error = `A repository named "${name}" already exists. Please choose a different name.`;
      setRepoError(error);
      return { success: false, error };
    }

    // Add to local config only - no K8s resource created until paths are selected
    const newConfig: RepoConfig = {
      name,
      repo: repoUrl,
      branch,
      paths: [],
    };

    debugLog('addGitRepo: storing in localStorage only (no K8s resource)', newConfig);
    setRepoConfigs((prev: RepoConfig[]) => [...prev, newConfig]);
    return { success: true };
  }, [repoConfigs]);

  // Delete a GitRepo - removes from both localStorage and K8s
  const deleteGitRepo = useCallback(async (name: string) => {
    // Remove from local config
    setRepoConfigs((prev: RepoConfig[]) => prev.filter((r: RepoConfig) => r.name !== name));

    // Delete K8s resource if it exists
    const k8sRepoExists = k8sRepos.some((r: GitRepo) => r.name === name);
    if (k8sRepoExists) {
      try {
        await backendService.deleteGitRepo(name);
        await fetchGitRepos();
      } catch (err) {
        console.error('Failed to delete GitRepo from K8s:', err);
        setRepoError(getErrorMessage(err));
      }
    }
  }, [k8sRepos, fetchGitRepos]);

  const clearRepoError = useCallback(() => {
    setRepoError(null);
  }, []);

  // Clear all GitRepos - removes from both localStorage and K8s
  const clearAllGitRepos = useCallback(async () => {
    debugLog('clearAllGitRepos called', { repoCount: repoConfigs.length, k8sRepoCount: k8sRepos.length });

    // Delete all K8s resources first
    const deletePromises = k8sRepos.map(async (repo) => {
      try {
        await backendService.deleteGitRepo(repo.name);
        debugLog('clearAllGitRepos: deleted K8s repo', { name: repo.name });
      } catch (err) {
        console.error(`Failed to delete K8s repo ${repo.name}:`, err);
        // Continue with other deletions even if one fails
      }
    });

    await Promise.all(deletePromises);

    // Clear localStorage config
    setRepoConfigs([]);
    debugLog('clearAllGitRepos: cleared localStorage');

    // Refresh K8s state
    await fetchGitRepos();
  }, [repoConfigs.length, k8sRepos, fetchGitRepos]);

  // Auto-refresh when there are repos that aren't ready yet
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldRefreshRef = useRef(false);

  // Update the ref when conditions change
  useEffect(() => {
    const hasUnreadyRepos = k8sRepos.some((repo: GitRepo) => !repo.status?.ready);
    shouldRefreshRef.current = hasUnreadyRepos && fleetState.status === 'running';
  }, [k8sRepos, fleetState.status]);

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
    clearAllGitRepos,
  };
}
