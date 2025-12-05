/**
 * BackendStatusCard - Debug component for backend service status.
 *
 * Shows:
 * - Connection status
 * - Container ID and extension identity
 * - Health check results
 * - Ownership status with detailed debugging info
 * - Initialization status (Kubernetes, Docker, installed extensions)
 *
 * This is primarily for debugging during development.
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import Button from '@mui/material/Button';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import CircularProgress from '@mui/material/CircularProgress';
import { useState } from 'react';

import { BackendStatus, OwnershipDebugInfo, backendService } from '../services/BackendService';

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

/** Get color for ownership status */
function getOwnershipColor(status: string): 'success' | 'error' | 'warning' | 'info' {
  switch (status) {
    case 'claimed':
    case 'reclaimed':
    case 'taken-over':
      return 'success';
    case 'yielded':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'info';
  }
}

/** Get icon for ownership status */
function getOwnershipIcon(status: string) {
  switch (status) {
    case 'claimed':
    case 'reclaimed':
    case 'taken-over':
      return <CheckCircleIcon fontSize="small" />;
    case 'yielded':
      return <WarningIcon fontSize="small" />;
    case 'error':
      return <ErrorIcon fontSize="small" />;
    default:
      return <CircularProgress size={16} />;
  }
}

/**
 * Debug card showing backend service status.
 */
export function BackendStatusCard({ status, loading, onRefresh }: BackendStatusCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  const [debugInfo, setDebugInfo] = useState<OwnershipDebugInfo | null>(null);
  const [loadingDebug, setLoadingDebug] = useState(false);

  const connected = status?.connected ?? false;
  const health = status?.health;
  const identity = status?.identity;
  const initStatus = status?.initStatus;
  const ownership = status?.ownership;

  const loadDebugInfo = async () => {
    setLoadingDebug(true);
    try {
      const info = await backendService.getOwnershipDebugInfo();
      setDebugInfo(info);
      setShowLogs(true);
    } catch (error) {
      console.error('Failed to load debug info:', error);
    } finally {
      setLoadingDebug(false);
    }
  };

  const recheckOwnership = async () => {
    setLoadingDebug(true);
    try {
      await backendService.recheckOwnership();
      onRefresh();
      await loadDebugInfo();
    } catch (error) {
      console.error('Failed to recheck ownership:', error);
    } finally {
      setLoadingDebug(false);
    }
  };

  return (
    <Paper
      sx={{
        p: 2,
        mb: 2,
        border: '1px solid',
        borderColor: connected ? (ownership?.isOwner ? 'success.main' : 'warning.main') : 'error.main',
        opacity: 0.9,
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {loading ? (
          <CircularProgress size={20} />
        ) : connected ? (
          ownership?.isOwner ? (
            <CheckCircleIcon color="success" fontSize="small" />
          ) : (
            <WarningIcon color="warning" fontSize="small" />
          )
        ) : (
          <ErrorIcon color="error" fontSize="small" />
        )}

        <Typography variant="subtitle2" sx={{ flexGrow: 1, fontFamily: 'monospace' }}>
          Backend Service {ownership?.isOwner ? '(Owner)' : ownership ? '(Not Owner)' : ''}
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
Extension:    ${identity.extensionName} (${identity.extensionType})
Version:      ${identity.version}
Started:      ${identity.startedAt}`}
              </Box>
            </Box>
          )}

          {/* Ownership status - prominent display */}
          {ownership && (
            <Box sx={{ mb: 1, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                {getOwnershipIcon(ownership.status)}
                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                  Ownership Status
                </Typography>
                <Chip
                  size="small"
                  label={ownership.status.toUpperCase()}
                  color={getOwnershipColor(ownership.status)}
                  sx={{ height: 18, fontSize: '0.65rem' }}
                />
              </Box>
              <Box component="pre" sx={{ m: 0, fontSize: 'inherit' }}>
{`Is Owner:     ${ownership.isOwner ? 'YES' : 'NO'}
Own Name:     ${ownership.ownExtensionName}
Own Container: ${ownership.ownContainerId}
${ownership.currentOwner ? `Current Owner: ${ownership.currentOwner}` : ''}
Message:      ${ownership.message}`}
              </Box>
            </Box>
          )}

          {/* Initialization status */}
          {initStatus && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Initialization
              </Typography>
              <Box component="pre" sx={{ m: 0, fontSize: 'inherit' }}>
{`Initialized:   ${initStatus.initialized ? 'Yes' : 'No'}
Kubernetes:    ${initStatus.kubernetesReady ? 'Ready' : 'Not Ready'}
Docker:        ${initStatus.dockerAvailable ? 'Available' : 'Not Available'}
Extensions:    ${initStatus.installedExtensions.length} installed`}
              </Box>
              {initStatus.installedExtensions.length > 0 && (
                <Box sx={{ ml: 2, mt: 0.5 }}>
                  {initStatus.installedExtensions.map((ext, i) => (
                    <Box key={i} sx={{
                      color: ext.hasFleetLabel ? 'success.main' : 'text.secondary',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5
                    }}>
                      {ext.hasFleetLabel && <CheckCircleIcon sx={{ fontSize: 12 }} />}
                      {ext.name} {ext.fleetType ? `[${ext.fleetType}]` : ''}
                    </Box>
                  ))}
                </Box>
              )}
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

          {/* Debug actions */}
          <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={loadDebugInfo}
              disabled={loadingDebug || !connected}
            >
              {loadingDebug ? 'Loading...' : 'Show Debug Logs'}
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={recheckOwnership}
              disabled={loadingDebug || !connected || !initStatus?.kubernetesReady}
            >
              Recheck Ownership
            </Button>
          </Box>

          {/* Debug logs (expandable) */}
          {showLogs && debugInfo && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                  Debug Logs
                </Typography>
                <IconButton size="small" onClick={() => setShowLogs(false)}>
                  <ExpandLessIcon fontSize="small" />
                </IconButton>
              </Box>

              {/* Docker containers */}
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="primary.main" display="block">
                  Fleet Containers (Docker)
                </Typography>
                <Box component="pre" sx={{
                  m: 0,
                  fontSize: '0.65rem',
                  bgcolor: 'grey.900',
                  color: 'grey.100',
                  p: 1,
                  borderRadius: 1,
                  maxHeight: 100,
                  overflow: 'auto'
                }}>
                  {debugInfo.docker.fleetContainers.length > 0
                    ? debugInfo.docker.fleetContainers.map(c =>
                        `${c.name} (${c.state}) - ${c.id.substring(0, 12)}`
                      ).join('\n')
                    : 'No fleet containers found'}
                </Box>
              </Box>

              {/* Initialization log */}
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="primary.main" display="block">
                  Init Log
                </Typography>
                <Box component="pre" sx={{
                  m: 0,
                  fontSize: '0.65rem',
                  bgcolor: 'grey.900',
                  color: 'grey.100',
                  p: 1,
                  borderRadius: 1,
                  maxHeight: 150,
                  overflow: 'auto'
                }}>
                  {debugInfo.logs.init.length > 0
                    ? debugInfo.logs.init.slice(-20).join('\n')
                    : 'No init logs'}
                </Box>
              </Box>

              {/* Ownership log */}
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="primary.main" display="block">
                  Ownership Log
                </Typography>
                <Box component="pre" sx={{
                  m: 0,
                  fontSize: '0.65rem',
                  bgcolor: 'grey.900',
                  color: 'grey.100',
                  p: 1,
                  borderRadius: 1,
                  maxHeight: 200,
                  overflow: 'auto'
                }}>
                  {debugInfo.logs.ownership.length > 0
                    ? debugInfo.logs.ownership.slice(-30).join('\n')
                    : 'No ownership logs'}
                </Box>
              </Box>

              {/* Docker log */}
              <Box>
                <Typography variant="caption" color="primary.main" display="block">
                  Docker Log
                </Typography>
                <Box component="pre" sx={{
                  m: 0,
                  fontSize: '0.65rem',
                  bgcolor: 'grey.900',
                  color: 'grey.100',
                  p: 1,
                  borderRadius: 1,
                  maxHeight: 100,
                  overflow: 'auto'
                }}>
                  {debugInfo.logs.docker.length > 0
                    ? debugInfo.logs.docker.slice(-15).join('\n')
                    : 'No docker logs'}
                </Box>
              </Box>
            </Box>
          )}

          {/* Last checked */}
          {status?.lastChecked && (
            <Box sx={{ color: 'text.secondary', mt: 1 }}>
              Last checked: {new Date(status.lastChecked).toLocaleTimeString()}
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

export default BackendStatusCard;
