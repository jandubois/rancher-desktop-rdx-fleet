import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePathDiscovery } from './usePathDiscovery';
import { backendService } from '../services';
import { PathInfo, DiscoverPathsResult } from '../services/BackendService';

// Mock the backendService module
vi.mock('../services', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services')>();
  return {
    ...original,
    backendService: {
      discoverPaths: vi.fn(),
    },
  };
});

// Suppress console output in tests
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});

// Helper to create mock discovery result
function createMockResult(paths: PathInfo[], branch = 'main'): DiscoverPathsResult {
  return {
    paths,
    branch,
    cloneTimeMs: 100,
    scanTimeMs: 50,
  };
}

describe('usePathDiscovery', () => {
  const mockDiscoverPaths = vi.mocked(backendService.discoverPaths);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with empty cache and no errors', () => {
    const { result } = renderHook(() => usePathDiscovery());

    expect(result.current.repoPathsCache).toEqual({});
    expect(result.current.discoveryErrors).toEqual({});
    expect(result.current.discoveryStartTimes).toEqual({});
  });

  it('caches discovered paths after successful fetch', async () => {
    const mockPaths = [
      { path: 'app1', dependsOn: ['dep1'] },
      { path: 'app2' },
    ];
    mockDiscoverPaths.mockResolvedValueOnce(createMockResult(mockPaths));

    const { result } = renderHook(() => usePathDiscovery());

    await act(async () => {
      await result.current.discoverPathsForRepo('https://github.com/owner/repo');
    });

    expect(result.current.repoPathsCache['https://github.com/owner/repo']).toEqual(mockPaths);
    expect(mockDiscoverPaths).toHaveBeenCalledWith({
      repo: 'https://github.com/owner/repo',
      branch: undefined,
    });
  });

  it('passes branch parameter to discoverPaths', async () => {
    mockDiscoverPaths.mockResolvedValueOnce(createMockResult([]));

    const { result } = renderHook(() => usePathDiscovery());

    await act(async () => {
      await result.current.discoverPathsForRepo('https://github.com/owner/repo', 'develop');
    });

    expect(mockDiscoverPaths).toHaveBeenCalledWith({
      repo: 'https://github.com/owner/repo',
      branch: 'develop',
    });
  });

  it('prevents duplicate requests for the same repo', async () => {
    mockDiscoverPaths.mockResolvedValue(createMockResult([{ path: 'app' }]));

    const { result } = renderHook(() => usePathDiscovery());

    await act(async () => {
      await result.current.discoverPathsForRepo('https://github.com/owner/repo');
    });

    // Try to fetch again (should be prevented)
    await act(async () => {
      await result.current.discoverPathsForRepo('https://github.com/owner/repo');
    });

    expect(mockDiscoverPaths).toHaveBeenCalledTimes(1);
  });

  it('allows retry with isRetry flag even when cached', async () => {
    const initialPaths = [{ path: 'app1' }];
    const updatedPaths = [{ path: 'app1' }, { path: 'app2' }];

    mockDiscoverPaths
      .mockResolvedValueOnce(createMockResult(initialPaths))
      .mockResolvedValueOnce(createMockResult(updatedPaths));

    const { result } = renderHook(() => usePathDiscovery());

    // First fetch
    await act(async () => {
      await result.current.discoverPathsForRepo('https://github.com/owner/repo');
    });

    expect(result.current.repoPathsCache['https://github.com/owner/repo']).toEqual(initialPaths);

    // Retry (should be allowed)
    await act(async () => {
      await result.current.discoverPathsForRepo('https://github.com/owner/repo', undefined, true);
    });

    expect(mockDiscoverPaths).toHaveBeenCalledTimes(2);
    expect(result.current.repoPathsCache['https://github.com/owner/repo']).toEqual(updatedPaths);
  });

  it('tracks discovery errors when fetch fails', async () => {
    mockDiscoverPaths.mockRejectedValueOnce(new Error('Clone failed: repository not found'));

    const { result } = renderHook(() => usePathDiscovery());

    await act(async () => {
      await result.current.discoverPathsForRepo('https://github.com/owner/repo');
    });

    expect(result.current.discoveryErrors['https://github.com/owner/repo']).toBe('Clone failed: repository not found');
    // Should not cache anything on error
    expect(result.current.repoPathsCache['https://github.com/owner/repo']).toBeUndefined();
  });

  it('tracks discovery start times during loading', async () => {
    let resolveFetch: (value: DiscoverPathsResult) => void;
    const fetchPromise = new Promise<DiscoverPathsResult>((resolve) => {
      resolveFetch = resolve;
    });
    mockDiscoverPaths.mockReturnValueOnce(fetchPromise);

    const { result } = renderHook(() => usePathDiscovery());

    // Start discovery (don't await)
    act(() => {
      result.current.discoverPathsForRepo('https://github.com/owner/repo');
    });

    // Should have start time while loading
    await waitFor(() => {
      expect(result.current.discoveryStartTimes['https://github.com/owner/repo']).toBeDefined();
    });

    // Resolve the fetch
    await act(async () => {
      resolveFetch!(createMockResult([{ path: 'app' }]));
      await fetchPromise;
    });

    // Start time should be cleared after success
    expect(result.current.discoveryStartTimes['https://github.com/owner/repo']).toBeUndefined();
  });

  it('clearDiscoveryCache removes cached data and errors', async () => {
    const mockPaths = [{ path: 'app' }];
    mockDiscoverPaths.mockResolvedValueOnce(createMockResult(mockPaths));

    const { result } = renderHook(() => usePathDiscovery());

    // First, populate the cache
    await act(async () => {
      await result.current.discoverPathsForRepo('https://github.com/owner/repo');
    });

    expect(result.current.repoPathsCache['https://github.com/owner/repo']).toEqual(mockPaths);

    // Clear the cache
    act(() => {
      result.current.clearDiscoveryCache('https://github.com/owner/repo');
    });

    expect(result.current.repoPathsCache['https://github.com/owner/repo']).toBeUndefined();
  });

  it('clearDiscoveryCache clears errors', async () => {
    mockDiscoverPaths.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => usePathDiscovery());

    await act(async () => {
      await result.current.discoverPathsForRepo('https://github.com/owner/repo');
    });

    expect(result.current.discoveryErrors['https://github.com/owner/repo']).toBe('Network error');

    act(() => {
      result.current.clearDiscoveryCache('https://github.com/owner/repo');
    });

    expect(result.current.discoveryErrors['https://github.com/owner/repo']).toBeUndefined();
  });

  it('isLoadingPaths returns true while loading', async () => {
    let resolveFetch: (value: DiscoverPathsResult) => void;
    const fetchPromise = new Promise<DiscoverPathsResult>((resolve) => {
      resolveFetch = resolve;
    });
    mockDiscoverPaths.mockReturnValueOnce(fetchPromise);

    const { result } = renderHook(() => usePathDiscovery());

    expect(result.current.isLoadingPaths('https://github.com/owner/repo')).toBe(false);

    // Start discovery
    act(() => {
      result.current.discoverPathsForRepo('https://github.com/owner/repo');
    });

    expect(result.current.isLoadingPaths('https://github.com/owner/repo')).toBe(true);

    // Resolve the fetch
    await act(async () => {
      resolveFetch!(createMockResult([]));
      await fetchPromise;
    });

    expect(result.current.isLoadingPaths('https://github.com/owner/repo')).toBe(false);
  });

  it('handles multiple repos independently', async () => {
    const repo1Paths = [{ path: 'app1' }];
    const repo2Paths = [{ path: 'app2' }];

    mockDiscoverPaths
      .mockResolvedValueOnce(createMockResult(repo1Paths))
      .mockResolvedValueOnce(createMockResult(repo2Paths));

    const { result } = renderHook(() => usePathDiscovery());

    await act(async () => {
      await result.current.discoverPathsForRepo('https://github.com/owner/repo1');
      await result.current.discoverPathsForRepo('https://github.com/owner/repo2');
    });

    expect(result.current.repoPathsCache['https://github.com/owner/repo1']).toEqual(repo1Paths);
    expect(result.current.repoPathsCache['https://github.com/owner/repo2']).toEqual(repo2Paths);
  });

  it('clears previous error on retry', async () => {
    mockDiscoverPaths
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValueOnce(createMockResult([{ path: 'app' }]));

    const { result } = renderHook(() => usePathDiscovery());

    // First attempt fails
    await act(async () => {
      await result.current.discoverPathsForRepo('https://github.com/owner/repo');
    });

    expect(result.current.discoveryErrors['https://github.com/owner/repo']).toBe('First error');

    // Retry succeeds
    await act(async () => {
      await result.current.discoverPathsForRepo('https://github.com/owner/repo', undefined, true);
    });

    expect(result.current.discoveryErrors['https://github.com/owner/repo']).toBeUndefined();
    expect(result.current.repoPathsCache['https://github.com/owner/repo']).toEqual([{ path: 'app' }]);
  });

  it('prevents concurrent duplicate requests while loading', async () => {
    let resolveFetch: (value: DiscoverPathsResult) => void;
    const fetchPromise = new Promise<DiscoverPathsResult>((resolve) => {
      resolveFetch = resolve;
    });
    mockDiscoverPaths.mockReturnValueOnce(fetchPromise);

    const { result } = renderHook(() => usePathDiscovery());

    // Start first request
    await act(async () => {
      result.current.discoverPathsForRepo('https://github.com/owner/repo');
      // Wait a tick for the request to start
      await Promise.resolve();
    });

    // Try to start another (should be blocked because first is still loading)
    await act(async () => {
      result.current.discoverPathsForRepo('https://github.com/owner/repo');
      await Promise.resolve();
    });

    expect(mockDiscoverPaths).toHaveBeenCalledTimes(1);

    // Complete the first request
    await act(async () => {
      resolveFetch!(createMockResult([{ path: 'app' }]));
      await fetchPromise;
    });
  });
});
