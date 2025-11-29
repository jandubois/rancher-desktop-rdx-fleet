import { useState, useCallback, useEffect, useRef } from 'react';
import { ddClient } from '../lib/ddClient';
import { getErrorMessage, KUBE_CONTEXT, FLEET_NAMESPACE } from '../utils';
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
      const result = await ddClient.extension.host?.cli.exec('kubectl', [
        '--context', KUBE_CONTEXT,
        'get', 'gitrepos', '-n', FLEET_NAMESPACE,
        '-o', 'json',
      ]);

      if (result?.stderr) {
        throw new Error(result.stderr);
      }

      const data = JSON.parse(result?.stdout || '{"items":[]}');
      const repos: GitRepo[] = data.items.map((item: Record<string, unknown>) => {
        const spec = item.spec as Record<string, unknown> || {};
        const status = item.status as Record<string, unknown> || {};
        const metadata = item.metadata as Record<string, unknown> || {};
        const conditions = (status.conditions as Array<Record<string, unknown>>) || [];
        const display = status.display as Record<string, unknown> | undefined;
        const resources = (status.resources as Array<Record<string, unknown>>) || [];

        return {
          name: metadata.name as string,
          repo: spec.repo as string,
          branch: spec.branch as string | undefined,
          paths: spec.paths as string[] | undefined,
          status: {
            ready: conditions.some((c) => c.type === 'Ready' && c.status === 'True'),
            display: display ? {
              state: display.state as string | undefined,
              message: display.message as string | undefined,
              error: display.error as boolean | undefined,
            } : undefined,
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
      });

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
    setUpdatingRepo(repo.name);

    // Optimistic update - update local state immediately to prevent scroll jump
    setGitRepos((prev) =>
      prev.map((r) =>
        r.name === repo.name ? { ...r, paths: newPaths } : r
      )
    );

    try {
      const gitRepoYaml = {
        apiVersion: 'fleet.cattle.io/v1alpha1',
        kind: 'GitRepo',
        metadata: {
          name: repo.name,
          namespace: FLEET_NAMESPACE,
        },
        spec: {
          repo: repo.repo,
          ...(repo.branch && { branch: repo.branch }),
          ...(newPaths.length > 0 && { paths: newPaths }),
        },
      };

      const jsonStr = JSON.stringify(gitRepoYaml);
      await ddClient.extension.host?.cli.exec('kubectl', [
        '--apply-json', jsonStr,
        '--context', KUBE_CONTEXT,
      ]);

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
      // Create GitRepo with empty paths - user will select paths on the card
      const gitRepoYaml = {
        apiVersion: 'fleet.cattle.io/v1alpha1',
        kind: 'GitRepo',
        metadata: {
          name: name,
          namespace: FLEET_NAMESPACE,
        },
        spec: {
          repo: repoUrl,
          ...(branch && { branch }),
          // No paths initially - paths are selected on the card after discovery
        },
      };

      const jsonStr = JSON.stringify(gitRepoYaml);
      await ddClient.extension.host?.cli.exec('kubectl', [
        '--apply-json', jsonStr,
        '--context', KUBE_CONTEXT,
      ]);

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
      await ddClient.extension.host?.cli.exec('kubectl', [
        '--context', KUBE_CONTEXT,
        'delete', 'gitrepo', name, '-n', FLEET_NAMESPACE,
      ]);
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
