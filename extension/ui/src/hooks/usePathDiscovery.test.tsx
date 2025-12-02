import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePathDiscovery } from './usePathDiscovery';
import { GitHubService, PathInfo } from '../services';
import { TestServiceProvider } from '../test-utils';

// Create a mock GitHubService
function createMockGitHubService() {
  return {
    fetchGitHubPaths: vi.fn<[string, string?], Promise<PathInfo[]>>(),
    fetchFleetYamlDeps: vi.fn(),
    setAuthToken: vi.fn(),
    getAuthToken: vi.fn(),
    setRateLimitCallback: vi.fn(),
    // Auth readiness - resolve immediately in tests
    waitForAuthReady: vi.fn().mockResolvedValue(undefined),
    setAuthReady: vi.fn(),
    isAuthReady: vi.fn().mockReturnValue(true),
  } as unknown as GitHubService;
}

// Wrapper component for tests
function createWrapper(mockService: GitHubService) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <TestServiceProvider services={{ gitHubService: mockService }}>
        {children}
      </TestServiceProvider>
    );
  };
}

// Suppress console.error in tests
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});

describe('usePathDiscovery', () => {
  let mockService: GitHubService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockService = createMockGitHubService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with empty cache and no errors', () => {
    const { result } = renderHook(() => usePathDiscovery(), {
      wrapper: createWrapper(mockService),
    });

    expect(result.current.repoPathsCache).toEqual({});
    expect(result.current.discoveryErrors).toEqual({});
    expect(result.current.discoveryStartTimes).toEqual({});
  });

  it('caches discovered paths after successful fetch', async () => {
    const mockPaths = [
      { path: 'app1', dependsOn: ['dep1'] },
      { path: 'app2' },
    ];
    vi.mocked(mockService.fetchGitHubPaths).mockResolvedValueOnce(mockPaths);

    const { result } = renderHook(() => usePathDiscovery(), {
      wrapper: createWrapper(mockService),
    });

    await act(async () => {
      await result.current.discoverPathsForRepo('https://github.com/owner/repo');
    });

    expect(result.current.repoPathsCache['https://github.com/owner/repo']).toEqual(mockPaths);
    expect(mockService.fetchGitHubPaths).toHaveBeenCalledWith('https://github.com/owner/repo', undefined);
  });

  it('passes branch parameter to fetchGitHubPaths', async () => {
    vi.mocked(mockService.fetchGitHubPaths).mockResolvedValueOnce([]);

    const { result } = renderHook(() => usePathDiscovery(), {
      wrapper: createWrapper(mockService),
    });

    await act(async () => {
      await result.current.discoverPathsForRepo('https://github.com/owner/repo', 'develop');
    });

    expect(mockService.fetchGitHubPaths).toHaveBeenCalledWith('https://github.com/owner/repo', 'develop');
  });

  it('prevents duplicate requests for the same repo', async () => {
    vi.mocked(mockService.fetchGitHubPaths).mockResolvedValue([{ path: 'app' }]);

    const { result } = renderHook(() => usePathDiscovery(), {
      wrapper: createWrapper(mockService),
    });

    await act(async () => {
      await result.current.discoverPathsForRepo('https://github.com/owner/repo');
    });

    // Try to fetch again (should be prevented)
    await act(async () => {
      await result.current.discoverPathsForRepo('https://github.com/owner/repo');
    });

    expect(mockService.fetchGitHubPaths).toHaveBeenCalledTimes(1);
  });

  it('allows retry with isRetry flag even when cached', async () => {
    const initialPaths = [{ path: 'app1' }];
    const updatedPaths = [{ path: 'app1' }, { path: 'app2' }];

    vi.mocked(mockService.fetchGitHubPaths)
      .mockResolvedValueOnce(initialPaths)
      .mockResolvedValueOnce(updatedPaths);

    const { result } = renderHook(() => usePathDiscovery(), {
      wrapper: createWrapper(mockService),
    });

    // First fetch
    await act(async () => {
      await result.current.discoverPathsForRepo('https://github.com/owner/repo');
    });

    expect(result.current.repoPathsCache['https://github.com/owner/repo']).toEqual(initialPaths);

    // Retry (should be allowed)
    await act(async () => {
      await result.current.discoverPathsForRepo('https://github.com/owner/repo', undefined, true);
    });

    expect(mockService.fetchGitHubPaths).toHaveBeenCalledTimes(2);
    expect(result.current.repoPathsCache['https://github.com/owner/repo']).toEqual(updatedPaths);
  });

  it('tracks discovery errors when fetch fails', async () => {
    vi.mocked(mockService.fetchGitHubPaths).mockRejectedValueOnce(new Error('API rate limit exceeded'));

    const { result } = renderHook(() => usePathDiscovery(), {
      wrapper: createWrapper(mockService),
    });

    await act(async () => {
      await result.current.discoverPathsForRepo('https://github.com/owner/repo');
    });

    expect(result.current.discoveryErrors['https://github.com/owner/repo']).toBe('API rate limit exceeded');
    // Should not cache anything on error
    expect(result.current.repoPathsCache['https://github.com/owner/repo']).toBeUndefined();
  });

  it('tracks discovery start times during loading', async () => {
    let resolveFetch: (value: PathInfo[]) => void;
    const fetchPromise = new Promise<PathInfo[]>((resolve) => {
      resolveFetch = resolve;
    });
    vi.mocked(mockService.fetchGitHubPaths).mockReturnValueOnce(fetchPromise);

    const { result } = renderHook(() => usePathDiscovery(), {
      wrapper: createWrapper(mockService),
    });

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
      resolveFetch!([{ path: 'app' }]);
      await fetchPromise;
    });

    // Start time should be cleared after success
    expect(result.current.discoveryStartTimes['https://github.com/owner/repo']).toBeUndefined();
  });

  it('clearDiscoveryCache removes cached data and errors', async () => {
    const mockPaths = [{ path: 'app' }];
    vi.mocked(mockService.fetchGitHubPaths).mockResolvedValueOnce(mockPaths);

    const { result } = renderHook(() => usePathDiscovery(), {
      wrapper: createWrapper(mockService),
    });

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
    vi.mocked(mockService.fetchGitHubPaths).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => usePathDiscovery(), {
      wrapper: createWrapper(mockService),
    });

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
    let resolveFetch: (value: PathInfo[]) => void;
    const fetchPromise = new Promise<PathInfo[]>((resolve) => {
      resolveFetch = resolve;
    });
    vi.mocked(mockService.fetchGitHubPaths).mockReturnValueOnce(fetchPromise);

    const { result } = renderHook(() => usePathDiscovery(), {
      wrapper: createWrapper(mockService),
    });

    expect(result.current.isLoadingPaths('https://github.com/owner/repo')).toBe(false);

    // Start discovery
    act(() => {
      result.current.discoverPathsForRepo('https://github.com/owner/repo');
    });

    expect(result.current.isLoadingPaths('https://github.com/owner/repo')).toBe(true);

    // Resolve the fetch
    await act(async () => {
      resolveFetch!([]);
      await fetchPromise;
    });

    expect(result.current.isLoadingPaths('https://github.com/owner/repo')).toBe(false);
  });

  it('handles multiple repos independently', async () => {
    const repo1Paths = [{ path: 'app1' }];
    const repo2Paths = [{ path: 'app2' }];

    vi.mocked(mockService.fetchGitHubPaths)
      .mockResolvedValueOnce(repo1Paths)
      .mockResolvedValueOnce(repo2Paths);

    const { result } = renderHook(() => usePathDiscovery(), {
      wrapper: createWrapper(mockService),
    });

    await act(async () => {
      await result.current.discoverPathsForRepo('https://github.com/owner/repo1');
      await result.current.discoverPathsForRepo('https://github.com/owner/repo2');
    });

    expect(result.current.repoPathsCache['https://github.com/owner/repo1']).toEqual(repo1Paths);
    expect(result.current.repoPathsCache['https://github.com/owner/repo2']).toEqual(repo2Paths);
  });

  it('clears previous error on retry', async () => {
    vi.mocked(mockService.fetchGitHubPaths)
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValueOnce([{ path: 'app' }]);

    const { result } = renderHook(() => usePathDiscovery(), {
      wrapper: createWrapper(mockService),
    });

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
    let resolveFetch: (value: PathInfo[]) => void;
    const fetchPromise = new Promise<PathInfo[]>((resolve) => {
      resolveFetch = resolve;
    });
    vi.mocked(mockService.fetchGitHubPaths).mockReturnValueOnce(fetchPromise);

    const { result } = renderHook(() => usePathDiscovery(), {
      wrapper: createWrapper(mockService),
    });

    // Start first request (use async act to let waitForAuthReady resolve)
    await act(async () => {
      result.current.discoverPathsForRepo('https://github.com/owner/repo');
      // Wait a tick to let waitForAuthReady resolve before the second call
      await Promise.resolve();
    });

    // Try to start another (should be blocked because first is still loading)
    await act(async () => {
      result.current.discoverPathsForRepo('https://github.com/owner/repo');
      await Promise.resolve();
    });

    expect(mockService.fetchGitHubPaths).toHaveBeenCalledTimes(1);

    // Complete the first request
    await act(async () => {
      resolveFetch!([{ path: 'app' }]);
      await fetchPromise;
    });
  });
});
