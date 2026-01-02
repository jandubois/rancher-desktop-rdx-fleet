/**
 * Unit tests for the fleet Pinia store.
 * Tests Fleet status polling and state management.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useFleetStore } from './fleet';

// Mock the backend service
vi.mock('../services/BackendService', () => ({
  backendService: {
    getFleetState: vi.fn(),
  },
}));

import { backendService } from '../services/BackendService';
const mockGetFleetState = vi.mocked(backendService.getFleetState);

describe('useFleetStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should initialize with checking status', () => {
      const store = useFleetStore();

      expect(store.status).toBe('checking');
      expect(store.version).toBeUndefined();
      expect(store.error).toBeUndefined();
      expect(store.isPolling).toBe(false);
    });
  });

  describe('computed properties', () => {
    it('should compute isRunning correctly', () => {
      const store = useFleetStore();

      store.status = 'running';
      expect(store.isRunning).toBe(true);

      store.status = 'error';
      expect(store.isRunning).toBe(false);
    });

    it('should compute isInstalling correctly', () => {
      const store = useFleetStore();

      store.status = 'installing';
      expect(store.isInstalling).toBe(true);

      store.status = 'running';
      expect(store.isInstalling).toBe(false);
    });

    it('should compute isError correctly', () => {
      const store = useFleetStore();

      store.status = 'error';
      expect(store.isError).toBe(true);

      store.status = 'running';
      expect(store.isError).toBe(false);
    });

    it('should compute needsInstall correctly', () => {
      const store = useFleetStore();

      store.status = 'not-installed';
      expect(store.needsInstall).toBe(true);

      store.status = 'running';
      expect(store.needsInstall).toBe(false);
    });
  });

  describe('checkStatus', () => {
    it('should update state from backend response', async () => {
      mockGetFleetState.mockResolvedValue({
        status: 'running',
        version: '0.10.0',
        message: 'Fleet is running',
      });

      const store = useFleetStore();
      await store.checkStatus();

      expect(store.status).toBe('running');
      expect(store.version).toBe('0.10.0');
      expect(store.message).toBe('Fleet is running');
      expect(store.error).toBeUndefined();
    });

    it('should handle error from backend', async () => {
      mockGetFleetState.mockResolvedValue({
        status: 'error',
        error: 'Fleet crashed',
      });

      const store = useFleetStore();
      await store.checkStatus();

      expect(store.status).toBe('error');
      expect(store.error).toBe('Fleet crashed');
    });

    it('should handle network error gracefully', async () => {
      mockGetFleetState.mockRejectedValue(new Error('Network error'));

      const store = useFleetStore();
      await store.checkStatus();

      expect(store.status).toBe('error');
      expect(store.error).toBe('Network error');
    });
  });

  describe('polling', () => {
    it('should start polling and check status immediately', async () => {
      mockGetFleetState.mockResolvedValue({ status: 'running' });

      const store = useFleetStore();
      store.startPolling(5000);

      expect(store.isPolling).toBe(true);

      // Should have called checkStatus immediately
      await vi.waitFor(() => {
        expect(mockGetFleetState).toHaveBeenCalledTimes(1);
      });
    });

    it('should poll at the specified interval', async () => {
      mockGetFleetState.mockResolvedValue({ status: 'running' });

      const store = useFleetStore();
      store.startPolling(1000);

      // Initial call
      await vi.waitFor(() => {
        expect(mockGetFleetState).toHaveBeenCalledTimes(1);
      });

      // Advance timer
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockGetFleetState).toHaveBeenCalledTimes(2);

      // Advance timer again
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockGetFleetState).toHaveBeenCalledTimes(3);
    });

    it('should not start polling if already polling', () => {
      mockGetFleetState.mockResolvedValue({ status: 'running' });

      const store = useFleetStore();
      store.startPolling(1000);
      store.startPolling(1000); // Second call should be ignored

      expect(store.isPolling).toBe(true);
    });

    it('should stop polling', async () => {
      mockGetFleetState.mockResolvedValue({ status: 'running' });

      const store = useFleetStore();
      store.startPolling(1000);
      store.stopPolling();

      expect(store.isPolling).toBe(false);

      // Advance timer - should not trigger more calls
      const callCount = mockGetFleetState.mock.calls.length;
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockGetFleetState.mock.calls.length).toBe(callCount);
    });
  });
});
