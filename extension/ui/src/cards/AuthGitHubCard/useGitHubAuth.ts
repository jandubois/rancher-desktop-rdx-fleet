/**
 * Custom hook for GitHub authentication state management.
 *
 * Extracts all the auth state logic from AuthGitHubCard for better
 * maintainability and testability.
 */

import { useState, useCallback, useEffect } from 'react';
import { useCredentialService, useGitHubService } from '../../context/ServiceContext';
import type { GitHubUser, GitHubRateLimit, GhAuthStatus, CredHelperStatus, AuthSource } from '../../services';

/** Auth state */
export type AuthState = 'loading' | 'unauthenticated' | 'authenticated' | 'error';

export interface UseGitHubAuthResult {
  // State
  authState: AuthState;
  user: GitHubUser | null;
  rateLimit: GitHubRateLimit | null;
  ghAuthStatus: GhAuthStatus | null;
  credHelperStatus: CredHelperStatus | null;
  error: string | null;
  isLoading: boolean;

  // Actions
  handleUseGhToken: () => Promise<void>;
  handleSubmitPat: (token: string) => Promise<void>;
  handleDisconnect: () => Promise<void>;
  refreshRateLimit: () => Promise<void>;
  setError: (error: string | null) => void;
}

export function useGitHubAuth(): UseGitHubAuthResult {
  const credentialService = useCredentialService();
  const gitHubService = useGitHubService();

  // State
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [, setAuthSourceState] = useState<AuthSource>('none');
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [rateLimit, setRateLimit] = useState<GitHubRateLimit | null>(null);
  const [ghAuthStatus, setGhAuthStatus] = useState<GhAuthStatus | null>(null);
  const [credHelperStatus, setCredHelperStatus] = useState<CredHelperStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Load initial state: check auth preference and validate
   */
  const loadInitialState = useCallback(async () => {
    setAuthState('loading');
    setError(null);

    try {
      // Check credential helper availability
      const helperStatus = await credentialService.getCredHelperStatus();
      setCredHelperStatus(helperStatus);

      // Check gh CLI status
      const ghStatus = await credentialService.getGhAuthStatus();
      setGhAuthStatus(ghStatus);

      // Check auth source preference
      const { source } = await credentialService.getAuthSource();
      setAuthSourceState(source);

      if (source === 'gh-cli') {
        // User previously authorized gh CLI - try to get fresh token
        try {
          const token = await credentialService.getGhToken();
          if (token) {
            const validatedUser = await gitHubService.validateGitHubToken(token);
            if (validatedUser) {
              setUser(validatedUser);
              setAuthState('authenticated');
              gitHubService.setAuthToken(token);
              const limit = await gitHubService.getRateLimit(token);
              setRateLimit(limit);
              return;
            }
          }
        } catch {
          // gh CLI no longer works - clear preference
          console.log('[useGitHubAuth] gh CLI auth failed, clearing preference');
        }
        // gh CLI auth failed - clear preference and fall through to unauthenticated
        await credentialService.setAuthSource('none');
        setAuthSourceState('none');
      } else if (source === 'pat') {
        // User has a stored PAT
        const storedToken = await credentialService.getStoredGitHubToken();
        if (storedToken) {
          const validatedUser = await gitHubService.validateGitHubToken(storedToken);
          if (validatedUser) {
            setUser(validatedUser);
            setAuthState('authenticated');
            gitHubService.setAuthToken(storedToken);
            const limit = await gitHubService.getRateLimit(storedToken);
            setRateLimit(limit);
            return;
          } else {
            // Token is invalid, clear it
            await credentialService.deleteGitHubToken();
          }
        }
      }

      // Fetch unauthenticated rate limit
      const limit = await gitHubService.getRateLimit();
      setRateLimit(limit);

      setAuthState('unauthenticated');
    } catch (err) {
      console.error('[useGitHubAuth] Error loading initial state:', err);
      setError('Failed to load authentication status');
      setAuthState('error');
    }
  }, [credentialService, gitHubService]);

  useEffect(() => {
    loadInitialState();
  }, [loadInitialState]);

  /**
   * Handle using gh CLI token
   */
  const handleUseGhToken = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await credentialService.getGhToken();
      if (!token) {
        setError('Failed to get token from gh CLI');
        return;
      }

      // Validate the token
      const validatedUser = await gitHubService.validateGitHubToken(token);
      if (!validatedUser) {
        setError('Token validation failed');
        return;
      }

      // Store preference to use gh CLI (not the token itself - fetched fresh each time)
      await credentialService.setAuthSource('gh-cli', validatedUser.login);
      setAuthSourceState('gh-cli');

      // Update state
      setUser(validatedUser);
      setAuthState('authenticated');
      gitHubService.setAuthToken(token);

      // Fetch rate limit
      const limit = await gitHubService.getRateLimit(token);
      setRateLimit(limit);
    } catch (err: unknown) {
      console.error('[useGitHubAuth] Error using gh token:', err);
      // Extract error message - handle various error object shapes
      let errorMsg = 'Failed to authenticate with gh CLI';
      if (err instanceof Error) {
        errorMsg = err.message;
      } else if (err && typeof err === 'object') {
        const errObj = err as Record<string, unknown>;
        errorMsg = String(errObj.message || errObj.error || JSON.stringify(err));
      } else if (err) {
        errorMsg = String(err);
      }
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [credentialService, gitHubService]);

  /**
   * Handle PAT submission
   */
  const handleSubmitPat = useCallback(async (patInput: string) => {
    if (!patInput.trim()) {
      setError('Please enter a token');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Validate the token
      const validatedUser = await gitHubService.validateGitHubToken(patInput.trim());
      if (!validatedUser) {
        setError('Invalid token. Please check and try again.');
        return;
      }

      // Check if credential helper is available
      if (!credHelperStatus?.available) {
        setError('No credential helper available. Please install docker-credential-secretservice or docker-credential-pass.');
        return;
      }

      // Store the token (PATs are stored, unlike gh CLI tokens)
      await credentialService.storeGitHubToken(patInput.trim(), validatedUser.login);

      // Update state
      setAuthSourceState('pat');
      setUser(validatedUser);
      setAuthState('authenticated');
      gitHubService.setAuthToken(patInput.trim());

      // Fetch rate limit
      const limit = await gitHubService.getRateLimit(patInput.trim());
      setRateLimit(limit);
    } catch (err) {
      console.error('[useGitHubAuth] Error submitting PAT:', err);
      setError(err instanceof Error ? err.message : 'Failed to save token');
    } finally {
      setIsLoading(false);
    }
  }, [credentialService, credHelperStatus, gitHubService]);

  /**
   * Handle disconnect
   */
  const handleDisconnect = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Clear auth source preference (also deletes any stored PAT)
      await credentialService.setAuthSource('none');
      setAuthSourceState('none');
      setUser(null);
      setAuthState('unauthenticated');
      gitHubService.setAuthToken(null);

      // Fetch unauthenticated rate limit
      const limit = await gitHubService.getRateLimit();
      setRateLimit(limit);
    } catch (err) {
      console.error('[useGitHubAuth] Error disconnecting:', err);
      setError('Failed to disconnect');
    } finally {
      setIsLoading(false);
    }
  }, [credentialService, gitHubService]);

  /**
   * Refresh rate limit - called manually via button
   */
  const refreshRateLimit = useCallback(async () => {
    try {
      // Get token from gitHubService if authenticated
      const token = gitHubService.getAuthToken();
      const limit = await gitHubService.getRateLimit(token ?? undefined);
      setRateLimit(limit);
    } catch (err) {
      console.error('[useGitHubAuth] Error refreshing rate limit:', err);
    }
  }, [gitHubService]);

  // Register rate limit callback on GitHubService to get live updates from API responses
  useEffect(() => {
    gitHubService.setRateLimitCallback((rateLimitInfo) => {
      setRateLimit({
        limit: rateLimitInfo.limit,
        remaining: rateLimitInfo.remaining,
        reset: rateLimitInfo.reset,
      });
    });

    // Clean up callback on unmount
    return () => {
      gitHubService.setRateLimitCallback(null);
    };
  }, [gitHubService]);

  return {
    authState,
    user,
    rateLimit,
    ghAuthStatus,
    credHelperStatus,
    error,
    isLoading,
    handleUseGhToken,
    handleSubmitPat,
    handleDisconnect,
    refreshRateLimit,
    setError,
  };
}
