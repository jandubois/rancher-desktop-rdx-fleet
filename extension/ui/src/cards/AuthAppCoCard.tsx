/**
 * AppCo (SUSE Application Collection) Authentication Card Component.
 *
 * Provides UI for authenticating with AppCo to access the application catalog
 * and pull Helm charts/container images from dp.apps.rancher.io.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { CardProps } from './types';
import { AppCoCardSettings } from '../manifest/types';
import { registerCard } from './registry';
import { CredentialHelperWarning } from './AuthGitHubCard/StatusAlerts';
import { useAppCoAuth, AppCoInputForm } from './AuthAppCoCard/index';

/** AppCo catalog URL */
const APPCO_CATALOG_URL = 'https://apps.rancher.io';

export const AuthAppCoCard: React.FC<CardProps<AppCoCardSettings>> = ({
  definition,
}) => {
  const {
    authState,
    user,
    credHelperStatus,
    error,
    isLoading,
    handleSubmitCredentials,
    handleDisconnect,
    setError,
  } = useAppCoAuth();

  // Loading state
  if (authState === 'loading') {
    return (
      <Box>
        {definition.title && (
          <Typography variant="h6" gutterBottom>
            <StorefrontIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
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
            <StorefrontIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
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
          <Box>
            <Typography variant="body2">
              Authenticated as <strong>{user.username}</strong>
              {user.email && user.email !== user.username && (
                <Typography component="span" color="text.secondary">
                  {' '}({user.email})
                </Typography>
              )}
            </Typography>
            {user.accountType && (
              <Typography variant="caption" color="text.secondary">
                Account type: {user.accountType}
              </Typography>
            )}
          </Box>
        </Alert>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          You can now pull Helm charts and container images from <code>dp.apps.rancher.io</code>
        </Typography>

        <Link
          href={APPCO_CATALOG_URL}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
        >
          <Typography variant="body2">Browse Application Catalog</Typography>
          <OpenInNewIcon fontSize="small" />
        </Link>
      </Box>
    );
  }

  // Unauthenticated state
  return (
    <Box>
      {definition.title && (
        <Typography variant="h6" gutterBottom>
          <StorefrontIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          {definition.title}
        </Typography>
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Authenticate with SUSE Application Collection to access Helm charts and container images.
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

      {/* Credential input form */}
      <AppCoInputForm
        onSubmit={handleSubmitCredentials}
        isLoading={isLoading}
        disabled={!credHelperStatus?.available}
      />
    </Box>
  );
};

// Register the auth-appco card
registerCard('auth-appco', AuthAppCoCard, {
  label: 'SUSE Application Collection Authentication',
  orderable: true,
  category: 'auth',
  singleton: true,
  defaultSettings: () => ({ required: false, show_status: true } as AppCoCardSettings),
});

export default AuthAppCoCard;
