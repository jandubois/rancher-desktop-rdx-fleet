/**
 * useBackendInit - Hook to initialize the backend with extension context.
 *
 * On startup, this hook:
 * 1. Waits for the backend to be available
 * 2. Fetches installed extensions via `rdctl extension ls`
 * 3. Fetches kubeconfig via `kubectl config view --raw`
 * 4. Posts both to /api/init to enable ownership checking
 *
 * This enables the backend to determine if this extension should own Fleet
 * by checking which other Fleet extensions are installed and running.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { CommandExecutor } from '../services';
import { backendService, InstalledExtension, OwnershipStatus } from '../services/BackendService';

export interface BackendInitStatus {
  /** Whether initialization has been attempted */
  attempted: boolean;
  /** Whether initialization succeeded */
  initialized: boolean;
  /** Error message if initialization failed */
  error?: string;
  /** Ownership status returned from backend */
  ownership?: OwnershipStatus;
  /** Installed extensions found */
  installedExtensions: InstalledExtension[];
  /** Whether currently initializing */
  loading: boolean;
}

export interface UseBackendInitOptions {
  /** Command executor for host commands */
  commandExecutor: CommandExecutor;
  /** Whether the backend is connected */
  backendConnected: boolean;
  /** Callback when initialization completes */
  onInitialized?: (ownership: OwnershipStatus) => void;
}

interface RdctlExtension {
  name: string;
  tag: string;
  labels?: Record<string, string>;
}

/**
 * Parse rdctl extension ls output.
 * Output format: JSON array of objects with name, tag, and optionally labels.
 */
function parseRdctlOutput(stdout: string): InstalledExtension[] {
  try {
    // rdctl extension ls --output json returns a JSON array
    const extensions = JSON.parse(stdout) as RdctlExtension[];
    if (!Array.isArray(extensions)) {
      console.warn('[BackendInit] rdctl output is not an array');
      return [];
    }

    return extensions.map((ext) => ({
      name: ext.name,
      tag: ext.tag,
      labels: ext.labels,
    }));
  } catch (error) {
    console.error('[BackendInit] Failed to parse rdctl output:', error);
    console.debug('[BackendInit] Raw output:', stdout);
    return [];
  }
}

/**
 * Hook to initialize the backend with extension context.
 */
export function useBackendInit({
  commandExecutor,
  backendConnected,
  onInitialized,
}: UseBackendInitOptions): BackendInitStatus & { retry: () => void } {
  const [status, setStatus] = useState<BackendInitStatus>({
    attempted: false,
    initialized: false,
    installedExtensions: [],
    loading: false,
  });

  // Track if we've already initialized to avoid duplicate calls
  const initAttempted = useRef(false);
  const onInitializedRef = useRef(onInitialized);
  onInitializedRef.current = onInitialized;

  const initialize = useCallback(async () => {
    if (status.loading) {
      console.debug('[BackendInit] Already loading, skipping');
      return;
    }

    console.log('[BackendInit] Starting initialization...');
    setStatus((prev) => ({ ...prev, loading: true, error: undefined }));

    try {
      // Step 1: Get installed extensions via rdctl
      console.log('[BackendInit] Fetching installed extensions via rdctl...');
      let installedExtensions: InstalledExtension[] = [];

      try {
        // Try rdctl extension ls with JSON output
        const rdctlResult = await commandExecutor.exec('rdctl', [
          'extension',
          'ls',
          '--output',
          'json',
        ]);

        if (rdctlResult.stderr && !rdctlResult.stdout) {
          console.warn('[BackendInit] rdctl stderr:', rdctlResult.stderr);
        }

        if (rdctlResult.stdout) {
          installedExtensions = parseRdctlOutput(rdctlResult.stdout);
          console.log(`[BackendInit] Found ${installedExtensions.length} installed extensions`);
        }
      } catch (rdctlError) {
        console.warn('[BackendInit] rdctl failed, continuing without extension list:', rdctlError);
        // Continue without extension list - backend will work with empty list
      }

      // Step 2: Get kubeconfig
      console.log('[BackendInit] Fetching kubeconfig...');
      let kubeconfig: string | undefined;

      try {
        const kubeconfigResult = await commandExecutor.exec('rd-exec', [
          'kubectl',
          'config',
          'view',
          '--raw',
        ]);

        if (kubeconfigResult.stdout) {
          kubeconfig = kubeconfigResult.stdout;
          console.log(`[BackendInit] Got kubeconfig (${kubeconfig.length} bytes)`);
        }
      } catch (kubeconfigError) {
        console.warn('[BackendInit] Failed to get kubeconfig:', kubeconfigError);
        // Continue without kubeconfig - ownership check will fail but backend will still work
      }

      // Step 3: Post to /api/init
      console.log('[BackendInit] Posting to backend /api/init...');
      const ownership = await backendService.initialize({
        installedExtensions,
        kubeconfig,
      });

      console.log('[BackendInit] Initialization complete:', ownership.status, ownership.message);

      setStatus({
        attempted: true,
        initialized: true,
        installedExtensions,
        ownership,
        loading: false,
      });

      // Trigger callback
      if (onInitializedRef.current) {
        onInitializedRef.current(ownership);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[BackendInit] Initialization failed:', errorMsg);

      setStatus((prev) => ({
        ...prev,
        attempted: true,
        initialized: false,
        error: errorMsg,
        loading: false,
      }));
    }
  }, [commandExecutor, status.loading]);

  // Auto-initialize when backend becomes connected
  useEffect(() => {
    if (backendConnected && !initAttempted.current && !status.attempted) {
      initAttempted.current = true;
      initialize();
    }
  }, [backendConnected, status.attempted, initialize]);

  // Retry function for manual re-initialization
  const retry = useCallback(() => {
    initAttempted.current = false;
    setStatus({
      attempted: false,
      initialized: false,
      installedExtensions: [],
      loading: false,
    });
    // Will trigger useEffect on next render
  }, []);

  return {
    ...status,
    retry,
  };
}

export default useBackendInit;
