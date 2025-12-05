import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFleetStatus } from './useFleetStatus';
import { backendService } from '../services';

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

describe('useFleetStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: backend returns checking state
    vi.mocked(backendService.getFleetState).mockResolvedValue({
      status: 'checking',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts with "checking" status', async () => {
    // Mock getFleetState to hang
    vi.mocked(backendService.getFleetState).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useFleetStatus());

    expect(result.current.fleetState.status).toBe('checking');
  });

  it('detects Fleet when backend returns running status', async () => {
    vi.mocked(backendService.getFleetState).mockResolvedValueOnce({
      status: 'running',
      version: '0.10.0',
    });

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('running');
    });

    expect(result.current.fleetState.version).toBe('0.10.0');
  });

  it('returns "not-installed" when backend returns not-installed', async () => {
    vi.mocked(backendService.getFleetState).mockResolvedValueOnce({
      status: 'not-installed',
    });

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('not-installed');
    });
  });

  it('extracts Fleet version from backend response', async () => {
    vi.mocked(backendService.getFleetState).mockResolvedValueOnce({
      status: 'running',
      version: '0.9.1',
    });

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.version).toBe('0.9.1');
    });
  });

  it('calls onFleetReady callback when Fleet is running', async () => {
    const onFleetReady = vi.fn();

    vi.mocked(backendService.getFleetState).mockResolvedValueOnce({
      status: 'running',
      version: '0.10.0',
    });

    renderHook(() => useFleetStatus({ onFleetReady }));

    await waitFor(() => {
      expect(onFleetReady).toHaveBeenCalled();
    });
  });

  it('returns error status when backend call fails', async () => {
    vi.mocked(backendService.getFleetState).mockRejectedValueOnce(new Error('Connection refused'));

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('error');
      expect(result.current.fleetState.error).toBe('Connection refused');
    });
  });

  it('shows checking status when backend is initializing (503)', async () => {
    vi.mocked(backendService.getFleetState).mockRejectedValueOnce(new Error('503 Service not ready'));

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('checking');
      expect(result.current.fleetState.message).toContain('Waiting for backend');
    });
  });

  it('displays installing status with progress message', async () => {
    vi.mocked(backendService.getFleetState).mockResolvedValueOnce({
      status: 'installing',
      message: 'Step 2/5: Installing Fleet CRDs...',
    });

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('installing');
      expect(result.current.fleetState.message).toContain('Step 2/5');
    });
  });

  it('checkFleetStatus can be called manually', async () => {
    vi.mocked(backendService.getFleetState)
      .mockResolvedValueOnce({ status: 'not-installed' })
      .mockResolvedValueOnce({ status: 'running', version: '0.10.0' });

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('not-installed');
    });

    await act(async () => {
      await result.current.checkFleetStatus();
    });

    expect(result.current.fleetState.status).toBe('running');
  });

  it('returns initializing status when backend reports initializing', async () => {
    vi.mocked(backendService.getFleetState).mockResolvedValueOnce({
      status: 'initializing',
      message: 'Creating the "fleet-local" namespace...',
    });

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('initializing');
      expect(result.current.fleetState.message).toContain('fleet-local');
    });
  });

  it('does not call onFleetReady when status is not running', async () => {
    const onFleetReady = vi.fn();

    vi.mocked(backendService.getFleetState).mockResolvedValueOnce({
      status: 'not-installed',
    });

    renderHook(() => useFleetStatus({ onFleetReady }));

    await waitFor(() => {
      expect(backendService.getFleetState).toHaveBeenCalled();
    });

    expect(onFleetReady).not.toHaveBeenCalled();
  });

  it('handles backend error gracefully', async () => {
    vi.mocked(backendService.getFleetState).mockRejectedValueOnce(
      new Error('Network error')
    );

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('error');
    });
  });

  it('handles version being unknown', async () => {
    vi.mocked(backendService.getFleetState).mockResolvedValueOnce({
      status: 'running',
      version: 'unknown',
    });

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.version).toBe('unknown');
    });
  });
});
