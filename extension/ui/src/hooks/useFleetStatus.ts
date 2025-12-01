import { useState, useCallback, useEffect, useRef } from 'react';
import { KubernetesService } from '../services';
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
  installing: boolean;
  checkFleetStatus: () => Promise<void>;
  installFleet: () => Promise<void>;
}

/**
 * Hook for managing Fleet installation status.
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
  const [installing, setInstalling] = useState(false);
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

    setFleetState({ status: 'checking' });
    try {
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
  }, []);

  const installFleet = useCallback(async () => {
    const service = serviceRef.current;
    if (!service) {
      console.error('KubernetesService not available');
      setFleetState({ status: 'error', error: 'Service not configured' });
      return;
    }

    setInstalling(true);
    try {
      await service.installFleet();
      await checkFleetStatus();
    } catch (err) {
      console.error('Fleet install error:', err);
      setFleetState({
        status: 'error',
        error: getErrorMessage(err),
      });
    } finally {
      setInstalling(false);
    }
  }, [checkFleetStatus]);

  // Check status on mount
  useEffect(() => {
    checkFleetStatus();
  }, [checkFleetStatus]);

  // Auto-poll when initializing to detect when Fleet is ready
  useEffect(() => {
    if (fleetState.status !== 'initializing') return;

    const interval = setInterval(() => {
      checkFleetStatus();
    }, 2000); // Poll every 2 seconds while initializing

    return () => clearInterval(interval);
  }, [fleetState.status, checkFleetStatus]);

  return {
    fleetState,
    installing,
    checkFleetStatus,
    installFleet,
  };
}
