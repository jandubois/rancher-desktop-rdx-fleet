import { useState, useCallback, useEffect, useRef } from 'react';
import { backendService } from '../services';
import { getErrorMessage } from '../utils';
import { FleetState } from '../types';

interface UseFleetStatusOptions {
  onFleetReady?: () => void;
}

interface UseFleetStatusResult {
  fleetState: FleetState;
  checkFleetStatus: () => Promise<void>;
}

/**
 * Hook for managing Fleet installation status.
 *
 * Fleet is automatically installed by the backend service. This hook
 * monitors the status via the backend API and polls while installation
 * is in progress.
 *
 * All Fleet operations are handled by the backend using the Kubernetes
 * client library - no kubectl CLI calls are needed.
 */
export function useFleetStatus(options: UseFleetStatusOptions = {}): UseFleetStatusResult {
  const { onFleetReady } = options;
  const [fleetState, setFleetState] = useState<FleetState>({ status: 'checking' });
  const onFleetReadyRef = useRef(onFleetReady);

  // Keep ref updated
  useEffect(() => {
    onFleetReadyRef.current = onFleetReady;
  }, [onFleetReady]);

  const checkFleetStatus = useCallback(async () => {
    // Don't reset to 'checking' if we're already showing installation progress
    const currentStatus = fleetState.status;
    if (currentStatus !== 'installing' && currentStatus !== 'not-installed') {
      setFleetState((prev) => prev.status === 'running' ? prev : { status: 'checking' });
    }

    try {
      // Get Fleet state from backend - it manages installation and knows the current status
      const backendState = await backendService.getFleetState();
      setFleetState(backendState);

      if (backendState.status === 'running') {
        onFleetReadyRef.current?.();
      }
    } catch (err) {
      console.error('Fleet status check error:', err);
      const errMsg = getErrorMessage(err);

      // Backend may be initializing - show appropriate state
      if (errMsg.includes('503') || errMsg.includes('not ready')) {
        setFleetState({
          status: 'checking',
          message: 'Waiting for backend initialization...',
        });
      } else {
        setFleetState({
          status: 'error',
          error: errMsg,
        });
      }
    }
  }, [fleetState.status]);

  // Check status on mount
  useEffect(() => {
    checkFleetStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-poll when not yet running to detect when Fleet is ready
  // This handles 'checking', 'initializing' (namespace creation), 'not-installed'
  // (waiting for backend auto-installation) and 'installing' states
  useEffect(() => {
    const shouldPoll = fleetState.status === 'checking' ||
                       fleetState.status === 'initializing' ||
                       fleetState.status === 'not-installed' ||
                       fleetState.status === 'installing';
    if (!shouldPoll) return;

    // Poll faster during installation to show progress updates
    const pollInterval = fleetState.status === 'installing' ? 1000 : 3000;
    const interval = setInterval(() => {
      checkFleetStatus();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [fleetState.status, checkFleetStatus]);

  return {
    fleetState,
    checkFleetStatus,
  };
}
