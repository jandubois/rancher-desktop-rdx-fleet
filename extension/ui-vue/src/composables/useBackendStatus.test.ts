/**
 * Unit tests for the useBackendStatus composable.
 * Tests backend health monitoring and polling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useBackendStatus } from './useBackendStatus';
import type { BackendStatus, BackendHealth, ExtensionIdentity } from '../services/BackendService';

// Mock the backend service
vi.mock('../services/BackendService', () => ({
  backendService: {
    getStatus: vi.fn(),
  },
}));

import { backendService } from '../services/BackendService';
const mockGetStatus = vi.mocked(backendService.getStatus);

const createMockStatus = (connected: boolean, healthy = true): BackendStatus => ({
  connected,
  lastChecked: new Date().toISOString(),
  ...(connected && {
    health: {
      status: healthy ? 'healthy' : 'degraded',
      uptime: 12345,
      timestamp: new Date().toISOString(),
      containerId: 'container-123',
      checks: [
        { name: 'database', status: 'pass' },
        { name: 'kubernetes', status: healthy ? 'pass' : 'fail' },
      ],
    } as BackendHealth,
    identity: {
      containerId: 'container-123',
      extensionName: 'fleet-gitops',
      extensionType: 'base',
      version: '1.0.0',
      startedAt: new Date().toISOString(),
    } as ExtensionIdentity,
  }),
});

describe('useBackendStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should initialize with null status', () => {
      // Prevent auto-polling
      mockGetStatus.mockImplementation(() => new Promise(() => {}));

      const { status, isConnected, isHealthy } = useBackendStatus(10000);

      expect(status.value).toBeNull();
      expect(isConnected.value).toBe(false);
      expect(isHealthy.value).toBe(false);
    });
  });

  describe('computed properties', () => {
    it('should compute isConnected from status', async () => {
      mockGetStatus.mockResolvedValue(createMockStatus(true));

      const { checkStatus, isConnected } = useBackendStatus(10000);
      await checkStatus();

      expect(isConnected.value).toBe(true);
    });

    it('should compute isHealthy from health status', async () => {
      mockGetStatus.mockResolvedValue(createMockStatus(true, true));

      const { checkStatus, isHealthy } = useBackendStatus(10000);
      await checkStatus();

      expect(isHealthy.value).toBe(true);
    });

    it('should compute health from status', async () => {
      const mockStatus = createMockStatus(true);
      mockGetStatus.mockResolvedValue(mockStatus);

      const { checkStatus, health } = useBackendStatus(10000);
      await checkStatus();

      expect(health.value).toEqual(mockStatus.health);
    });

    it('should compute identity from status', async () => {
      const mockStatus = createMockStatus(true);
      mockGetStatus.mockResolvedValue(mockStatus);

      const { checkStatus, identity } = useBackendStatus(10000);
      await checkStatus();

      expect(identity.value).toEqual(mockStatus.identity);
    });

    it('should compute containerId from identity', async () => {
      mockGetStatus.mockResolvedValue(createMockStatus(true));

      const { checkStatus, containerId } = useBackendStatus(10000);
      await checkStatus();

      expect(containerId.value).toBe('container-123');
    });

    it('should compute extensionName from identity', async () => {
      mockGetStatus.mockResolvedValue(createMockStatus(true));

      const { checkStatus, extensionName } = useBackendStatus(10000);
      await checkStatus();

      expect(extensionName.value).toBe('fleet-gitops');
    });

    it('should compute error from status', async () => {
      mockGetStatus.mockResolvedValue({
        connected: false,
        error: 'Connection refused',
        lastChecked: new Date().toISOString(),
      });

      const { checkStatus, error } = useBackendStatus(10000);
      await checkStatus();

      expect(error.value).toBe('Connection refused');
    });

    it('should compute lastChecked from status', async () => {
      const timestamp = '2024-01-01T12:00:00.000Z';
      mockGetStatus.mockResolvedValue({
        connected: true,
        lastChecked: timestamp,
      });

      const { checkStatus, lastChecked } = useBackendStatus(10000);
      await checkStatus();

      expect(lastChecked.value).toBe(timestamp);
    });
  });

  describe('checkStatus', () => {
    it('should update status from backend', async () => {
      const mockStatus = createMockStatus(true);
      mockGetStatus.mockResolvedValue(mockStatus);

      const { checkStatus, status } = useBackendStatus(10000);
      await checkStatus();

      expect(status.value).toEqual(mockStatus);
    });

    it('should handle errors gracefully', async () => {
      mockGetStatus.mockRejectedValue(new Error('Network error'));

      const { checkStatus, status, isConnected, error } = useBackendStatus(10000);
      await checkStatus();

      expect(status.value).toBeDefined();
      expect(isConnected.value).toBe(false);
      expect(error.value).toBe('Network error');
    });
  });

  describe('polling', () => {
    it('should start polling on mount', async () => {
      mockGetStatus.mockResolvedValue(createMockStatus(true));

      // The composable auto-starts polling via onMounted
      // Since we're not in a Vue component context, we need to manually call startPolling
      const { startPolling, isPolling } = useBackendStatus(1000);
      startPolling();

      expect(isPolling.value).toBe(true);

      await vi.waitFor(() => {
        expect(mockGetStatus).toHaveBeenCalled();
      });
    });

    it('should poll at the specified interval', async () => {
      mockGetStatus.mockResolvedValue(createMockStatus(true));

      const { startPolling } = useBackendStatus(1000);
      startPolling();

      await vi.waitFor(() => {
        expect(mockGetStatus).toHaveBeenCalledTimes(1);
      });

      await vi.advanceTimersByTimeAsync(1000);
      expect(mockGetStatus).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(1000);
      expect(mockGetStatus).toHaveBeenCalledTimes(3);
    });

    it('should stop polling when requested', async () => {
      mockGetStatus.mockResolvedValue(createMockStatus(true));

      const { startPolling, stopPolling, isPolling } = useBackendStatus(1000);
      startPolling();
      stopPolling();

      expect(isPolling.value).toBe(false);

      const callCount = mockGetStatus.mock.calls.length;
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockGetStatus.mock.calls.length).toBe(callCount);
    });

    it('should not start multiple polling intervals', () => {
      mockGetStatus.mockResolvedValue(createMockStatus(true));

      const { startPolling, isPolling } = useBackendStatus(1000);
      startPolling();
      startPolling(); // Second call should be ignored

      expect(isPolling.value).toBe(true);
    });
  });
});
