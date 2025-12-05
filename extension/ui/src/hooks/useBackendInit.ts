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
import { ddClient } from '../lib/ddClient';

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

/**
 * Parse rdctl extension ls output.
 * Output format: Plain text with header "Extension IDs" followed by image:tag lines.
 * Example:
 *   Extension IDs
 *
 *   fleet-gitops-extension:latest
 *   my-fleet-extension:dev
 */
function parseRdctlOutput(stdout: string): InstalledExtension[] {
  const extensions: InstalledExtension[] = [];
  const lines = stdout.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and header lines (lines without a colon are not image:tag format)
    if (!trimmed || !trimmed.includes(':')) {
      continue;
    }
    // Parse image:tag format - the tag is after the last colon
    const lastColonIndex = trimmed.lastIndexOf(':');
    if (lastColonIndex > 0) {
      const name = trimmed.substring(0, lastColonIndex);
      const tag = trimmed.substring(lastColonIndex + 1);
      // Only include if both name and tag are non-empty
      if (name && tag) {
        extensions.push({ name, tag });
      }
    }
  }

  return extensions;
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

  // Update the callback ref when it changes (must be in useEffect, not during render)
  useEffect(() => {
    onInitializedRef.current = onInitialized;
  }, [onInitialized]);

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
        // Run rdctl extension ls (outputs plain text, not JSON)
        const rdctlResult = await commandExecutor.rdExec('rdctl', [
          'extension',
          'ls',
        ]);

        if (rdctlResult.stderr && !rdctlResult.stdout) {
          console.warn('[BackendInit] rdctl stderr:', rdctlResult.stderr);
        }

        if (rdctlResult.stdout) {
          console.log('[BackendInit] Raw rdctl output:', rdctlResult.stdout);
          installedExtensions = parseRdctlOutput(rdctlResult.stdout);
          console.log(`[BackendInit] Found ${installedExtensions.length} installed extensions:`,
            installedExtensions.map(e => e.name));
          // Log to backend for docker logs visibility
          backendService.debugLog('BackendInit', 'rdctl extension ls output', {
            raw: rdctlResult.stdout,
            parsed: installedExtensions,
          });
        }
      } catch (rdctlError) {
        console.warn('[BackendInit] rdctl failed, continuing without extension list:', rdctlError);
        // Continue without extension list - backend will work with empty list
      }

      // Step 2: Get kubeconfig
      console.log('[BackendInit] Fetching kubeconfig...');
      let kubeconfig: string | undefined;

      try {
        const kubeconfigResult = await commandExecutor.rdExec('kubectl', [
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

      // Step 3: Get own extension image name from Docker SDK
      const ownExtensionImage = (ddClient.extension as { image?: string })?.image;
      console.log(`[BackendInit] Own extension image: ${ownExtensionImage || 'unknown'}`);

      // Step 4: Post to /api/init
      console.log('[BackendInit] Posting to backend /api/init...');
      const ownership = await backendService.initialize({
        installedExtensions,
        kubeconfig,
        ownExtensionImage,
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
      // Schedule for next tick to avoid synchronous setState in effect
      queueMicrotask(() => {
        void initialize();
      });
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
