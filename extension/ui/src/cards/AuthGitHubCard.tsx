/**
 * GitHub Authentication Card Component.
 *
 * Provides UI for authenticating with GitHub via gh CLI or Personal Access Token.
 * Uses extracted sub-components and custom hook for better maintainability.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import GitHubIcon from '@mui/icons-material/GitHub';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { CardProps } from './types';
import { AuthCardSettings } from '../manifest/types';
import { registerCard } from './registry';
import {
  useGitHubAuth,
  RateLimitDisplay,
  GhCliAuthOption,
  PatInputForm,
  CredentialHelperWarning,
  GhCliStatusInfo,
} from './AuthGitHubCard/index';

export const AuthGitHubCard: React.FC<CardProps<AuthCardSettings>> = ({
  definition,
}) => {
  const {
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
  } = useGitHubAuth();

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
          <RateLimitDisplay
            rateLimit={rateLimit}
            onRefresh={refreshRateLimit}
            warningThreshold={100}
          />
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
      {credHelperStatus && (
        <CredentialHelperWarning credHelperStatus={credHelperStatus} />
      )}

      {/* gh CLI status info */}
      {ghAuthStatus && (
        <GhCliStatusInfo ghAuthStatus={ghAuthStatus} />
      )}

      {/* gh CLI option */}
      {ghAuthStatus?.installed && ghAuthStatus?.authenticated && (
        <>
          <GhCliAuthOption
            ghAuthStatus={ghAuthStatus}
            onUseGhToken={handleUseGhToken}
            isLoading={isLoading}
          />

          <Divider sx={{ my: 2 }}>
            <Typography variant="caption" color="text.secondary">
              OR
            </Typography>
          </Divider>
        </>
      )}

      {/* PAT input */}
      <PatInputForm
        onSubmit={handleSubmitPat}
        isLoading={isLoading}
        disabled={!credHelperStatus?.available}
      />

      {/* Unauthenticated rate limit info */}
      {rateLimit && (
        <Box sx={{ mt: 2 }}>
          <RateLimitDisplay
            rateLimit={rateLimit}
            onRefresh={refreshRateLimit}
            warningThreshold={10}
            suffix="unauthenticated"
          />
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
  singleton: true,
  defaultSettings: () => ({ required: false, show_status: true }),
});

export default AuthGitHubCard;
