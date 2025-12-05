/**
 * GitHub Authentication Card Component.
 *
 * Provides UI for authenticating with GitHub via gh CLI or Personal Access Token.
 * Uses extracted sub-components and custom hook for better maintainability.
 * Supports collapsible mode with auto-collapse when authenticated.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import GitHubIcon from '@mui/icons-material/GitHub';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
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
import { useCollapsibleAuth } from './useCollapsibleAuth';

export const AuthGitHubCard: React.FC<CardProps<AuthCardSettings>> = ({
  definition,
  settings,
  editMode = false,
  onSettingsChange,
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
            <GitHubIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
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

  // Header component (shared between collapsed and expanded views)
  const renderHeader = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <GitHubIcon sx={{ verticalAlign: 'middle' }} />
      {definition.title && (
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {definition.title}
        </Typography>
      )}
      {authState === 'authenticated' && user && (
        <Chip
          icon={<CheckCircleIcon />}
          label={`@${user.login}`}
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
      </Collapse>
    </Box>
  );
};

// Register the auth-github card
registerCard('auth-github', AuthGitHubCard, {
  label: 'GitHub Authentication',
  orderable: true,
  category: 'auth',
  singleton: true,
  defaultSettings: () => ({ required: false, show_status: true, auto_collapse: false }),
});

export default AuthGitHubCard;
