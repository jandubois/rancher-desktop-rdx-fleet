import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFleetStatus } from './useFleetStatus';
import { KubernetesService, FleetStatusCheckResult, backendService } from '../services';

// Mock the backendService
vi.mock('../services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services')>();
  return {
    ...actual,
    backendService: {
      getFleetState: vi.fn(),
    },
  };
});

// Suppress console.error in tests
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});

// Create a mock KubernetesService
function createMockKubernetesService() {
  return {
    checkFleetStatus: vi.fn<[], Promise<FleetStatusCheckResult>>(),
    createFleetNamespace: vi.fn<[], Promise<void>>(),
    checkFleetCrdExists: vi.fn<[], Promise<boolean>>(),
    checkFleetPodRunning: vi.fn<[], Promise<boolean>>(),
    checkFleetNamespaceExists: vi.fn<[], Promise<boolean>>(),
    getFleetVersion: vi.fn<[], Promise<string>>(),
    fetchGitRepos: vi.fn(),
    applyGitRepo: vi.fn(),
    deleteGitRepo: vi.fn(),
  } as unknown as KubernetesService;
}

describe('useFleetStatus', () => {
  let mockService: KubernetesService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockService = createMockKubernetesService();
    // Default: backend not available, falls back to kubectl check
    vi.mocked(backendService.getFleetState).mockRejectedValue(new Error('Not available'));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts with "checking" status', async () => {
    // Mock checkFleetStatus to hang
    vi.mocked(mockService.checkFleetStatus).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useFleetStatus({ kubernetesService: mockService }));

    expect(result.current.fleetState.status).toBe('checking');
  });

  it('detects Fleet when status is running', async () => {
    vi.mocked(mockService.checkFleetStatus).mockResolvedValueOnce({
      state: { status: 'running', version: '0.10.0' },
    });

    const { result } = renderHook(() => useFleetStatus({ kubernetesService: mockService }));

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('running');
    });

    expect(result.current.fleetState.version).toBe('0.10.0');
  });

  it('returns "not-installed" when checkFleetStatus returns not-installed', async () => {
    vi.mocked(mockService.checkFleetStatus).mockResolvedValueOnce({
      state: { status: 'not-installed' },
    });

    const { result } = renderHook(() => useFleetStatus({ kubernetesService: mockService }));

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('not-installed');
    });
  });

  it('extracts Fleet version from status result', async () => {
    vi.mocked(mockService.checkFleetStatus).mockResolvedValueOnce({
      state: { status: 'running', version: '0.9.1' },
    });

    const { result } = renderHook(() => useFleetStatus({ kubernetesService: mockService }));

    await waitFor(() => {
      expect(result.current.fleetState.version).toBe('0.9.1');
    });
  });

  it('calls onFleetReady callback when Fleet is running', async () => {
    const onFleetReady = vi.fn();

    vi.mocked(mockService.checkFleetStatus).mockResolvedValueOnce({
      state: { status: 'running', version: '0.10.0' },
    });

    renderHook(() => useFleetStatus({ kubernetesService: mockService, onFleetReady }));

    await waitFor(() => {
      expect(onFleetReady).toHaveBeenCalled();
    });
  });

  it('returns error status when check throws unexpected error', async () => {
    vi.mocked(mockService.checkFleetStatus).mockRejectedValueOnce(new Error('Connection refused'));

    const { result } = renderHook(() => useFleetStatus({ kubernetesService: mockService }));

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('error');
      expect(result.current.fleetState.error).toBe('Connection refused');
    });
  });

  it('uses backend state when backend returns installing status', async () => {
    // Backend reports installing
    vi.mocked(backendService.getFleetState).mockResolvedValueOnce({
      status: 'installing',
      message: 'Step 2/5: Installing Fleet CRDs...',
    });

    const { result } = renderHook(() => useFleetStatus({ kubernetesService: mockService }));

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('installing');
      expect(result.current.fleetState.message).toContain('Step 2/5');
    });

    // Should not call kubectl check when backend has authoritative state
    expect(mockService.checkFleetStatus).not.toHaveBeenCalled();
  });

  it('uses backend state when backend returns running status', async () => {
    // Backend reports running
    vi.mocked(backendService.getFleetState).mockResolvedValueOnce({
      status: 'running',
      version: '0.10.0',
    });

    const onFleetReady = vi.fn();
    const { result } = renderHook(() =>
      useFleetStatus({ kubernetesService: mockService, onFleetReady })
    );

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('running');
    });

    expect(onFleetReady).toHaveBeenCalled();
    expect(mockService.checkFleetStatus).not.toHaveBeenCalled();
  });

  it('falls back to kubectl check when backend is not available', async () => {
    // Backend throws (default mock behavior)
    vi.mocked(mockService.checkFleetStatus).mockResolvedValueOnce({
      state: { status: 'running', version: '0.10.0' },
    });

    const { result } = renderHook(() => useFleetStatus({ kubernetesService: mockService }));

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('running');
    });

    // Should fall back to kubectl
    expect(mockService.checkFleetStatus).toHaveBeenCalled();
  });

  it('checkFleetStatus can be called manually', async () => {
    // Initial check - not installed
    vi.mocked(mockService.checkFleetStatus)
      .mockResolvedValueOnce({ state: { status: 'not-installed' } })
      // Manual re-check - now running
      .mockResolvedValueOnce({ state: { status: 'running', version: '0.10.0' } });

    const { result } = renderHook(() => useFleetStatus({ kubernetesService: mockService }));

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('not-installed');
    });

    await act(async () => {
      await result.current.checkFleetStatus();
    });

    expect(result.current.fleetState.status).toBe('running');
  });

  it('returns initializing status when namespace needs to be created', async () => {
    vi.mocked(mockService.checkFleetStatus).mockResolvedValueOnce({
      state: {
        status: 'initializing',
        message: 'Creating the "fleet-local" namespace...',
      },
      needsNamespaceCreation: true,
    });

    vi.mocked(mockService.createFleetNamespace).mockResolvedValueOnce(undefined);

    // After namespace creation, recheck returns running
    vi.mocked(mockService.checkFleetStatus).mockResolvedValueOnce({
      state: { status: 'running', version: '0.10.0' },
    });

    const { result } = renderHook(() => useFleetStatus({ kubernetesService: mockService }));

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('initializing');
      expect(result.current.fleetState.message).toContain('fleet-local');
    });

    // Verify namespace creation was attempted
    expect(mockService.createFleetNamespace).toHaveBeenCalled();
  });

  it('handles namespace creation error gracefully', async () => {
    vi.mocked(mockService.checkFleetStatus)
      .mockResolvedValueOnce({
        state: {
          status: 'initializing',
          message: 'Creating the "fleet-local" namespace...',
        },
        needsNamespaceCreation: true,
      })
      // After retry, still initializing
      .mockResolvedValueOnce({
        state: { status: 'initializing', message: 'Waiting...' },
      });

    // Namespace creation throws (race condition - already exists)
    vi.mocked(mockService.createFleetNamespace).mockRejectedValueOnce(
      new Error('namespaces "fleet-local" already exists')
    );

    const { result } = renderHook(() => useFleetStatus({ kubernetesService: mockService }));

    // Should still show initializing (will re-check after setTimeout)
    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('initializing');
    });
  });

  it('does not call onFleetReady when status is not running', async () => {
    const onFleetReady = vi.fn();

    vi.mocked(mockService.checkFleetStatus).mockResolvedValueOnce({
      state: { status: 'not-installed' },
    });

    renderHook(() => useFleetStatus({ kubernetesService: mockService, onFleetReady }));

    await waitFor(() => {
      expect(mockService.checkFleetStatus).toHaveBeenCalled();
    });

    expect(onFleetReady).not.toHaveBeenCalled();
  });

  it('handles service not being configured', async () => {
    const { result } = renderHook(() => useFleetStatus({}));

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('error');
      expect(result.current.fleetState.error).toBe('Service not configured');
    });
  });

  it('handles version being unknown', async () => {
    vi.mocked(mockService.checkFleetStatus).mockResolvedValueOnce({
      state: { status: 'running', version: 'unknown' },
    });

    const { result } = renderHook(() => useFleetStatus({ kubernetesService: mockService }));

    await waitFor(() => {
      expect(result.current.fleetState.version).toBe('unknown');
    });
  });
});
