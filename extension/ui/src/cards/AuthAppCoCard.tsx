/**
 * AppCo (SUSE Application Collection) Authentication Card Component.
 *
 * Provides UI for authenticating with AppCo to access the application catalog
 * and pull Helm charts/container images from dp.apps.rancher.io.
 * Supports collapsible mode with auto-collapse when authenticated.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { SuseGeekoIcon } from '../components/icons/SuseGeekoIcon';
import { CardProps } from './types';
import { AppCoCardSettings } from '../manifest/types';
import { registerCard } from './registry';
import { CredentialHelperWarning } from './AuthGitHubCard/StatusAlerts';
import { useAppCoAuth, AppCoInputForm } from './AuthAppCoCard/index';
import { useCollapsibleAuth } from './useCollapsibleAuth';

/** AppCo catalog URL */
const APPCO_CATALOG_URL = 'https://apps.rancher.io';

export const AuthAppCoCard: React.FC<CardProps<AppCoCardSettings>> = ({
  definition,
  settings,
  editMode = false,
  onSettingsChange,
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

  const autoCollapse = settings?.auto_collapse ?? false;

  const { isCollapsed, toggleCollapse } = useCollapsibleAuth({
    cardId: definition.id,
    authState,
    autoCollapse,
    error,
  });

  // Handle auto_collapse setting change in edit mode
  const handleAutoCollapseChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (onSettingsChange) {
      onSettingsChange({
        ...settings,
        auto_collapse: event.target.checked,
      });
    }
  };

  // Edit mode settings UI
  if (editMode && onSettingsChange) {
    return (
      <Box>
        {definition.title && (
          <Typography variant="h6" gutterBottom>
            <SuseGeekoIcon sx={{ mr: 1, verticalAlign: 'middle', height: '1.25em', width: 'auto' }} />
            {definition.title}
          </Typography>
        )}

        <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Card Settings
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={autoCollapse}
                onChange={handleAutoCollapseChange}
                size="small"
              />
            }
            label={
              <Typography variant="body2">
                Auto-collapse when authenticated
              </Typography>
            }
          />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, ml: 4.5 }}>
            When enabled, the card will collapse after successful authentication.
            Users can expand it to disconnect or change credentials.
          </Typography>
        </Box>
      </Box>
    );
  }

  // Loading state
  if (authState === 'loading') {
    return (
      <Box>
        {definition.title && (
          <Typography variant="h6" gutterBottom>
            <SuseGeekoIcon sx={{ mr: 1, verticalAlign: 'middle', height: '1.25em', width: 'auto' }} />
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

  // Header component (shared between collapsed and expanded views)
  const renderHeader = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <SuseGeekoIcon sx={{ verticalAlign: 'middle', height: '1.25em', width: 'auto' }} />
      {definition.title && (
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {definition.title}
        </Typography>
      )}
      {authState === 'authenticated' && user && (
        <Chip
          icon={<CheckCircleIcon />}
          label={user.username}
          color="success"
          size="small"
          variant="outlined"
        />
      )}
      {authState === 'unauthenticated' && (
        <Chip
          label="Not authenticated"
          size="small"
          variant="outlined"
          color="default"
        />
      )}
      <IconButton size="small" onClick={toggleCollapse}>
        {isCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
      </IconButton>
    </Box>
  );

  // Authenticated state
  if (authState === 'authenticated' && user) {
    return (
      <Box>
        {renderHeader()}

        <Collapse in={!isCollapsed}>
          <Box sx={{ mt: 2 }}>
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
        </Collapse>
      </Box>
    );
  }

  // Unauthenticated state
  return (
    <Box>
      {renderHeader()}

      <Collapse in={!isCollapsed}>
        <Box sx={{ mt: 2 }}>
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
      </Collapse>
    </Box>
  );
};

// Register the auth-appco card
registerCard('auth-appco', AuthAppCoCard, {
  label: 'SUSE Application Collection Authentication',
  orderable: true,
  category: 'auth',
  singleton: true,
  defaultSettings: () => ({ required: false, show_status: true, auto_collapse: false } as AppCoCardSettings),
});

export default AuthAppCoCard;
