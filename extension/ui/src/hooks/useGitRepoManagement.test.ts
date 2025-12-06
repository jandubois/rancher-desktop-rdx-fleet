import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGitRepoManagement } from './useGitRepoManagement';
import { FleetState, GitRepo } from '../types';
import { backendService } from '../services/BackendService';

// Mock the backendService
vi.mock('../services/BackendService', () => ({
  backendService: {
    listGitRepos: vi.fn(),
    applyGitRepo: vi.fn(),
    deleteGitRepo: vi.fn(),
    debugLog: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Suppress console.error and console.log in tests
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});

// Helper to pre-populate localStorage with repo configs
const STORAGE_KEY = 'fleet-gitrepo-configs';
function setLocalStorageConfigs(configs: Array<{ name: string; repo: string; branch?: string; paths: string[] }>): void {
  localStorageMock.setItem(STORAGE_KEY, JSON.stringify(configs));
}

// Sample GitRepo data for tests (K8s responses)
const sampleGitRepos: GitRepo[] = [
  {
    name: 'my-repo',
    repo: 'https://github.com/owner/repo',
    branch: 'main',
    paths: ['app1'],
    status: {
      ready: true,
      display: { state: 'Active', message: '' },
      desiredReadyClusters: 1,
      readyClusters: 1,
      resources: [{ kind: 'Deployment', name: 'my-app', state: 'Ready' }],
      conditions: [{ type: 'Ready', status: 'True' }],
    },
  },
];

// Sample localStorage configs (matching the K8s repos above)
const sampleRepoConfigs = [
  {
    name: 'my-repo',
    repo: 'https://github.com/owner/repo',
    branch: 'main',
    paths: ['app1'],
  },
];

describe('useGitRepoManagement', () => {
  const defaultFleetState: FleetState = { status: 'running', version: '0.10.0' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    localStorageMock.clear();
  });

  it('initializes with empty repos and no error', () => {
    vi.mocked(backendService.listGitRepos).mockResolvedValue([]);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    expect(result.current.gitRepos).toEqual([]);
    expect(result.current.repoError).toBeNull();
    expect(result.current.loadingRepos).toBe(false);
  });

  it('fetches GitRepos via backend service and merges with localStorage', async () => {
    // Pre-populate localStorage with repo config
    setLocalStorageConfigs(sampleRepoConfigs);
    vi.mocked(backendService.listGitRepos).mockResolvedValueOnce(sampleGitRepos);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    expect(backendService.listGitRepos).toHaveBeenCalled();
    expect(result.current.gitRepos).toHaveLength(1);
    expect(result.current.gitRepos[0].name).toBe('my-repo');
  });

  it('parses GitRepo status correctly', async () => {
    setLocalStorageConfigs(sampleRepoConfigs);
    vi.mocked(backendService.listGitRepos).mockResolvedValueOnce(sampleGitRepos);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    const repo = result.current.gitRepos[0];
    expect(repo.status?.ready).toBe(true);
    expect(repo.status?.display?.state).toBe('Active');
    expect(repo.status?.desiredReadyClusters).toBe(1);
    expect(repo.status?.readyClusters).toBe(1);
    expect(repo.status?.resources).toHaveLength(1);
    expect(repo.status?.conditions).toHaveLength(1);
  });

  it('only updates k8s state when data changes', async () => {
    setLocalStorageConfigs(sampleRepoConfigs);
    const onReposLoaded = vi.fn();
    vi.mocked(backendService.listGitRepos).mockResolvedValue(sampleGitRepos);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, onReposLoaded })
    );

    // First fetch
    await act(async () => {
      await result.current.fetchGitRepos();
    });

    // onReposLoaded is called on init and on fetch
    const initialCallCount = onReposLoaded.mock.calls.length;

    // Second fetch with same data
    await act(async () => {
      await result.current.fetchGitRepos();
    });

    // K8s data didn't change, so no new notification
    expect(onReposLoaded.mock.calls.length).toBe(initialCallCount);
  });

  it('calls onReposLoaded callback when repos are configured', async () => {
    const onReposLoaded = vi.fn();
    vi.mocked(backendService.listGitRepos).mockResolvedValue([]);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, onReposLoaded })
    );

    // Add a repo (which populates localStorage)
    await act(async () => {
      await result.current.addGitRepo('my-repo', 'https://github.com/owner/repo', 'main');
    });

    expect(onReposLoaded).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ name: 'my-repo' }),
    ]));
  });

  it('addGitRepo stores config in localStorage without calling backend', async () => {
    vi.mocked(backendService.listGitRepos).mockResolvedValue([]);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    let addResult: { success: boolean; error?: string };
    await act(async () => {
      addResult = await result.current.addGitRepo('my-repo', 'https://github.com/owner/repo', 'main');
    });

    expect(addResult!.success).toBe(true);
    // Should NOT call backend when adding - only stores in localStorage
    expect(backendService.applyGitRepo).not.toHaveBeenCalled();
    // Should have repo in local state with empty paths
    expect(result.current.gitRepos).toHaveLength(1);
    expect(result.current.gitRepos[0].name).toBe('my-repo');
    expect(result.current.gitRepos[0].paths).toEqual([]);
  });

  it('addGitRepo rejects duplicate names', async () => {
    vi.mocked(backendService.listGitRepos).mockResolvedValue([]);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    // Add first repo
    await act(async () => {
      await result.current.addGitRepo('my-repo', 'https://github.com/owner/repo', 'main');
    });

    // Try to add duplicate
    let addResult: { success: boolean; error?: string };
    await act(async () => {
      addResult = await result.current.addGitRepo('my-repo', 'https://github.com/owner/other', 'main');
    });

    expect(addResult!.success).toBe(false);
    expect(addResult!.error).toContain('already exists');
    expect(result.current.repoError).toContain('already exists');
  });

  it('addGitRepo returns error result when name is empty', async () => {
    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    let addResult: { success: boolean; error?: string };
    await act(async () => {
      addResult = await result.current.addGitRepo('', 'https://github.com/owner/repo');
    });

    expect(addResult!.success).toBe(false);
    expect(addResult!.error).toBe('Name and URL are required');
  });

  it('deleteGitRepo removes resource via backend service', async () => {
    setLocalStorageConfigs(sampleRepoConfigs);
    vi.mocked(backendService.listGitRepos)
      .mockResolvedValueOnce(sampleGitRepos)
      .mockResolvedValueOnce([]); // Refresh after delete

    vi.mocked(backendService.deleteGitRepo).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    await act(async () => {
      await result.current.deleteGitRepo('my-repo');
    });

    expect(backendService.deleteGitRepo).toHaveBeenCalledWith('my-repo');
    expect(result.current.gitRepos).toHaveLength(0);
  });

  it('updateGitRepoPaths updates optimistically', async () => {
    setLocalStorageConfigs(sampleRepoConfigs);
    vi.mocked(backendService.listGitRepos).mockResolvedValue(sampleGitRepos);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    const repo = result.current.gitRepos[0];

    // Mock the applyGitRepo to be slow
    let resolveApply: () => void;
    const applyPromise = new Promise<GitRepo>((resolve) => {
      resolveApply = () => resolve({ ...repo, paths: ['app1', 'app2'] });
    });
    vi.mocked(backendService.applyGitRepo).mockReturnValueOnce(applyPromise);

    // Start update (don't await)
    act(() => {
      result.current.updateGitRepoPaths(repo, ['app1', 'app2']);
    });

    // State should be updated immediately (optimistic)
    expect(result.current.gitRepos[0].paths).toEqual(['app1', 'app2']);
    expect(result.current.updatingRepo).toBe('my-repo');

    // Complete the update
    await act(async () => {
      resolveApply!();
      await applyPromise;
    });

    expect(result.current.updatingRepo).toBeNull();
  });

  it('updateGitRepoPaths sets error on failure', async () => {
    setLocalStorageConfigs(sampleRepoConfigs);
    vi.mocked(backendService.listGitRepos).mockResolvedValue(sampleGitRepos);

    vi.mocked(backendService.applyGitRepo).mockRejectedValueOnce(new Error('Apply failed'));

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    const repo = result.current.gitRepos[0];

    // The update will fail but the hook calls fetchGitRepos which resets the state
    await act(async () => {
      await result.current.updateGitRepoPaths(repo, ['app1', 'app2', 'app3']);
    });

    // After error and refetch, paths should be back to original
    expect(result.current.gitRepos[0].paths).toEqual(['app1']);
  });

  it('toggleRepoPath adds path when missing', async () => {
    setLocalStorageConfigs(sampleRepoConfigs);
    vi.mocked(backendService.listGitRepos).mockResolvedValue(sampleGitRepos);
    vi.mocked(backendService.applyGitRepo).mockResolvedValueOnce({
      ...sampleGitRepos[0],
      paths: ['app1', 'app2'],
    });

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    const repo = result.current.gitRepos[0];

    act(() => {
      result.current.toggleRepoPath(repo, 'app2');
    });

    expect(result.current.gitRepos[0].paths).toContain('app2');
  });

  it('toggleRepoPath removes path when present', async () => {
    setLocalStorageConfigs(sampleRepoConfigs);
    vi.mocked(backendService.listGitRepos).mockResolvedValue(sampleGitRepos);
    vi.mocked(backendService.deleteGitRepo).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    const repo = result.current.gitRepos[0];

    act(() => {
      result.current.toggleRepoPath(repo, 'app1');
    });

    // After toggling off the only path, paths should be empty
    expect(result.current.gitRepos[0].paths).not.toContain('app1');
  });

  it('clearRepoError clears the error', async () => {
    // Add a duplicate repo to trigger an error
    vi.mocked(backendService.listGitRepos).mockResolvedValue([]);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    // Add first repo
    await act(async () => {
      await result.current.addGitRepo('test', 'https://github.com/owner/repo');
    });

    // Try to add duplicate - this should set an error
    await act(async () => {
      await result.current.addGitRepo('test', 'https://github.com/owner/repo');
    });

    expect(result.current.repoError).toContain('already exists');

    act(() => {
      result.current.clearRepoError();
    });

    expect(result.current.repoError).toBeNull();
  });

  it('sets loadingRepos to true while fetching', async () => {
    let resolveFetch: (repos: GitRepo[]) => void;
    const fetchPromise = new Promise<GitRepo[]>((resolve) => {
      resolveFetch = (repos) => resolve(repos);
    });
    vi.mocked(backendService.listGitRepos).mockReturnValueOnce(fetchPromise);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    expect(result.current.loadingRepos).toBe(false);

    act(() => {
      result.current.fetchGitRepos();
    });

    expect(result.current.loadingRepos).toBe(true);

    await act(async () => {
      resolveFetch!([]);
      await fetchPromise;
    });

    expect(result.current.loadingRepos).toBe(false);
  });

  it('handles "No resources found" error gracefully', async () => {
    vi.mocked(backendService.listGitRepos).mockRejectedValueOnce(new Error('No resources found in fleet-local namespace'));

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    expect(result.current.gitRepos).toEqual([]);
    expect(result.current.repoError).toBeNull();
  });

  it('handles 503 service not ready gracefully', async () => {
    vi.mocked(backendService.listGitRepos).mockRejectedValueOnce(new Error('503 Service not ready'));

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    expect(result.current.gitRepos).toEqual([]);
    expect(result.current.repoError).toBeNull();
  });

  it('handles fetch error and sets repoError', async () => {
    vi.mocked(backendService.listGitRepos).mockRejectedValueOnce(new Error('Connection refused'));

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    expect(result.current.repoError).toBe('Connection refused');
  });

  it('sets up refresh interval for unready repos', async () => {
    const unreadyRepoConfigs = [
      { name: 'my-repo', repo: 'https://github.com/owner/repo', paths: ['app1'] },
    ];
    const unreadyRepos: GitRepo[] = [
      {
        name: 'my-repo',
        repo: 'https://github.com/owner/repo',
        status: {
          ready: false,
          desiredReadyClusters: 1,
          readyClusters: 0,
          resources: [],
          conditions: [{ type: 'Ready', status: 'False' }],
        },
      },
    ];

    setLocalStorageConfigs(unreadyRepoConfigs);
    vi.mocked(backendService.listGitRepos).mockResolvedValue(unreadyRepos);

    const { result, unmount } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    // Initial fetch to populate repos
    await act(async () => {
      await result.current.fetchGitRepos();
    });

    expect(result.current.gitRepos[0].status?.ready).toBe(false);

    // Clean up
    unmount();
  });

  it('detects ready status correctly', async () => {
    setLocalStorageConfigs(sampleRepoConfigs);
    vi.mocked(backendService.listGitRepos).mockResolvedValueOnce(sampleGitRepos);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    expect(result.current.gitRepos[0].status?.ready).toBe(true);
  });

  it('updateGitRepoPaths creates K8s resource when paths are selected', async () => {
    vi.mocked(backendService.listGitRepos).mockResolvedValue([]);
    vi.mocked(backendService.applyGitRepo).mockResolvedValue({
      name: 'my-repo',
      repo: 'https://github.com/owner/repo',
      paths: ['app1'],
    });

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    // Add repo (stores in localStorage only)
    await act(async () => {
      await result.current.addGitRepo('my-repo', 'https://github.com/owner/repo');
    });

    expect(backendService.applyGitRepo).not.toHaveBeenCalled();

    // Select a path (should create K8s resource)
    await act(async () => {
      await result.current.updateGitRepoPaths(result.current.gitRepos[0], ['app1']);
    });

    expect(backendService.applyGitRepo).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'my-repo',
        paths: ['app1'],
      })
    );
  });

  it('updateGitRepoPaths deletes K8s resource when all paths are deselected', async () => {
    // Start with a repo that exists in K8s
    vi.mocked(backendService.listGitRepos).mockResolvedValue(sampleGitRepos);
    vi.mocked(backendService.deleteGitRepo).mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    // Add to localStorage first (simulating existing config)
    await act(async () => {
      await result.current.addGitRepo('my-repo', 'https://github.com/owner/repo', 'main');
    });

    // Fetch K8s repos (should merge with localStorage)
    await act(async () => {
      await result.current.fetchGitRepos();
    });

    const repo = result.current.gitRepos[0];

    // Deselect all paths (should delete K8s resource)
    await act(async () => {
      await result.current.updateGitRepoPaths(repo, []);
    });

    expect(backendService.deleteGitRepo).toHaveBeenCalledWith('my-repo');
  });
});
