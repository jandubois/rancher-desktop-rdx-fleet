import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFleetStatus } from './useFleetStatus';
import { KubernetesService, FleetStatusCheckResult } from '../services';

// Suppress console.error in tests
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

// Create a mock KubernetesService
function createMockKubernetesService() {
  return {
    checkFleetStatus: vi.fn<[], Promise<FleetStatusCheckResult>>(),
    installFleet: vi.fn<[], Promise<void>>(),
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

  it('installFleet calls service.installFleet and rechecks status', async () => {
    // Initial check - not installed
    vi.mocked(mockService.checkFleetStatus)
      .mockResolvedValueOnce({ state: { status: 'not-installed' } })
      // After install, recheck returns running
      .mockResolvedValueOnce({ state: { status: 'running', version: '0.10.0' } });

    vi.mocked(mockService.installFleet).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useFleetStatus({ kubernetesService: mockService }));

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('not-installed');
    });

    await act(async () => {
      await result.current.installFleet();
    });

    expect(mockService.installFleet).toHaveBeenCalled();
    expect(result.current.fleetState.status).toBe('running');
  });

  it('sets installing to true during installation', async () => {
    // Initial check - not installed
    vi.mocked(mockService.checkFleetStatus).mockResolvedValueOnce({
      state: { status: 'not-installed' },
    });

    const { result } = renderHook(() => useFleetStatus({ kubernetesService: mockService }));

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('not-installed');
    });

    expect(result.current.installing).toBe(false);

    // Create a slow install
    let resolveInstall: () => void;
    const installPromise = new Promise<void>((resolve) => {
      resolveInstall = resolve;
    });

    vi.mocked(mockService.installFleet).mockReturnValueOnce(installPromise);
    vi.mocked(mockService.checkFleetStatus).mockResolvedValueOnce({
      state: { status: 'running', version: '0.10.0' },
    });

    // Start install (don't await)
    act(() => {
      result.current.installFleet();
    });

    expect(result.current.installing).toBe(true);

    // Complete installation
    await act(async () => {
      resolveInstall!();
      await installPromise;
    });

    expect(result.current.installing).toBe(false);
  });

  it('sets error status when installation fails', async () => {
    // Initial check - not installed
    vi.mocked(mockService.checkFleetStatus).mockResolvedValueOnce({
      state: { status: 'not-installed' },
    });

    const { result } = renderHook(() => useFleetStatus({ kubernetesService: mockService }));

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('not-installed');
    });

    // Install fails
    vi.mocked(mockService.installFleet).mockRejectedValueOnce(new Error('Network unreachable'));

    await act(async () => {
      await result.current.installFleet();
    });

    expect(result.current.fleetState.status).toBe('error');
    expect(result.current.fleetState.error).toBe('Network unreachable');
    expect(result.current.installing).toBe(false);
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
