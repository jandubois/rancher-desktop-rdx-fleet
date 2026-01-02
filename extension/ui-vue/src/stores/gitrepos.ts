/**
 * GitRepos Store - Manages GitRepo resources from Kubernetes.
 * Uses Pinia with Vue's reactivity for state management.
 */

import { defineStore } from 'pinia';
import { ref, computed, onUnmounted } from 'vue';
import { backendService, type GitRepo, type GitRepoRequest } from '../services/BackendService';

export const useGitReposStore = defineStore('gitrepos', () => {
  // State
  const repos = ref<GitRepo[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const isPolling = ref(false);
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  // Computed - derived state
  const repoCount = computed(() => repos.value.length);

  const reposByName = computed(() =>
    new Map(repos.value.map(repo => [repo.name, repo]))
  );

  const readyRepos = computed(() =>
    repos.value.filter(repo => repo.status?.ready === true)
  );

  const errorRepos = computed(() =>
    repos.value.filter(repo => repo.status?.display?.error === true)
  );

  // Actions
  async function fetchRepos() {
    loading.value = true;
    error.value = null;

    try {
      repos.value = await backendService.listGitRepos();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch GitRepos';
      console.error('Failed to fetch GitRepos:', e);
    } finally {
      loading.value = false;
    }
  }

  async function createRepo(request: GitRepoRequest): Promise<GitRepo | null> {
    try {
      const created = await backendService.applyGitRepo(request);
      // Refresh the list to get the updated state
      await fetchRepos();
      return created;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create GitRepo';
      throw e;
    }
  }

  async function updateRepo(request: GitRepoRequest): Promise<GitRepo | null> {
    try {
      const updated = await backendService.applyGitRepo(request);
      await fetchRepos();
      return updated;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update GitRepo';
      throw e;
    }
  }

  async function deleteRepo(name: string): Promise<void> {
    try {
      await backendService.deleteGitRepo(name);
      // Optimistically remove from local state
      repos.value = repos.value.filter(r => r.name !== name);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete GitRepo';
      throw e;
    }
  }

  function getRepo(name: string): GitRepo | undefined {
    return reposByName.value.get(name);
  }

  function startPolling(intervalMs = 5000) {
    if (isPolling.value) return;

    isPolling.value = true;
    fetchRepos(); // Initial fetch

    pollInterval = setInterval(() => {
      fetchRepos();
    }, intervalMs);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    isPolling.value = false;
  }

  // Cleanup
  onUnmounted(() => {
    stopPolling();
  });

  return {
    // State
    repos,
    loading,
    error,
    isPolling,

    // Computed
    repoCount,
    reposByName,
    readyRepos,
    errorRepos,

    // Actions
    fetchRepos,
    createRepo,
    updateRepo,
    deleteRepo,
    getRepo,
    startPolling,
    stopPolling,
  };
});
