/**
 * Unit tests for the gitrepos Pinia store.
 * Tests GitRepo CRUD operations and polling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useGitReposStore } from './gitrepos';
import type { GitRepo, GitRepoRequest } from '../services/BackendService';

// Mock the backend service
vi.mock('../services/BackendService', () => ({
  backendService: {
    listGitRepos: vi.fn(),
    applyGitRepo: vi.fn(),
    deleteGitRepo: vi.fn(),
  },
}));

import { backendService } from '../services/BackendService';
const mockListGitRepos = vi.mocked(backendService.listGitRepos);
const mockApplyGitRepo = vi.mocked(backendService.applyGitRepo);
const mockDeleteGitRepo = vi.mocked(backendService.deleteGitRepo);

const createMockRepo = (name: string, ready = true): GitRepo => ({
  name,
  repo: `https://github.com/test/${name}`,
  branch: 'main',
  paths: ['bundle'],
  status: {
    ready,
    desiredReadyClusters: 1,
    readyClusters: ready ? 1 : 0,
    display: {
      state: ready ? 'Active' : 'Pending',
      error: false,
    },
  },
});

describe('useGitReposStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should initialize with empty repos', () => {
      const store = useGitReposStore();

      expect(store.repos).toEqual([]);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.isPolling).toBe(false);
    });
  });

  describe('computed properties', () => {
    it('should compute repoCount', () => {
      const store = useGitReposStore();
      store.repos = [createMockRepo('repo1'), createMockRepo('repo2')];

      expect(store.repoCount).toBe(2);
    });

    it('should compute reposByName as a Map', () => {
      const store = useGitReposStore();
      const repo1 = createMockRepo('repo1');
      const repo2 = createMockRepo('repo2');
      store.repos = [repo1, repo2];

      expect(store.reposByName.get('repo1')).toEqual(repo1);
      expect(store.reposByName.get('repo2')).toEqual(repo2);
      expect(store.reposByName.get('nonexistent')).toBeUndefined();
    });

    it('should compute readyRepos', () => {
      const store = useGitReposStore();
      store.repos = [
        createMockRepo('ready1', true),
        createMockRepo('notready', false),
        createMockRepo('ready2', true),
      ];

      expect(store.readyRepos).toHaveLength(2);
      expect(store.readyRepos.map(r => r.name)).toEqual(['ready1', 'ready2']);
    });

    it('should compute errorRepos', () => {
      const store = useGitReposStore();
      store.repos = [
        createMockRepo('ok'),
        {
          ...createMockRepo('error'),
          status: {
            ready: false,
            desiredReadyClusters: 1,
            readyClusters: 0,
            display: { state: 'Error', error: true, message: 'Failed' },
          },
        },
      ];

      expect(store.errorRepos).toHaveLength(1);
      expect(store.errorRepos[0].name).toBe('error');
    });
  });

  describe('fetchRepos', () => {
    it('should fetch and store repos', async () => {
      const mockRepos = [createMockRepo('repo1'), createMockRepo('repo2')];
      mockListGitRepos.mockResolvedValue(mockRepos);

      const store = useGitReposStore();
      await store.fetchRepos();

      expect(store.repos).toEqual(mockRepos);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should set loading state during fetch', async () => {
      mockListGitRepos.mockImplementation(() => new Promise(() => {})); // Never resolves

      const store = useGitReposStore();
      void store.fetchRepos(); // Don't await - we want to check loading state

      expect(store.loading).toBe(true);

      // Clean up
      vi.useRealTimers();
    });

    it('should handle fetch error', async () => {
      mockListGitRepos.mockRejectedValue(new Error('Network error'));

      const store = useGitReposStore();
      await store.fetchRepos();

      expect(store.error).toBe('Network error');
      expect(store.loading).toBe(false);
    });
  });

  describe('createRepo', () => {
    it('should create repo and refresh list', async () => {
      const newRepo = createMockRepo('new-repo');
      mockApplyGitRepo.mockResolvedValue(newRepo);
      mockListGitRepos.mockResolvedValue([newRepo]);

      const store = useGitReposStore();
      const request: GitRepoRequest = {
        name: 'new-repo',
        repo: 'https://github.com/test/new-repo',
        paths: ['bundle'],
      };

      const result = await store.createRepo(request);

      expect(result).toEqual(newRepo);
      expect(mockApplyGitRepo).toHaveBeenCalledWith(request);
      expect(mockListGitRepos).toHaveBeenCalled();
    });

    it('should throw and set error on failure', async () => {
      mockApplyGitRepo.mockRejectedValue(new Error('Create failed'));

      const store = useGitReposStore();
      const request: GitRepoRequest = {
        name: 'new-repo',
        repo: 'https://github.com/test/new-repo',
      };

      await expect(store.createRepo(request)).rejects.toThrow('Create failed');
      expect(store.error).toBe('Create failed');
    });
  });

  describe('updateRepo', () => {
    it('should update repo and refresh list', async () => {
      const updatedRepo = createMockRepo('existing');
      mockApplyGitRepo.mockResolvedValue(updatedRepo);
      mockListGitRepos.mockResolvedValue([updatedRepo]);

      const store = useGitReposStore();
      const request: GitRepoRequest = {
        name: 'existing',
        repo: 'https://github.com/test/existing',
        paths: ['new-path'],
      };

      const result = await store.updateRepo(request);

      expect(result).toEqual(updatedRepo);
      expect(mockApplyGitRepo).toHaveBeenCalledWith(request);
    });
  });

  describe('deleteRepo', () => {
    it('should delete repo and remove from local state', async () => {
      mockDeleteGitRepo.mockResolvedValue(undefined);

      const store = useGitReposStore();
      store.repos = [createMockRepo('keep'), createMockRepo('delete')];

      await store.deleteRepo('delete');

      expect(mockDeleteGitRepo).toHaveBeenCalledWith('delete');
      expect(store.repos).toHaveLength(1);
      expect(store.repos[0].name).toBe('keep');
    });

    it('should throw and set error on failure', async () => {
      mockDeleteGitRepo.mockRejectedValue(new Error('Delete failed'));

      const store = useGitReposStore();
      store.repos = [createMockRepo('repo')];

      await expect(store.deleteRepo('repo')).rejects.toThrow('Delete failed');
      expect(store.error).toBe('Delete failed');
    });
  });

  describe('getRepo', () => {
    it('should return repo by name', () => {
      const store = useGitReposStore();
      const repo = createMockRepo('target');
      store.repos = [createMockRepo('other'), repo];

      expect(store.getRepo('target')).toEqual(repo);
    });

    it('should return undefined for non-existent repo', () => {
      const store = useGitReposStore();
      store.repos = [createMockRepo('existing')];

      expect(store.getRepo('nonexistent')).toBeUndefined();
    });
  });

  describe('polling', () => {
    it('should start polling and fetch immediately', async () => {
      mockListGitRepos.mockResolvedValue([]);

      const store = useGitReposStore();
      store.startPolling(5000);

      expect(store.isPolling).toBe(true);

      await vi.waitFor(() => {
        expect(mockListGitRepos).toHaveBeenCalledTimes(1);
      });
    });

    it('should poll at the specified interval', async () => {
      mockListGitRepos.mockResolvedValue([]);

      const store = useGitReposStore();
      store.startPolling(1000);

      await vi.waitFor(() => {
        expect(mockListGitRepos).toHaveBeenCalledTimes(1);
      });

      await vi.advanceTimersByTimeAsync(1000);
      expect(mockListGitRepos).toHaveBeenCalledTimes(2);
    });

    it('should stop polling', async () => {
      mockListGitRepos.mockResolvedValue([]);

      const store = useGitReposStore();
      store.startPolling(1000);
      store.stopPolling();

      expect(store.isPolling).toBe(false);

      const callCount = mockListGitRepos.mock.calls.length;
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockListGitRepos.mock.calls.length).toBe(callCount);
    });
  });
});
