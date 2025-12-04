import { useState, useCallback, useEffect, useRef } from 'react';
import { KubernetesService, backendService } from '../services';
import { getErrorMessage } from '../utils';
import { FleetState } from '../types';

interface UseFleetStatusOptions {
  onFleetReady?: () => void;
  /**
   * Optional KubernetesService for dependency injection.
   * If not provided, the hook must be used within a ServiceProvider.
   */
  kubernetesService?: KubernetesService;
}

interface UseFleetStatusResult {
  fleetState: FleetState;
  checkFleetStatus: () => Promise<void>;
}

/**
 * Hook for managing Fleet installation status.
 *
 * Fleet is automatically installed by the backend service. This hook
 * monitors the status and polls while installation is in progress.
 *
 * Can be used in two ways:
 * 1. With injected service (for testing):
 *    ```ts
 *    const mockService = new KubernetesService(mockExecutor);
 *    useFleetStatus({ kubernetesService: mockService });
 *    ```
 *
 * 2. With ServiceProvider context (for production):
 *    ```tsx
 *    <ServiceProvider>
 *      <ComponentUsingFleetStatus />
 *    </ServiceProvider>
 *    ```
 */
export function useFleetStatus(options: UseFleetStatusOptions = {}): UseFleetStatusResult {
  const { onFleetReady, kubernetesService } = options;
  const [fleetState, setFleetState] = useState<FleetState>({ status: 'checking' });
  const onFleetReadyRef = useRef(onFleetReady);
  const serviceRef = useRef(kubernetesService);

  // Keep refs updated
  useEffect(() => {
    onFleetReadyRef.current = onFleetReady;
  }, [onFleetReady]);

  useEffect(() => {
    serviceRef.current = kubernetesService;
  }, [kubernetesService]);

  const checkFleetStatus = useCallback(async () => {
    const service = serviceRef.current;
    if (!service) {
      console.error('KubernetesService not available');
      setFleetState({ status: 'error', error: 'Service not configured' });
      return;
    }

    // Don't reset to 'checking' if we're already showing installation progress
    const currentStatus = fleetState.status;
    if (currentStatus !== 'installing' && currentStatus !== 'not-installed') {
      setFleetState({ status: 'checking' });
    }

    try {
      // First check backend state - it knows about installation progress
      try {
        const backendState = await backendService.getFleetState();
        // If backend is installing or running, use its state
        if (backendState.status === 'installing' || backendState.status === 'running') {
          setFleetState(backendState);
          if (backendState.status === 'running') {
            onFleetReadyRef.current?.();
          }
          return;
        }
      } catch {
        // Backend not available, fall back to direct kubectl check
        console.log('Backend Fleet state not available, using kubectl check');
      }

      // Fall back to direct cluster check
      const result = await service.checkFleetStatus();

      if (result.needsNamespaceCreation) {
        setFleetState(result.state);
        try {
          await service.createFleetNamespace();
        } catch (createErr) {
          // Log but don't fail - namespace might already exist
          console.warn('Namespace creation warning:', createErr);
        }
        // Re-check status after creating namespace
        setTimeout(() => checkFleetStatus(), 500);
        return;
      }

      setFleetState(result.state);
      if (result.state.status === 'running') {
        onFleetReadyRef.current?.();
      }
    } catch (err) {
      console.error('Fleet status check error:', err);
      setFleetState({
        status: 'error',
        error: getErrorMessage(err),
      });
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

    const interval = setInterval(() => {
      checkFleetStatus();
    }, 3000); // Poll every 3 seconds while installing/initializing

    return () => clearInterval(interval);
  }, [fleetState.status, checkFleetStatus]);

  return {
    fleetState,
    checkFleetStatus,
  };
}
