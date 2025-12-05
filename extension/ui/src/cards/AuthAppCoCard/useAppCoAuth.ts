/**
 * Custom hook for AppCo (SUSE Application Collection) authentication state management.
 *
 * Handles credential storage, validation, and UI state for the AppCo auth card.
 * Also syncs credentials to:
 * - Kubernetes cluster (imagePullSecret for Fleet)
 * - Helm registry (for OCI chart pulls)
 */

import { useState, useCallback, useEffect } from 'react';
import { useCredentialService, useAppCoService, useKubernetesService } from '../../context/ServiceContext';
import type { AppCoUser, CredHelperStatus } from '../../services';

/** Auth state for AppCo */
export type AppCoAuthState = 'loading' | 'unauthenticated' | 'authenticated' | 'error';

export interface UseAppCoAuthResult {
  // State
  authState: AppCoAuthState;
  user: AppCoUser | null;
  credHelperStatus: CredHelperStatus | null;
  error: string | null;
  isLoading: boolean;

  // Actions
  handleSubmitCredentials: (username: string, token: string) => Promise<void>;
  handleDisconnect: () => Promise<void>;
  setError: (error: string | null) => void;
}

export function useAppCoAuth(): UseAppCoAuthResult {
  const credentialService = useCredentialService();
  const appCoService = useAppCoService();
  const kubernetesService = useKubernetesService();

  // State
  const [authState, setAuthState] = useState<AppCoAuthState>('loading');
  const [user, setUser] = useState<AppCoUser | null>(null);
  const [credHelperStatus, setCredHelperStatus] = useState<CredHelperStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Sync credentials to cluster and helm registry.
   * Creates the K8s imagePullSecret and logs into helm registry.
   */
  const syncCredentialsToClusterAndHelm = useCallback(async (username: string, token: string) => {
    // Sync to cluster - create imagePullSecret for Fleet
    try {
      await kubernetesService.createAppCoRegistrySecret(username, token);
      console.log('[useAppCoAuth] Created AppCo registry secret in cluster');
    } catch (err) {
      // Log but don't fail - cluster might not be ready yet
      console.warn('[useAppCoAuth] Failed to create cluster secret (cluster may not be ready):', err);
    }

    // Sync to helm - enable helm pull from OCI registry
    try {
      await credentialService.helmRegistryLoginAppCo(username, token);
      console.log('[useAppCoAuth] Logged into AppCo helm registry');
    } catch (err) {
      // Log but don't fail - helm registry login is nice-to-have
      console.warn('[useAppCoAuth] Failed to login to helm registry:', err);
    }
  }, [kubernetesService, credentialService]);

  /**
   * Clean up credentials from cluster and helm registry.
   */
  const cleanupCredentialsFromClusterAndHelm = useCallback(async () => {
    // Remove from cluster
    try {
      await kubernetesService.deleteAppCoRegistrySecret();
      console.log('[useAppCoAuth] Deleted AppCo registry secret from cluster');
    } catch (err) {
      console.warn('[useAppCoAuth] Failed to delete cluster secret:', err);
    }

    // Logout from helm
    try {
      await credentialService.helmRegistryLogoutAppCo();
      console.log('[useAppCoAuth] Logged out from AppCo helm registry');
    } catch (err) {
      console.warn('[useAppCoAuth] Failed to logout from helm registry:', err);
    }
  }, [kubernetesService, credentialService]);

  /**
   * Load initial state: check for stored credentials and validate.
   * Also performs credential recovery - syncing host credentials to cluster/helm
   * if they exist but cluster secret doesn't (e.g., after cluster reset).
   */
  const loadInitialState = useCallback(async () => {
    setAuthState('loading');
    setError(null);

    try {
      // Check credential helper availability
      const helperStatus = await credentialService.getCredHelperStatus();
      setCredHelperStatus(helperStatus);

      // Check for stored AppCo credentials
      const storedCred = await credentialService.getAppCoCredential();

      if (storedCred && storedCred.Username && storedCred.Secret) {
        // Validate stored credentials
        const validatedUser = await appCoService.validateCredentials(
          storedCred.Username,
          storedCred.Secret
        );

        if (validatedUser) {
          setUser(validatedUser);
          setAuthState('authenticated');

          // Credential recovery: sync to cluster/helm if needed
          // This handles cases where cluster was reset but host credentials still exist
          await syncCredentialsToClusterAndHelm(storedCred.Username, storedCred.Secret);

          return;
        } else {
          // Stored credentials are invalid, clear them and clean up
          console.log('[useAppCoAuth] Stored credentials invalid, clearing');
          await credentialService.deleteAppCoCredential();
          await cleanupCredentialsFromClusterAndHelm();
        }
      }

      setAuthState('unauthenticated');
    } catch (err) {
      console.error('[useAppCoAuth] Error loading initial state:', err);
      setError('Failed to load authentication status');
      setAuthState('error');
    }
  }, [credentialService, appCoService, syncCredentialsToClusterAndHelm, cleanupCredentialsFromClusterAndHelm]);

  useEffect(() => {
    loadInitialState();
  }, [loadInitialState]);

  /**
   * Handle credential submission
   */
  const handleSubmitCredentials = useCallback(async (username: string, token: string) => {
    if (!username.trim() || !token.trim()) {
      setError('Please enter both username and access token');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Validate credentials with AppCo API
      const validatedUser = await appCoService.validateCredentials(username.trim(), token.trim());

      if (!validatedUser) {
        setError('Invalid credentials. Please check your username and access token.');
        return;
      }

      // Check if credential helper is available
      if (!credHelperStatus?.available) {
        setError('No credential helper available. Please install docker-credential-secretservice or docker-credential-pass.');
        return;
      }

      const trimmedUsername = username.trim();
      const trimmedToken = token.trim();

      // Store credentials in host credential helper
      await credentialService.storeAppCoCredential(trimmedUsername, trimmedToken);

      // Sync to cluster (imagePullSecret) and helm registry
      await syncCredentialsToClusterAndHelm(trimmedUsername, trimmedToken);

      // Update state
      setUser(validatedUser);
      setAuthState('authenticated');
    } catch (err) {
      console.error('[useAppCoAuth] Error submitting credentials:', err);
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
    } finally {
      setIsLoading(false);
    }
  }, [appCoService, credentialService, credHelperStatus, syncCredentialsToClusterAndHelm]);

  /**
   * Handle disconnect
   */
  const handleDisconnect = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Delete stored credentials from host
      await credentialService.deleteAppCoCredential();

      // Clean up from cluster and helm
      await cleanupCredentialsFromClusterAndHelm();

      // Reset state
      setUser(null);
      setAuthState('unauthenticated');
    } catch (err) {
      console.error('[useAppCoAuth] Error disconnecting:', err);
      setError('Failed to disconnect');
    } finally {
      setIsLoading(false);
    }
  }, [credentialService, cleanupCredentialsFromClusterAndHelm]);

  return {
    authState,
    user,
    credHelperStatus,
    error,
    isLoading,
    handleSubmitCredentials,
    handleDisconnect,
    setError,
  };
}
