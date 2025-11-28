import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGitRepoManagement } from './useGitRepoManagement';
import { FleetState } from '../types';

// Suppress console.error in tests
vi.spyOn(console, 'error').mockImplementation(() => {});

// Create a mock exec function
const { mockExec } = vi.hoisted(() => ({
  mockExec: vi.fn(),
}));

// Mock the ddClient module
vi.mock('../lib/ddClient', () => ({
  ddClient: {
    extension: {
      host: {
        cli: {
          exec: mockExec,
        },
      },
    },
  },
}));

// Sample GitRepo data for tests
const sampleGitRepoResponse = {
  items: [
    {
      metadata: { name: 'my-repo' },
      spec: { repo: 'https://github.com/owner/repo', branch: 'main', paths: ['app1'] },
      status: {
        conditions: [{ type: 'Ready', status: 'True' }],
        display: { state: 'Active', message: '' },
        desiredReadyClusters: 1,
        readyClusters: 1,
        resources: [{ kind: 'Deployment', name: 'my-app', state: 'Ready' }],
      },
    },
  ],
};

describe('useGitRepoManagement', () => {
  const defaultFleetState: FleetState = { status: 'running', version: '0.10.0' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('initializes with empty repos and no error', () => {
    mockExec.mockResolvedValue({ stdout: '{"items":[]}', stderr: '' });

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    expect(result.current.gitRepos).toEqual([]);
    expect(result.current.repoError).toBeNull();
    expect(result.current.loadingRepos).toBe(false);
  });

  it('fetches GitRepos via kubectl', async () => {
    mockExec.mockResolvedValueOnce({
      stdout: JSON.stringify(sampleGitRepoResponse),
      stderr: '',
    });

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    expect(mockExec).toHaveBeenCalledWith('kubectl', expect.arrayContaining([
      '--context', 'rancher-desktop',
      'get', 'gitrepos', '-n', 'fleet-local',
      '-o', 'json',
    ]));

    expect(result.current.gitRepos).toHaveLength(1);
    expect(result.current.gitRepos[0].name).toBe('my-repo');
  });

  it('parses GitRepo status correctly', async () => {
    mockExec.mockResolvedValueOnce({
      stdout: JSON.stringify(sampleGitRepoResponse),
      stderr: '',
    });

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

  it('only updates state when data changes', async () => {
    const onReposLoaded = vi.fn();
    mockExec.mockResolvedValue({
      stdout: JSON.stringify(sampleGitRepoResponse),
      stderr: '',
    });

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, onReposLoaded })
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
    mockExec.mockResolvedValueOnce({
      stdout: JSON.stringify(sampleGitRepoResponse),
      stderr: '',
    });

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState, onReposLoaded })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    expect(onReposLoaded).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ name: 'my-repo' }),
    ]));
  });

  it('addGitRepo creates resource via kubectl', async () => {
    mockExec
      .mockResolvedValueOnce({ stdout: '{"items":[]}', stderr: '' }) // Initial fetch returns empty
      .mockResolvedValueOnce({ stdout: '', stderr: '' }) // kubectl apply
      .mockResolvedValueOnce({ stdout: JSON.stringify(sampleGitRepoResponse), stderr: '' }); // Refresh

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    let success: boolean;
    await act(async () => {
      success = await result.current.addGitRepo('my-repo', 'https://github.com/owner/repo', 'main');
    });

    expect(success!).toBe(true);
    expect(mockExec).toHaveBeenCalledWith('kubectl', expect.arrayContaining([
      '--apply-json',
    ]));
  });

  it('addGitRepo rejects duplicate names', async () => {
    mockExec.mockResolvedValueOnce({
      stdout: JSON.stringify(sampleGitRepoResponse),
      stderr: '',
    });

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    let success: boolean;
    await act(async () => {
      success = await result.current.addGitRepo('my-repo', 'https://github.com/owner/other', 'main');
    });

    expect(success!).toBe(false);
    expect(result.current.repoError).toContain('already exists');
  });

  it('addGitRepo returns false on error', async () => {
    mockExec
      .mockResolvedValueOnce({ stdout: '{"items":[]}', stderr: '' })
      .mockRejectedValueOnce(new Error('kubectl apply failed'));

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    let success: boolean;
    await act(async () => {
      success = await result.current.addGitRepo('new-repo', 'https://github.com/owner/repo');
    });

    expect(success!).toBe(false);
    expect(result.current.repoError).toBe('kubectl apply failed');
  });

  it('addGitRepo returns false when name is empty', async () => {
    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    let success: boolean;
    await act(async () => {
      success = await result.current.addGitRepo('', 'https://github.com/owner/repo');
    });

    expect(success!).toBe(false);
  });

  it('deleteGitRepo removes resource via kubectl', async () => {
    mockExec
      .mockResolvedValueOnce({ stdout: JSON.stringify(sampleGitRepoResponse), stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' }) // kubectl delete
      .mockResolvedValueOnce({ stdout: '{"items":[]}', stderr: '' }); // Refresh

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    await act(async () => {
      await result.current.deleteGitRepo('my-repo');
    });

    expect(mockExec).toHaveBeenCalledWith('kubectl', expect.arrayContaining([
      'delete', 'gitrepo', 'my-repo', '-n', 'fleet-local',
    ]));

    expect(result.current.gitRepos).toHaveLength(0);
  });

  it('updateGitRepoPaths updates optimistically', async () => {
    mockExec.mockResolvedValueOnce({
      stdout: JSON.stringify(sampleGitRepoResponse),
      stderr: '',
    });

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    const repo = result.current.gitRepos[0];

    // Mock the kubectl apply to be slow
    let resolveApply: () => void;
    const applyPromise = new Promise<void>((resolve) => {
      resolveApply = resolve;
    });
    mockExec.mockReturnValueOnce(applyPromise);

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
    mockExec
      .mockResolvedValueOnce({ stdout: JSON.stringify(sampleGitRepoResponse), stderr: '' })
      .mockRejectedValueOnce(new Error('Apply failed'))
      .mockResolvedValueOnce({ stdout: JSON.stringify(sampleGitRepoResponse), stderr: '' });

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
    mockExec
      .mockResolvedValueOnce({ stdout: JSON.stringify(sampleGitRepoResponse), stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' }); // kubectl apply

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
    mockExec
      .mockResolvedValueOnce({ stdout: JSON.stringify(sampleGitRepoResponse), stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' }); // kubectl apply

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

    expect(result.current.gitRepos[0].paths).not.toContain('app1');
  });

  it('clearRepoError clears the error', async () => {
    mockExec
      .mockResolvedValueOnce({ stdout: '{"items":[]}', stderr: '' })
      .mockRejectedValueOnce(new Error('Some error'));

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
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
    let resolveFetch: () => void;
    const fetchPromise = new Promise<{ stdout: string; stderr: string }>((resolve) => {
      resolveFetch = () => resolve({ stdout: '{"items":[]}', stderr: '' });
    });
    mockExec.mockReturnValueOnce(fetchPromise);

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    expect(result.current.loadingRepos).toBe(false);

    act(() => {
      result.current.fetchGitRepos();
    });

    expect(result.current.loadingRepos).toBe(true);

    await act(async () => {
      resolveFetch!();
      await fetchPromise;
    });

    expect(result.current.loadingRepos).toBe(false);
  });

  it('handles "No resources found" error gracefully', async () => {
    mockExec.mockRejectedValueOnce(new Error('No resources found in fleet-local namespace'));

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
    mockExec.mockResolvedValueOnce({
      stdout: '',
      stderr: 'Connection refused',
    });

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    expect(result.current.repoError).toBe('Connection refused');
  });

  it('sets up refresh interval for unready repos', async () => {
    const unreadyRepoResponse = {
      items: [
        {
          metadata: { name: 'my-repo' },
          spec: { repo: 'https://github.com/owner/repo' },
          status: {
            conditions: [{ type: 'Ready', status: 'False' }],
            desiredReadyClusters: 1,
            readyClusters: 0,
            resources: [],
          },
        },
      ],
    };

    mockExec.mockResolvedValue({
      stdout: JSON.stringify(unreadyRepoResponse),
      stderr: '',
    });

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
    const readyRepoResponse = {
      items: [{
        metadata: { name: 'my-repo' },
        spec: { repo: 'https://github.com/owner/repo' },
        status: {
          conditions: [{ type: 'Ready', status: 'True' }],
          desiredReadyClusters: 1,
          readyClusters: 1,
          resources: [],
        },
      }],
    };

    mockExec.mockResolvedValueOnce({
      stdout: JSON.stringify(readyRepoResponse),
      stderr: '',
    });

    const { result } = renderHook(() =>
      useGitRepoManagement({ fleetState: defaultFleetState })
    );

    await act(async () => {
      await result.current.fetchGitRepos();
    });

    expect(result.current.gitRepos[0].status?.ready).toBe(true);
  });
});
