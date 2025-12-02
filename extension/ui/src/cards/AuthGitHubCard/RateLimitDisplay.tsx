/**
 * Rate limit display component.
 *
 * Shows GitHub API rate limit information with refresh button and warning chip.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { GitHubRateLimit } from '../../services';

interface RateLimitDisplayProps {
  rateLimit: GitHubRateLimit;
  onRefresh: () => void;
  /** Warning threshold - shows warning chip when remaining is below this */
  warningThreshold?: number;
  /** Label to show after the rate limit (e.g., "unauthenticated") */
  suffix?: string;
}

/**
 * Format rate limit reset time
 */
function formatResetTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString();
}

export const RateLimitDisplay: React.FC<RateLimitDisplayProps> = ({
  rateLimit,
  onRefresh,
  warningThreshold = 100,
  suffix,
}) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
      <Typography variant="body2">
        API Rate Limit: {rateLimit.remaining.toLocaleString()} / {rateLimit.limit.toLocaleString()} remaining
        {suffix && ` (${suffix})`}
      </Typography>
      <Tooltip title="Refresh rate limit">
        <IconButton size="small" onClick={onRefresh} sx={{ p: 0.5 }}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {rateLimit.remaining < warningThreshold && (
        <Chip
          label={`Resets at ${formatResetTime(rateLimit.reset)}`}
          size="small"
          color="warning"
        />
      )}
    </Box>
  );
};

export default RateLimitDisplay;
