/**
 * GitHub CLI authentication option component.
 *
 * Shows the gh CLI authentication option when available.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TerminalIcon from '@mui/icons-material/Terminal';
import type { GhAuthStatus } from '../../services';

interface GhCliAuthOptionProps {
  ghAuthStatus: GhAuthStatus;
  onUseGhToken: () => void;
  isLoading: boolean;
}

export const GhCliAuthOption: React.FC<GhCliAuthOptionProps> = ({
  ghAuthStatus,
  onUseGhToken,
  isLoading,
}) => {
  return (
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
        onClick={onUseGhToken}
        disabled={isLoading}
        size="small"
      >
        {isLoading ? 'Connecting...' : 'Use gh CLI Token'}
      </Button>
    </Box>
  );
};

export default GhCliAuthOption;
