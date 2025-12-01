/**
 * BackendStatusCard - Debug component for backend service status.
 *
 * Shows:
 * - Connection status
 * - Container ID and extension identity
 * - Health check results
 * - Ownership status (when available)
 *
 * This is primarily for debugging during development.
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CircularProgress from '@mui/material/CircularProgress';
import { useState } from 'react';

import { BackendStatus } from '../services/BackendService';

export interface BackendStatusCardProps {
  /** Current backend status */
  status: BackendStatus | null;
  /** Whether currently loading */
  loading: boolean;
  /** Callback to refresh status */
  onRefresh: () => void;
}

/** Format uptime in human-readable form */
function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

/**
 * Debug card showing backend service status.
 */
export function BackendStatusCard({ status, loading, onRefresh }: BackendStatusCardProps) {
  const [expanded, setExpanded] = useState(true);

  const connected = status?.connected ?? false;
  const health = status?.health;
  const identity = status?.identity;

  return (
    <Paper
      sx={{
        p: 2,
        mb: 2,
        border: '1px solid',
        borderColor: connected ? 'success.main' : 'error.main',
        opacity: 0.9,
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {loading ? (
          <CircularProgress size={20} />
        ) : connected ? (
          <CheckCircleIcon color="success" fontSize="small" />
        ) : (
          <ErrorIcon color="error" fontSize="small" />
        )}

        <Typography variant="subtitle2" sx={{ flexGrow: 1, fontFamily: 'monospace' }}>
          Backend Service
        </Typography>

        <Chip
          size="small"
          label={connected ? 'Connected' : 'Disconnected'}
          color={connected ? 'success' : 'error'}
          variant="outlined"
        />

        <IconButton size="small" onClick={onRefresh} disabled={loading}>
          <RefreshIcon fontSize="small" />
        </IconButton>

        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Expandable details */}
      <Collapse in={expanded}>
        <Box sx={{ mt: 2, fontFamily: 'monospace', fontSize: '0.75rem' }}>
          {/* Error message */}
          {status?.error && (
            <Box sx={{ color: 'error.main', mb: 1 }}>
              Error: {status.error}
            </Box>
          )}

          {/* Identity info */}
          {identity && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Identity
              </Typography>
              <Box component="pre" sx={{ m: 0, fontSize: 'inherit' }}>
{`Container ID: ${identity.containerId}
Extension:   ${identity.extensionName} (${identity.extensionType})
Version:     ${identity.version}
Started:     ${identity.startedAt}`}
              </Box>
            </Box>
          )}

          {/* Health info */}
          {health && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Health
              </Typography>
              <Box component="pre" sx={{ m: 0, fontSize: 'inherit' }}>
{`Status:    ${health.status}
Uptime:    ${formatUptime(health.uptime)}
Timestamp: ${health.timestamp}
Checks:    ${health.checks.map(c => `${c.name}: ${c.status}`).join(', ')}`}
              </Box>
            </Box>
          )}

          {/* Last checked */}
          {status?.lastChecked && (
            <Box sx={{ color: 'text.secondary', mt: 1 }}>
              Last checked: {new Date(status.lastChecked).toLocaleTimeString()}
            </Box>
          )}

          {/* Ownership status (placeholder for future) */}
          {status?.ownership && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Ownership
              </Typography>
              <Box component="pre" sx={{ m: 0, fontSize: 'inherit' }}>
{`Is Owner:     ${status.ownership.isOwner}
Status:       ${status.ownership.status}
Message:      ${status.ownership.message}
${status.ownership.currentOwner ? `Current Owner: ${status.ownership.currentOwner}` : ''}`}
              </Box>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

export default BackendStatusCard;
