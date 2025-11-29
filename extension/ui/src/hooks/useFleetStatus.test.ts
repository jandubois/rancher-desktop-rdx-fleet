import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFleetStatus } from './useFleetStatus';

// Suppress console.error in tests
vi.spyOn(console, 'error').mockImplementation(() => {});

// Create a mock exec function that we can control using hoisted
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

describe('useFleetStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts with "checking" status', async () => {
    // Mock CRD check to hang
    mockExec.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useFleetStatus());

    expect(result.current.fleetState.status).toBe('checking');
  });

  it('detects Fleet when CRD exists, controller is running, and namespace exists', async () => {
    mockExec
      // CRD check
      .mockResolvedValueOnce({
        stdout: 'gitrepos.fleet.cattle.io',
        stderr: '',
      } as never)
      // Pod check
      .mockResolvedValueOnce({
        stdout: 'Running',
        stderr: '',
      } as never)
      // Namespace check
      .mockResolvedValueOnce({
        stdout: 'fleet-local',
        stderr: '',
      } as never)
      // Helm list for version
      .mockResolvedValueOnce({
        stdout: JSON.stringify([{ app_version: '0.10.0' }]),
        stderr: '',
      } as never);

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('running');
    });

    expect(result.current.fleetState.version).toBe('0.10.0');
  });

  it('returns "not-installed" when CRD does not exist', async () => {
    mockExec
      // CRD check returns empty/no match
      .mockResolvedValueOnce({
        stdout: '',
        stderr: '',
      } as never);

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('not-installed');
    });
  });

  it('returns "not-installed" when CRD check throws NotFound error', async () => {
    mockExec
      // CRD check throws NotFound
      .mockRejectedValueOnce(new Error('Error: gitrepos.fleet.cattle.io NotFound'));

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('not-installed');
    });
  });

  it('returns "not-installed" when pod is not running', async () => {
    mockExec
      // CRD check
      .mockResolvedValueOnce({
        stdout: 'gitrepos.fleet.cattle.io',
        stderr: '',
      } as never)
      // Pod check - not Running
      .mockResolvedValueOnce({
        stdout: 'Pending',
        stderr: '',
      } as never);

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('not-installed');
    });
  });

  it('extracts Fleet version from helm list', async () => {
    mockExec
      .mockResolvedValueOnce({
        stdout: 'gitrepos.fleet.cattle.io',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        stdout: 'Running',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        stdout: 'fleet-local',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        stdout: JSON.stringify([{ app_version: '0.9.1', chart: 'fleet-0.9.1' }]),
        stderr: '',
      } as never);

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.version).toBe('0.9.1');
    });
  });

  it('uses chart name when app_version is missing', async () => {
    mockExec
      .mockResolvedValueOnce({
        stdout: 'gitrepos.fleet.cattle.io',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        stdout: 'Running',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        stdout: 'fleet-local',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        stdout: JSON.stringify([{ chart: 'fleet-0.8.0' }]),
        stderr: '',
      } as never);

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.version).toBe('fleet-0.8.0');
    });
  });

  it('sets version to "unknown" when helm list fails to parse', async () => {
    mockExec
      .mockResolvedValueOnce({
        stdout: 'gitrepos.fleet.cattle.io',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        stdout: 'Running',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        stdout: 'fleet-local',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        stdout: 'invalid json',
        stderr: '',
      } as never);

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.version).toBe('unknown');
    });
  });

  it('calls onFleetReady callback when Fleet is running', async () => {
    const onFleetReady = vi.fn();

    mockExec
      .mockResolvedValueOnce({
        stdout: 'gitrepos.fleet.cattle.io',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        stdout: 'Running',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        stdout: 'fleet-local',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        stdout: JSON.stringify([{ app_version: '0.10.0' }]),
        stderr: '',
      } as never);

    renderHook(() => useFleetStatus({ onFleetReady }));

    await waitFor(() => {
      expect(onFleetReady).toHaveBeenCalled();
    });
  });

  it('returns error status when check throws unexpected error', async () => {
    mockExec
      .mockResolvedValueOnce({
        stdout: 'gitrepos.fleet.cattle.io',
        stderr: '',
      } as never)
      // Pod check throws unexpected error
      .mockRejectedValueOnce(new Error('Connection refused'));

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('error');
      expect(result.current.fleetState.error).toBe('Connection refused');
    });
  });

  it('installFleet calls helm commands in correct order and creates namespace', async () => {
    // Initial check - not installed
    mockExec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    } as never);

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('not-installed');
    });

    // Setup mocks for install
    mockExec
      // helm repo add
      .mockResolvedValueOnce({ stdout: '', stderr: '' } as never)
      // helm repo update
      .mockResolvedValueOnce({ stdout: '', stderr: '' } as never)
      // helm install fleet-crd
      .mockResolvedValueOnce({ stdout: '', stderr: '' } as never)
      // helm install fleet
      .mockResolvedValueOnce({ stdout: '', stderr: '' } as never)
      // kubectl create namespace fleet-local
      .mockResolvedValueOnce({ stdout: '', stderr: '' } as never)
      // checkFleetStatus after install - CRD check
      .mockResolvedValueOnce({
        stdout: 'gitrepos.fleet.cattle.io',
        stderr: '',
      } as never)
      // Pod check
      .mockResolvedValueOnce({
        stdout: 'Running',
        stderr: '',
      } as never)
      // Namespace check
      .mockResolvedValueOnce({
        stdout: 'fleet-local',
        stderr: '',
      } as never)
      // Helm list for version
      .mockResolvedValueOnce({
        stdout: JSON.stringify([{ app_version: '0.10.0' }]),
        stderr: '',
      } as never);

    await act(async () => {
      await result.current.installFleet();
    });

    // Verify helm commands were called in order
    const calls = mockExec.mock.calls;

    // Find the helm calls after the initial check
    const helmCalls = calls.filter(call => call[0] === 'helm');

    expect(helmCalls[0]).toContain('helm');
    expect(helmCalls[0][1]).toContain('repo');
    expect(helmCalls[0][1]).toContain('add');

    expect(helmCalls[1][1]).toContain('repo');
    expect(helmCalls[1][1]).toContain('update');

    expect(helmCalls[2][1]).toContain('install');
    expect(helmCalls[2][1]).toContain('fleet-crd');

    expect(helmCalls[3][1]).toContain('install');
    expect(helmCalls[3][1]).toContain('fleet');
    expect(helmCalls[3][1]).not.toContain('fleet-crd');

    // Verify namespace creation was called
    const kubectlCalls = calls.filter(call => call[0] === 'kubectl');
    const createNsCalls = kubectlCalls.filter(call =>
      call[1]?.includes('create') && call[1]?.includes('namespace')
    );
    expect(createNsCalls.length).toBeGreaterThan(0);
  });

  it('sets installing to true during installation', async () => {
    // Initial check - not installed
    mockExec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    } as never);

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('not-installed');
    });

    expect(result.current.installing).toBe(false);

    // Create a slow install
    let resolveInstall: () => void;
    const installPromise = new Promise<void>((resolve) => {
      resolveInstall = resolve;
    });

    mockExec.mockImplementationOnce(() => installPromise as never);

    // Start install (don't await)
    act(() => {
      result.current.installFleet();
    });

    expect(result.current.installing).toBe(true);

    // Complete installation
    await act(async () => {
      resolveInstall!();
      // Add remaining mock responses
      mockExec
        .mockResolvedValueOnce({ stdout: '', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: '', stderr: '' } as never);
    });
  });

  it('sets error status when installation fails', async () => {
    // Initial check - not installed
    mockExec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    } as never);

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('not-installed');
    });

    // helm repo add fails
    mockExec.mockRejectedValueOnce(new Error('Network unreachable'));

    await act(async () => {
      await result.current.installFleet();
    });

    expect(result.current.fleetState.status).toBe('error');
    expect(result.current.fleetState.error).toBe('Network unreachable');
    expect(result.current.installing).toBe(false);
  });

  it('checkFleetStatus can be called manually', async () => {
    // Initial check - not installed
    mockExec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    } as never);

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('not-installed');
    });

    // Manual re-check - now running
    mockExec
      .mockResolvedValueOnce({
        stdout: 'gitrepos.fleet.cattle.io',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        stdout: 'Running',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        stdout: 'fleet-local',
        stderr: '',
      } as never)
      .mockResolvedValueOnce({
        stdout: JSON.stringify([{ app_version: '0.10.0' }]),
        stderr: '',
      } as never);

    await act(async () => {
      await result.current.checkFleetStatus();
    });

    expect(result.current.fleetState.status).toBe('running');
  });

  it('handles CRD check with stderr error', async () => {
    mockExec.mockResolvedValueOnce({
      stdout: '',
      stderr: 'Error from server (NotFound): gitrepos.fleet.cattle.io not found',
    } as never);

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('not-installed');
    });
  });

  it('returns initializing status and creates namespace when namespace does not exist', async () => {
    mockExec
      // CRD check
      .mockResolvedValueOnce({
        stdout: 'gitrepos.fleet.cattle.io',
        stderr: '',
      } as never)
      // Pod check
      .mockResolvedValueOnce({
        stdout: 'Running',
        stderr: '',
      } as never)
      // Namespace check - throws NotFound
      .mockRejectedValueOnce(new Error('Error from server (NotFound): namespaces "fleet-local" not found'))
      // Create namespace
      .mockResolvedValueOnce({ stdout: '', stderr: '' } as never);

    const { result } = renderHook(() => useFleetStatus());

    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('initializing');
      expect(result.current.fleetState.message).toContain('fleet-local');
    });

    // Verify namespace creation was attempted
    const calls = mockExec.mock.calls;
    const createNsCalls = calls.filter(call =>
      call[0] === 'kubectl' && call[1]?.includes('create') && call[1]?.includes('namespace')
    );
    expect(createNsCalls.length).toBe(1);
  });

  it('ignores already exists error when creating namespace', async () => {
    mockExec
      // CRD check
      .mockResolvedValueOnce({
        stdout: 'gitrepos.fleet.cattle.io',
        stderr: '',
      } as never)
      // Pod check
      .mockResolvedValueOnce({
        stdout: 'Running',
        stderr: '',
      } as never)
      // Namespace check - throws NotFound
      .mockRejectedValueOnce(new Error('Error from server (NotFound): namespaces "fleet-local" not found'))
      // Create namespace - throws already exists (race condition)
      .mockRejectedValueOnce(new Error('namespaces "fleet-local" already exists'));

    const { result } = renderHook(() => useFleetStatus());

    // Should still show initializing (will re-check after setTimeout)
    await waitFor(() => {
      expect(result.current.fleetState.status).toBe('initializing');
    });
  });
});
