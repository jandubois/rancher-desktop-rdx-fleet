import React, { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import GitHubIcon from '@mui/icons-material/GitHub';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import TerminalIcon from '@mui/icons-material/Terminal';
import KeyIcon from '@mui/icons-material/Key';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import { CardProps } from './types';
import { AuthCardSettings } from '../manifest/types';
import { registerCard } from './registry';
import { useCredentialService, useGitHubService } from '../context/ServiceContext';
import type { GitHubUser, GitHubRateLimit, GhAuthStatus, CredHelperStatus, AuthSource } from '../services';

/** GitHub token creation URL with recommended scopes */
const GITHUB_TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=repo,read:org&description=Fleet+Extension';

/** Auth state */
type AuthState = 'loading' | 'unauthenticated' | 'authenticated' | 'error';

export const AuthGitHubCard: React.FC<CardProps<AuthCardSettings>> = ({
  definition,
}) => {
  const credentialService = useCredentialService();
  const gitHubService = useGitHubService();

  // State
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [, setAuthSourceState] = useState<AuthSource>('none');
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [rateLimit, setRateLimit] = useState<GitHubRateLimit | null>(null);
  const [ghAuthStatus, setGhAuthStatus] = useState<GhAuthStatus | null>(null);
  const [credHelperStatus, setCredHelperStatus] = useState<CredHelperStatus | null>(null);
  const [patInput, setPatInput] = useState('');
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
            const validatedUser = await credentialService.validateGitHubToken(token);
            if (validatedUser) {
              setUser(validatedUser);
              setAuthState('authenticated');
              gitHubService.setAuthToken(token);
              const limit = await credentialService.getGitHubRateLimit(token);
              setRateLimit(limit);
              return;
            }
          }
        } catch {
          // gh CLI no longer works - clear preference
          console.log('[AuthGitHubCard] gh CLI auth failed, clearing preference');
        }
        // gh CLI auth failed - clear preference and fall through to unauthenticated
        await credentialService.setAuthSource('none');
        setAuthSourceState('none');
      } else if (source === 'pat') {
        // User has a stored PAT
        const storedToken = await credentialService.getStoredGitHubToken();
        if (storedToken) {
          const validatedUser = await credentialService.validateGitHubToken(storedToken);
          if (validatedUser) {
            setUser(validatedUser);
            setAuthState('authenticated');
            gitHubService.setAuthToken(storedToken);
            const limit = await credentialService.getGitHubRateLimit(storedToken);
            setRateLimit(limit);
            return;
          } else {
            // Token is invalid, clear it
            await credentialService.deleteGitHubToken();
          }
        }
      }

      // Fetch unauthenticated rate limit
      const limit = await credentialService.getGitHubRateLimit();
      setRateLimit(limit);

      setAuthState('unauthenticated');
    } catch (err) {
      console.error('[AuthGitHubCard] Error loading initial state:', err);
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
  const handleUseGhToken = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await credentialService.getGhToken();
      if (!token) {
        setError('Failed to get token from gh CLI');
        return;
      }

      // Validate the token
      const validatedUser = await credentialService.validateGitHubToken(token);
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
      const limit = await credentialService.getGitHubRateLimit(token);
      setRateLimit(limit);
    } catch (err: unknown) {
      console.error('[AuthGitHubCard] Error using gh token:', err);
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
  };

  /**
   * Handle PAT submission
   */
  const handleSubmitPat = async () => {
    if (!patInput.trim()) {
      setError('Please enter a token');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Validate the token
      const validatedUser = await credentialService.validateGitHubToken(patInput.trim());
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
      setPatInput('');
      gitHubService.setAuthToken(patInput.trim());

      // Fetch rate limit
      const limit = await credentialService.getGitHubRateLimit(patInput.trim());
      setRateLimit(limit);
    } catch (err) {
      console.error('[AuthGitHubCard] Error submitting PAT:', err);
      setError(err instanceof Error ? err.message : 'Failed to save token');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle disconnect
   */
  const handleDisconnect = async () => {
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
      const limit = await credentialService.getGitHubRateLimit();
      setRateLimit(limit);
    } catch (err) {
      console.error('[AuthGitHubCard] Error disconnecting:', err);
      setError('Failed to disconnect');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Refresh rate limit - called manually via button
   */
  const refreshRateLimit = useCallback(async () => {
    try {
      // Get token from gitHubService if authenticated
      const token = gitHubService.getAuthToken();
      const limit = await credentialService.getGitHubRateLimit(token ?? undefined);
      setRateLimit(limit);
    } catch (err) {
      console.error('[AuthGitHubCard] Error refreshing rate limit:', err);
    }
  }, [credentialService, gitHubService]);

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

  /**
   * Format rate limit reset time
   */
  const formatResetTime = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleTimeString();
  };

  // Loading state
  if (authState === 'loading') {
    return (
      <Box>
        {definition.title && (
          <Typography variant="h6" gutterBottom>
            <GitHubIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            {definition.title}
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2 }}>
          <CircularProgress size={20} />
          <Typography color="text.secondary">Loading authentication status...</Typography>
        </Box>
      </Box>
    );
  }

  // Authenticated state
  if (authState === 'authenticated' && user) {
    return (
      <Box>
        {definition.title && (
          <Typography variant="h6" gutterBottom>
            <GitHubIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            {definition.title}
          </Typography>
        )}

        <Alert
          severity="success"
          icon={<CheckCircleIcon />}
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={handleDisconnect}
              disabled={isLoading}
            >
              Disconnect
            </Button>
          }
        >
          Authenticated as <strong>@{user.login}</strong>
          {user.name && ` (${user.name})`}
        </Alert>

        {rateLimit && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
            <Typography variant="body2">
              API Rate Limit: {rateLimit.remaining.toLocaleString()} / {rateLimit.limit.toLocaleString()} remaining
            </Typography>
            <Tooltip title="Refresh rate limit">
              <IconButton size="small" onClick={refreshRateLimit} sx={{ p: 0.5 }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {rateLimit.remaining < 100 && (
              <Chip
                label={`Resets at ${formatResetTime(rateLimit.reset)}`}
                size="small"
                color="warning"
              />
            )}
          </Box>
        )}
      </Box>
    );
  }

  // Unauthenticated state
  return (
    <Box>
      {definition.title && (
        <Typography variant="h6" gutterBottom>
          <GitHubIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          {definition.title}
        </Typography>
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Authenticate to increase API rate limits (60 → 5,000/hour) and access private repositories.
      </Typography>

      {error && (
        <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Credential helper warning */}
      {credHelperStatus && !credHelperStatus.available && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            No credential helper configured. To securely store credentials, install a Docker credential helper.
          </Typography>
          {credHelperStatus.debug && (
            <Box
              component="pre"
              sx={{
                fontSize: '0.75rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                bgcolor: 'rgba(0,0,0,0.1)',
                p: 1,
                borderRadius: 1,
                mt: 1,
                maxHeight: 200,
                overflow: 'auto',
              }}
            >
              {credHelperStatus.debug}
            </Box>
          )}
        </Alert>
      )}

      {/* gh CLI status debug info */}
      {ghAuthStatus && (!ghAuthStatus.installed || !ghAuthStatus.authenticated) && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            gh CLI: {ghAuthStatus.installed ? 'installed' : 'not found'}
            {ghAuthStatus.installed && !ghAuthStatus.authenticated && ' (not authenticated)'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            To use gh CLI token: install gh CLI and run `gh auth login`
          </Typography>
          {ghAuthStatus.debug && (
            <Box
              component="pre"
              sx={{
                fontSize: '0.75rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                bgcolor: 'rgba(0,0,0,0.1)',
                p: 1,
                borderRadius: 1,
                mt: 1,
                maxHeight: 200,
                overflow: 'auto',
              }}
            >
              {ghAuthStatus.debug}
            </Box>
          )}
        </Alert>
      )}

      {/* gh CLI option */}
      {ghAuthStatus?.installed && ghAuthStatus?.authenticated && (
        <>
          <Box
            sx={{
              p: 2,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              mb: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <TerminalIcon color="primary" />
              <Typography variant="subtitle2">Use gh CLI Token</Typography>
              <Chip label="Recommended" size="small" color="success" />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Use your existing gh CLI authentication{ghAuthStatus.user && ` (logged in as @${ghAuthStatus.user})`}
            </Typography>
            <Button
              variant="contained"
              startIcon={<TerminalIcon />}
              onClick={handleUseGhToken}
              disabled={isLoading}
              size="small"
            >
              {isLoading ? 'Connecting...' : 'Use gh CLI Token'}
            </Button>
          </Box>

          <Divider sx={{ my: 2 }}>
            <Typography variant="caption" color="text.secondary">
              OR
            </Typography>
          </Divider>
        </>
      )}

      {/* PAT input */}
      <Box
        sx={{
          p: 2,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <KeyIcon color="primary" />
          <Typography variant="subtitle2">Personal Access Token</Typography>
        </Box>

        <TextField
          fullWidth
          type="password"
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          value={patInput}
          onChange={(e) => setPatInput(e.target.value)}
          size="small"
          sx={{ mb: 1.5 }}
          disabled={isLoading || !credHelperStatus?.available}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSubmitPat();
            }
          }}
        />

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Recommended scopes: <code>public_repo</code> (rate limits) or <code>repo</code> (private repos), <code>read:org</code>
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            variant="contained"
            onClick={handleSubmitPat}
            disabled={isLoading || !patInput.trim() || !credHelperStatus?.available}
            size="small"
          >
            {isLoading ? 'Saving...' : 'Save Token'}
          </Button>

          <Link
            href={GITHUB_TOKEN_URL}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <Typography variant="body2">Create token on GitHub</Typography>
            <OpenInNewIcon fontSize="small" />
          </Link>
        </Box>
      </Box>

      {/* Unauthenticated rate limit info */}
      {rateLimit && (
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
          <Typography variant="body2">
            API Rate Limit: {rateLimit.remaining.toLocaleString()} / {rateLimit.limit.toLocaleString()} remaining (unauthenticated)
          </Typography>
          <Tooltip title="Refresh rate limit">
            <IconButton size="small" onClick={refreshRateLimit} sx={{ p: 0.5 }}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {rateLimit.remaining < 10 && (
            <Chip
              label={`Resets at ${formatResetTime(rateLimit.reset)}`}
              size="small"
              color="warning"
            />
          )}
        </Box>
      )}
    </Box>
  );
};

// Register the auth-github card
registerCard('auth-github', AuthGitHubCard, {
  label: 'GitHub Auth',
  orderable: true,
  category: 'auth',
  defaultSettings: () => ({ required: false, show_status: true }),
});

export default AuthGitHubCard;
