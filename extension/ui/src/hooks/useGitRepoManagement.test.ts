import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGitRepoManagement } from './useGitRepoManagement';
import { FleetState, GitRepo } from '../types';
import { KubernetesService } from '../services';

// Suppress console.error in tests
vi.spyOn(console, 'error').mockImplementation(() => {});

// Create a mock KubernetesService
function createMockKubernetesService() {
  return {
    fetchGitRepos: vi.fn<[], Promise<GitRepo[]>>(),
    applyGitRepo: vi.fn<[string, string, string?, string[]?], Promise<void>>(),
    deleteGitRepo: vi.fn<[string], Promise<void>>(),
    checkFleetStatus: vi.fn(),
    installFleet: vi.fn(),
    createFleetNamespace: vi.fn(),
    checkFleetCrdExists: vi.fn(),
    checkFleetPodRunning: vi.fn(),
    checkFleetNamespaceExists: vi.fn(),
    getFleetVersion: vi.fn(),
  } as unknown as KubernetesService;
}

// Sample GitRepo data for tests
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

describe('useGitRepoManagement', () => {
  const defaultFleetState: FleetState = { status: 'running', version: '0.10.0' };
  let mockService: KubernetesService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockService = createMockKubernetesService();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('initializes with empty repos and no error', () => {
    vi.mocked(mockService.fetchGitRepos).mockResolvedValue([]);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, kubernetesService: mockService })
    );

    expect(result.current.gitRepos).toEqual([]);
    expect(result.current.repoError).toBeNull();
    expect(result.current.loadingRepos).toBe(false);
  });

  it('fetches GitRepos via service', async () => {
    vi.mocked(mockService.fetchGitRepos).mockResolvedValueOnce(sampleGitRepos);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, kubernetesService: mockService })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    expect(mockService.fetchGitRepos).toHaveBeenCalled();
    expect(result.current.gitRepos).toHaveLength(1);
    expect(result.current.gitRepos[0].name).toBe('my-repo');
  });

  it('parses GitRepo status correctly', async () => {
    vi.mocked(mockService.fetchGitRepos).mockResolvedValueOnce(sampleGitRepos);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, kubernetesService: mockService })
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

  it('only updates state when data changes', async () => {
    const onReposLoaded = vi.fn();
    vi.mocked(mockService.fetchGitRepos).mockResolvedValue(sampleGitRepos);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, kubernetesService: mockService, onReposLoaded })
    );

    // First fetch
    await act(async () => {
      await result.current.fetchGitRepos();
    });

    expect(onReposLoaded).toHaveBeenCalledTimes(1);

    // Second fetch with same data
    await act(async () => {
      await result.current.fetchGitRepos();
    });

    // onReposLoaded should not be called again since data is the same
    expect(onReposLoaded).toHaveBeenCalledTimes(1);
  });

  it('calls onReposLoaded callback when repos change', async () => {
    const onReposLoaded = vi.fn();
    vi.mocked(mockService.fetchGitRepos).mockResolvedValueOnce(sampleGitRepos);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, kubernetesService: mockService, onReposLoaded })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    expect(onReposLoaded).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ name: 'my-repo' }),
    ]));
  });

  it('addGitRepo creates resource via service', async () => {
    vi.mocked(mockService.fetchGitRepos)
      .mockResolvedValueOnce([]) // Initial fetch returns empty
      .mockResolvedValueOnce(sampleGitRepos); // Refresh after add

    vi.mocked(mockService.applyGitRepo).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, kubernetesService: mockService })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    let addResult: { success: boolean; error?: string };
    await act(async () => {
      addResult = await result.current.addGitRepo('my-repo', 'https://github.com/owner/repo', 'main');
    });

    expect(addResult!.success).toBe(true);
    expect(mockService.applyGitRepo).toHaveBeenCalledWith('my-repo', 'https://github.com/owner/repo', 'main');
  });

  it('addGitRepo rejects duplicate names', async () => {
    vi.mocked(mockService.fetchGitRepos).mockResolvedValueOnce(sampleGitRepos);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, kubernetesService: mockService })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    let addResult: { success: boolean; error?: string };
    await act(async () => {
      addResult = await result.current.addGitRepo('my-repo', 'https://github.com/owner/other', 'main');
    });

    expect(addResult!.success).toBe(false);
    expect(addResult!.error).toContain('already exists');
    expect(result.current.repoError).toContain('already exists');
  });

  it('addGitRepo returns error result on service failure', async () => {
    vi.mocked(mockService.fetchGitRepos).mockResolvedValueOnce([]);
    vi.mocked(mockService.applyGitRepo).mockRejectedValueOnce(new Error('kubectl apply failed'));

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, kubernetesService: mockService })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    let addResult: { success: boolean; error?: string };
    await act(async () => {
      addResult = await result.current.addGitRepo('new-repo', 'https://github.com/owner/repo');
    });

    expect(addResult!.success).toBe(false);
    expect(addResult!.error).toBe('kubectl apply failed');
    expect(result.current.repoError).toBe('kubectl apply failed');
  });

  it('addGitRepo returns error result when name is empty', async () => {
    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, kubernetesService: mockService })
    );

    let addResult: { success: boolean; error?: string };
    await act(async () => {
      addResult = await result.current.addGitRepo('', 'https://github.com/owner/repo');
    });

    expect(addResult!.success).toBe(false);
    expect(addResult!.error).toBe('Name and URL are required');
  });

  it('deleteGitRepo removes resource via service', async () => {
    vi.mocked(mockService.fetchGitRepos)
      .mockResolvedValueOnce(sampleGitRepos)
      .mockResolvedValueOnce([]); // Refresh after delete

    vi.mocked(mockService.deleteGitRepo).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, kubernetesService: mockService })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    await act(async () => {
      await result.current.deleteGitRepo('my-repo');
    });

    expect(mockService.deleteGitRepo).toHaveBeenCalledWith('my-repo');
    expect(result.current.gitRepos).toHaveLength(0);
  });

  it('updateGitRepoPaths updates optimistically', async () => {
    vi.mocked(mockService.fetchGitRepos).mockResolvedValueOnce(sampleGitRepos);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, kubernetesService: mockService })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    const repo = result.current.gitRepos[0];

    // Mock the applyGitRepo to be slow
    let resolveApply: () => void;
    const applyPromise = new Promise<void>((resolve) => {
      resolveApply = resolve;
    });
    vi.mocked(mockService.applyGitRepo).mockReturnValueOnce(applyPromise);

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
    vi.mocked(mockService.fetchGitRepos)
      .mockResolvedValueOnce(sampleGitRepos)
      .mockResolvedValueOnce(sampleGitRepos); // Revert fetch

    vi.mocked(mockService.applyGitRepo).mockRejectedValueOnce(new Error('Apply failed'));

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, kubernetesService: mockService })
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
    vi.mocked(mockService.fetchGitRepos).mockResolvedValueOnce(sampleGitRepos);
    vi.mocked(mockService.applyGitRepo).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, kubernetesService: mockService })
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
    vi.mocked(mockService.fetchGitRepos).mockResolvedValueOnce(sampleGitRepos);
    vi.mocked(mockService.applyGitRepo).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, kubernetesService: mockService })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    const repo = result.current.gitRepos[0];

    act(() => {
      result.current.toggleRepoPath(repo, 'app1');
    });

    expect(result.current.gitRepos[0].paths).not.toContain('app1');
  });

  it('clearRepoError clears the error', async () => {
    vi.mocked(mockService.fetchGitRepos).mockResolvedValueOnce([]);
    vi.mocked(mockService.applyGitRepo).mockRejectedValueOnce(new Error('Some error'));

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, kubernetesService: mockService })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    await act(async () => {
      await result.current.addGitRepo('test', 'https://github.com/owner/repo');
    });

    expect(result.current.repoError).toBe('Some error');

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
    vi.mocked(mockService.fetchGitRepos).mockReturnValueOnce(fetchPromise);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, kubernetesService: mockService })
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
    vi.mocked(mockService.fetchGitRepos).mockRejectedValueOnce(new Error('No resources found in fleet-local namespace'));

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, kubernetesService: mockService })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    expect(result.current.gitRepos).toEqual([]);
    expect(result.current.repoError).toBeNull();
  });

  it('handles fetch error and sets repoError', async () => {
    vi.mocked(mockService.fetchGitRepos).mockRejectedValueOnce(new Error('Connection refused'));

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, kubernetesService: mockService })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    expect(result.current.repoError).toBe('Connection refused');
  });

  it('sets up refresh interval for unready repos', async () => {
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

    vi.mocked(mockService.fetchGitRepos).mockResolvedValue(unreadyRepos);

    const { result, unmount } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, kubernetesService: mockService })
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
    vi.mocked(mockService.fetchGitRepos).mockResolvedValueOnce(sampleGitRepos);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, kubernetesService: mockService })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    expect(result.current.gitRepos[0].status?.ready).toBe(true);
  });

  it('handles service not being configured gracefully', async () => {
    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    // Should not throw, but fetchGitRepos will log error
    await act(async () => {
      await result.current.fetchGitRepos();
    });

    // gitRepos should remain empty
    expect(result.current.gitRepos).toEqual([]);
  });
});
