import { useState, useCallback, useEffect, useRef } from 'react';
import { ddClient } from '../lib/ddClient';
import { getErrorMessage, KUBE_CONTEXT, FLEET_NAMESPACE } from '../utils';
import { FleetState } from '../types';

interface UseFleetStatusOptions {
  onFleetReady?: () => void;
}

interface UseFleetStatusResult {
  fleetState: FleetState;
  installing: boolean;
  checkFleetStatus: () => Promise<void>;
  installFleet: () => Promise<void>;
}

export function useFleetStatus(options: UseFleetStatusOptions = {}): UseFleetStatusResult {
  const { onFleetReady } = options;
  const [fleetState, setFleetState] = useState<FleetState>({ status: 'checking' });
  const [installing, setInstalling] = useState(false);
  const onFleetReadyRef = useRef(onFleetReady);

  // Keep ref updated
  useEffect(() => {
    onFleetReadyRef.current = onFleetReady;
  }, [onFleetReady]);

  const checkFleetStatus = useCallback(async () => {
    setFleetState({ status: 'checking' });
    try {
      let crdExists = false;
      try {
        const result = await ddClient.extension.host?.cli.exec('kubectl', [
          '--context', KUBE_CONTEXT,
          'get', 'crd', 'gitrepos.fleet.cattle.io',
          '-o', 'jsonpath={.metadata.name}',
        ]);
        crdExists = !result?.stderr && (result?.stdout?.includes('gitrepos.fleet.cattle.io') ?? false);
      } catch (crdErr) {
        const errMsg = getErrorMessage(crdErr);
        if (errMsg.includes('NotFound') || errMsg.includes('not found')) {
          setFleetState({ status: 'not-installed' });
          return;
        }
        throw crdErr;
      }

      if (!crdExists) {
        setFleetState({ status: 'not-installed' });
        return;
      }

      const podResult = await ddClient.extension.host?.cli.exec('kubectl', [
        '--context', KUBE_CONTEXT,
        'get', 'pods', '-n', 'cattle-fleet-system',
        '-l', 'app=fleet-controller',
        '-o', 'jsonpath={.items[0].status.phase}',
      ]);

      if (podResult?.stdout === 'Running') {
        // Check if fleet-local namespace exists (created by Fleet controller)
        const nsResult = await ddClient.extension.host?.cli.exec('kubectl', [
          '--context', KUBE_CONTEXT,
          'get', 'namespace', FLEET_NAMESPACE,
          '-o', 'jsonpath={.metadata.name}',
        ]);
        const namespaceExists = !nsResult?.stderr && nsResult?.stdout === FLEET_NAMESPACE;

        if (!namespaceExists) {
          // Fleet controller is running but hasn't created fleet-local namespace yet
          setFleetState({
            status: 'error',
            error: `Fleet controller is running but the "${FLEET_NAMESPACE}" namespace has not been created yet. This may indicate Fleet is still initializing. Please wait a moment and try again.`,
          });
          return;
        }

        const versionResult = await ddClient.extension.host?.cli.exec('helm', [
          '--kube-context', KUBE_CONTEXT,
          'list', '-n', 'cattle-fleet-system',
          '-f', 'fleet',
          '-o', 'json',
        ]);
        let version = 'unknown';
        try {
          const releases = JSON.parse(versionResult?.stdout || '[]');
          if (releases.length > 0) {
            version = releases[0].app_version || releases[0].chart;
          }
        } catch {
          // Ignore parse errors
        }
        setFleetState({ status: 'running', version });
        onFleetReadyRef.current?.();
      } else {
        setFleetState({ status: 'not-installed' });
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
    setInstalling(true);
    try {
      await ddClient.extension.host?.cli.exec('helm', [
        '--kube-context', KUBE_CONTEXT,
        'repo', 'add', 'fleet', 'https://rancher.github.io/fleet-helm-charts/',
      ]);

      await ddClient.extension.host?.cli.exec('helm', [
        '--kube-context', KUBE_CONTEXT,
        'repo', 'update',
      ]);

      await ddClient.extension.host?.cli.exec('helm', [
        '--kube-context', KUBE_CONTEXT,
        'install', '--create-namespace', '-n', 'cattle-fleet-system',
        'fleet-crd', 'fleet/fleet-crd',
        '--wait',
      ]);

      await ddClient.extension.host?.cli.exec('helm', [
        '--kube-context', KUBE_CONTEXT,
        'install', '--create-namespace', '-n', 'cattle-fleet-system',
        'fleet', 'fleet/fleet',
        '--wait',
      ]);

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

  return {
    fleetState,
    installing,
    checkFleetStatus,
    installFleet,
  };
}
