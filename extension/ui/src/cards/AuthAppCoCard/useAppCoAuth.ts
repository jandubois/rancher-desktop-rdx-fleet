/**
 * Custom hook for AppCo (SUSE Application Collection) authentication state management.
 *
 * Handles credential storage, validation, and UI state for the AppCo auth card.
 */

import { useState, useCallback, useEffect } from 'react';
import { useCredentialService, useAppCoService } from '../../context/ServiceContext';
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

  // State
  const [authState, setAuthState] = useState<AppCoAuthState>('loading');
  const [user, setUser] = useState<AppCoUser | null>(null);
  const [credHelperStatus, setCredHelperStatus] = useState<CredHelperStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Load initial state: check for stored credentials and validate
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
          return;
        } else {
          // Stored credentials are invalid, clear them
          console.log('[useAppCoAuth] Stored credentials invalid, clearing');
          await credentialService.deleteAppCoCredential();
        }
      }

      setAuthState('unauthenticated');
    } catch (err) {
      console.error('[useAppCoAuth] Error loading initial state:', err);
      setError('Failed to load authentication status');
      setAuthState('error');
    }
  }, [credentialService, appCoService]);

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

      // Store credentials
      await credentialService.storeAppCoCredential(username.trim(), token.trim());

      // Update state
      setUser(validatedUser);
      setAuthState('authenticated');
    } catch (err) {
      console.error('[useAppCoAuth] Error submitting credentials:', err);
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
    } finally {
      setIsLoading(false);
    }
  }, [appCoService, credentialService, credHelperStatus]);

  /**
   * Handle disconnect
   */
  const handleDisconnect = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Delete stored credentials
      await credentialService.deleteAppCoCredential();

      // Reset state
      setUser(null);
      setAuthState('unauthenticated');
    } catch (err) {
      console.error('[useAppCoAuth] Error disconnecting:', err);
      setError('Failed to disconnect');
    } finally {
      setIsLoading(false);
    }
  }, [credentialService]);

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
