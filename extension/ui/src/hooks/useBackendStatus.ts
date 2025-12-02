/**
 * Hook for managing backend service status.
 *
 * Provides:
 * - Connection status monitoring
 * - Health and identity polling
 * - Manual refresh capability
 */

import { useState, useEffect, useCallback } from 'react';
import { BackendService, BackendStatus } from '../services/BackendService';

/** Options for the useBackendStatus hook */
export interface UseBackendStatusOptions {
  /** Backend service instance (for dependency injection in tests) */
  backendService?: BackendService;
  /** Polling interval in milliseconds (0 to disable) */
  pollInterval?: number;
  /** Whether to start polling immediately */
  autoStart?: boolean;
}

/** Return type for the useBackendStatus hook */
export interface UseBackendStatusResult {
  /** Current backend status */
  status: BackendStatus | null;
  /** Whether currently checking status */
  loading: boolean;
  /** Last error (if any) */
  error: string | null;
  /** Manually refresh the status */
  refresh: () => Promise<void>;
  /** Start polling */
  startPolling: () => void;
  /** Stop polling */
  stopPolling: () => void;
  /** Whether polling is active */
  isPolling: boolean;
}

/**
 * Hook to monitor backend service status.
 */
export function useBackendStatus(options: UseBackendStatusOptions = {}): UseBackendStatusResult {
  const {
    backendService = new BackendService(),
    pollInterval = 10000, // 10 seconds default
    autoStart = true,
  } = options;

  const [status, setStatus] = useState<BackendStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(autoStart);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const newStatus = await backendService.getStatus();
      setStatus(newStatus);

      if (!newStatus.connected && newStatus.error) {
        setError(newStatus.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check backend status';
      setError(message);
      setStatus({
        connected: false,
        error: message,
        lastChecked: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }, [backendService]);

  const startPolling = useCallback(() => {
    setIsPolling(true);
  }, []);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Polling
  useEffect(() => {
    if (!isPolling || pollInterval <= 0) return;

    const interval = setInterval(refresh, pollInterval);
    return () => clearInterval(interval);
  }, [isPolling, pollInterval, refresh]);

  return {
    status,
    loading,
    error,
    refresh,
    startPolling,
    stopPolling,
    isPolling,
  };
}
