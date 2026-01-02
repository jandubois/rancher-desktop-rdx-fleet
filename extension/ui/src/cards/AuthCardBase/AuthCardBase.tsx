/**
 * Base Auth Card Component.
 *
 * Provides shared structure for authentication cards (GitHub, AppCo, etc.).
 * Handles the common patterns: collapsible header, edit mode settings, loading state.
 */

import React, { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { CardDefinition } from '../../manifest';
import { useCollapsibleAuth, AuthState } from '../useCollapsibleAuth';
import type { CredHelperStatus } from '../../services/CredentialService';

export interface AuthCardBaseProps {
  /** Card definition with id, title, etc. */
  definition: CardDefinition;
  /** Whether edit mode is active */
  editMode?: boolean;
  /** Current auto_collapse setting value */
  autoCollapse: boolean;
  /** Callback when auto_collapse setting changes */
  onAutoCollapseChange?: (checked: boolean) => void;

  // Auth state from the provider-specific hook
  /** Current authentication state */
  authState: AuthState;
  /** Error message to display */
  error: string | null;
  /** Whether an auth operation is in progress */
  isLoading: boolean;
  /** Credential helper status */
  credHelperStatus: CredHelperStatus | null;
  /** Clear the error */
  setError: (error: string | null) => void;
  /** Disconnect/logout handler */
  onDisconnect: () => Promise<void>;

  // Customization slots
  /** Icon to show in the header */
  icon: ReactNode;
  /** Provider name for loading text */
  providerName: string;
  /** Chip content when authenticated (e.g., "@username") */
  userChipLabel: string | null;
  /** Content to show when authenticated (below the success alert) */
  authenticatedContent?: ReactNode;
  /** Custom content for the authenticated alert (defaults to "Authenticated as {userChipLabel}") */
  authenticatedAlertContent?: ReactNode;
  /** Content to show when unauthenticated (the auth form) */
  unauthenticatedContent: ReactNode;
  /** Description text for unauthenticated state */
  unauthenticatedDescription: string;
  /** Optional credential helper warning component */
  credentialHelperWarning?: ReactNode;
}

/**
 * Base component for auth cards.
 * Handles: collapsible behavior, edit mode settings, loading state, error display.
 */
export const AuthCardBase: React.FC<AuthCardBaseProps> = ({
  definition,
  editMode = false,
  autoCollapse,
  onAutoCollapseChange,
  authState,
  error,
  isLoading,
  setError,
  onDisconnect,
  icon,
  providerName,
  userChipLabel,
  authenticatedContent,
  authenticatedAlertContent,
  unauthenticatedContent,
  unauthenticatedDescription,
  credentialHelperWarning,
}) => {
  const { isCollapsed, toggleCollapse } = useCollapsibleAuth({
    cardId: definition.id,
    authState,
    autoCollapse,
    error,
  });

  // Edit mode settings UI
  if (editMode && onAutoCollapseChange) {
    return (
      <Box>
        {definition.title && (
          <Typography variant="h6" gutterBottom>
            <Box component="span" sx={{ mr: 1, verticalAlign: 'middle', display: 'inline-flex' }}>
              {icon}
            </Box>
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
                onChange={(e) => onAutoCollapseChange(e.target.checked)}
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
            <Box component="span" sx={{ mr: 1, verticalAlign: 'middle', display: 'inline-flex' }}>
              {icon}
            </Box>
            {definition.title}
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2 }}>
          <CircularProgress size={20} />
          <Typography color="text.secondary">Loading {providerName} authentication status...</Typography>
        </Box>
      </Box>
    );
  }

  // Header component (shared between collapsed and expanded views)
  const renderHeader = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
        {icon}
      </Box>
      {definition.title && (
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {definition.title}
        </Typography>
      )}
      {authState === 'authenticated' && userChipLabel && (
        <Chip
          icon={<CheckCircleIcon />}
          label={userChipLabel}
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
  if (authState === 'authenticated') {
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
                  onClick={onDisconnect}
                  disabled={isLoading}
                >
                  Disconnect
                </Button>
              }
            >
              {authenticatedAlertContent ?? <>Authenticated as <strong>{userChipLabel}</strong></>}
            </Alert>

            {authenticatedContent}
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
            {unauthenticatedDescription}
          </Typography>

          {error && (
            <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {credentialHelperWarning}

          {unauthenticatedContent}
        </Box>
      </Collapse>
    </Box>
  );
};

export default AuthCardBase;
