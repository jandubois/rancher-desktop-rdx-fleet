/**
 * Status alert components for AuthGitHubCard.
 *
 * Shows warnings and info about credential helper and gh CLI status.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import type { GhAuthStatus, CredHelperStatus } from '../../services';

interface DebugBoxProps {
  debug: string;
}

const DebugBox: React.FC<DebugBoxProps> = ({ debug }) => (
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
    {debug}
  </Box>
);

interface CredentialHelperWarningProps {
  credHelperStatus: CredHelperStatus;
}

export const CredentialHelperWarning: React.FC<CredentialHelperWarningProps> = ({
  credHelperStatus,
}) => {
  if (credHelperStatus.available) {
    return null;
  }

  return (
    <Alert severity="warning" sx={{ mb: 2 }}>
      <Typography variant="body2" sx={{ mb: 1 }}>
        No credential helper configured. To securely store credentials, install a Docker credential helper.
      </Typography>
      {credHelperStatus.debug && <DebugBox debug={credHelperStatus.debug} />}
    </Alert>
  );
};

interface GhCliStatusInfoProps {
  ghAuthStatus: GhAuthStatus;
}

export const GhCliStatusInfo: React.FC<GhCliStatusInfoProps> = ({
  ghAuthStatus,
}) => {
  // Only show when gh CLI is not installed or not authenticated
  if (ghAuthStatus.installed && ghAuthStatus.authenticated) {
    return null;
  }

  return (
    <Alert severity="info" sx={{ mb: 2 }}>
      <Typography variant="body2" sx={{ mb: 1 }}>
        gh CLI: {ghAuthStatus.installed ? 'installed' : 'not found'}
        {ghAuthStatus.installed && !ghAuthStatus.authenticated && ' (not authenticated)'}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        To use gh CLI token: install gh CLI and run `gh auth login`
      </Typography>
      {ghAuthStatus.debug && <DebugBox debug={ghAuthStatus.debug} />}
    </Alert>
  );
};
