/**
 * FleetExtensionsCard - Displays installed Fleet extensions and ownership status.
 *
 * Shows:
 * - List of installed Fleet extensions with their status
 * - List of Fleet extension images (built but not installed)
 * - Which extension currently owns/controls Fleet
 * - Actions to take control if applicable
 *
 * This provides a user-friendly view of the extension ownership mechanism,
 * which prevents conflicts when multiple Fleet extensions are installed.
 */

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExtensionIcon from '@mui/icons-material/Extension';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import StarIcon from '@mui/icons-material/Star';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import ImageIcon from '@mui/icons-material/Image';
import CircularProgress from '@mui/material/CircularProgress';

import { BackendStatus, backendService } from '../services/BackendService';
import { listFleetExtensionImages, FleetExtensionImage } from '../utils/extensionBuilder';

export interface FleetExtensionsCardProps {
  /** Current backend status containing extension and ownership info */
  status: BackendStatus | null;
  /** Whether currently loading */
  loading: boolean;
  /** Callback to refresh status */
  onRefresh: () => void;
}

/** Get status chip color based on ownership status */
function getStatusColor(status: string): 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'claimed':
    case 'reclaimed':
    case 'taken-over':
      return 'success';
    case 'yielded':
      return 'warning';
    case 'error':
      return 'error';
    case 'waiting':
    case 'pending':
      return 'info';
    default:
      return 'info';
  }
}

/** Get human-readable status text */
function getStatusText(status: string): string {
  switch (status) {
    case 'claimed':
      return 'Active Owner';
    case 'reclaimed':
      return 'Reclaimed Control';
    case 'taken-over':
      return 'Took Control';
    case 'yielded':
      return 'Standby';
    case 'waiting':
      return 'Waiting...';
    case 'pending':
      return 'Initializing...';
    case 'error':
      return 'Error';
    default:
      return status;
  }
}

/**
 * Card showing installed Fleet extensions and ownership status.
 */
export function FleetExtensionsCard({ status, loading, onRefresh }: FleetExtensionsCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [recheckingOwnership, setRecheckingOwnership] = useState(false);
  const [fleetImages, setFleetImages] = useState<FleetExtensionImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);

  const connected = status?.connected ?? false;
  const initStatus = status?.initStatus;
  const ownership = status?.ownership;
  const isOwner = ownership?.isOwner ?? false;
  const kubernetesReady = initStatus?.kubernetesReady ?? false;

  // Only show ownership status when it's meaningful:
  // - K8s is ready (required for ownership ConfigMap)
  // - Ownership has been determined (not pending/waiting/error)
  const ownershipDetermined = ownership &&
    kubernetesReady &&
    ownership.status !== 'pending' &&
    ownership.status !== 'waiting' &&
    ownership.status !== 'error';

  // Get Fleet extensions from installed extensions list
  const fleetExtensions = initStatus?.installedExtensions.filter(ext => ext.hasFleetLabel) ?? [];
  const totalExtensions = initStatus?.installedExtensionsCount ?? 0;

  // Load Fleet extension images from Docker
  const loadFleetImages = useCallback(async () => {
    setLoadingImages(true);
    try {
      const images = await listFleetExtensionImages();
      setFleetImages(images);
    } catch (err) {
      console.error('Failed to load Fleet images:', err);
    } finally {
      setLoadingImages(false);
    }
  }, []);

  // Load images on mount and when status changes
  useEffect(() => {
    loadFleetImages();
  }, [loadFleetImages, status]);

  // Find images that aren't in the installed extensions list
  const uninstalledImages = fleetImages.filter(img => {
    const imgName = img.repository.toLowerCase();
    return !fleetExtensions.some(ext => {
      const extName = ext.name.toLowerCase();
      return extName.includes(imgName) || imgName.includes(extName.split(':')[0]);
    });
  });

  const handleRecheckOwnership = async () => {
    setRecheckingOwnership(true);
    try {
      await backendService.recheckOwnership();
      onRefresh();
    } catch (error) {
      console.error('Failed to recheck ownership:', error);
    } finally {
      setRecheckingOwnership(false);
    }
  };

  // Determine card border color based on status
  const getBorderColor = () => {
    if (!connected) return 'grey.400';
    if (!kubernetesReady) return 'grey.400';
    if (ownershipDetermined && isOwner) return 'success.main';
    if (ownershipDetermined && ownership?.status === 'yielded') return 'warning.main';
    return 'primary.main';
  };

  return (
    <Paper
      sx={{
        mb: 2,
        border: '1px solid',
        borderColor: getBorderColor(),
        boxShadow: 2,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {loading ? (
          <CircularProgress size={20} />
        ) : (
          <ExtensionIcon color={connected && kubernetesReady ? (ownershipDetermined && isOwner ? 'success' : 'primary') : 'disabled'} />
        )}

        <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
          Fleet Extensions
        </Typography>

        {/* Extension count chip */}
        <Chip
          size="small"
          label={`${fleetExtensions.length} installed${uninstalledImages.length > 0 ? `, ${uninstalledImages.length} image${uninstalledImages.length !== 1 ? 's' : ''}` : ''}`}
          color="primary"
          variant="outlined"
        />

        {/* Ownership status chip - only show when ownership is determined */}
        {ownershipDetermined && (
          <Chip
            size="small"
            icon={isOwner ? <StarIcon /> : <StarOutlineIcon />}
            label={getStatusText(ownership.status)}
            color={getStatusColor(ownership.status)}
            variant={isOwner ? 'filled' : 'outlined'}
          />
        )}

        {/* Show initializing chip when K8s not ready or ownership pending */}
        {connected && !ownershipDetermined && (
          <Chip
            size="small"
            label={!kubernetesReady ? 'K8s not ready' : 'Initializing...'}
            color="default"
            variant="outlined"
          />
        )}

        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onRefresh(); loadFleetImages(); }} disabled={loading || loadingImages}>
          <RefreshIcon fontSize="small" />
        </IconButton>

        {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </Box>

      {/* Expandable content */}
      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ p: 2 }}>
          {/* Connection status message */}
          {!connected && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'text.secondary' }}>
              <ErrorIcon fontSize="small" color="error" />
              <Typography variant="body2">
                Backend service not connected. Extension ownership cannot be determined.
              </Typography>
            </Box>
          )}

          {/* K8s not ready message */}
          {connected && !kubernetesReady && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'text.secondary' }}>
              <CircularProgress size={16} />
              <Typography variant="body2">
                Waiting for Kubernetes to be ready...
              </Typography>
            </Box>
          )}

          {/* Ownership explanation - only show when determined */}
          {ownershipDetermined && (
            <Box
              sx={{
                mb: 2,
                p: 1.5,
                borderRadius: 1,
                bgcolor: isOwner ? 'success.light' : 'warning.light',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
              }}
            >
              {isOwner ? (
                <CheckCircleIcon color="success" sx={{ mt: 0.25 }} />
              ) : (
                <WarningIcon color="warning" sx={{ mt: 0.25 }} />
              )}
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {isOwner
                    ? 'This extension controls Fleet'
                    : `Another extension controls Fleet: ${ownership.currentOwner}`
                  }
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {ownership.message}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Fleet Extensions List */}
          {fleetExtensions.length > 0 ? (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Installed Fleet Extensions ({fleetExtensions.length})
              </Typography>
              <List dense disablePadding>
                {fleetExtensions.map((ext, index) => {
                  const isCurrentOwner = ownership?.ownExtensionName === ext.name;
                  const isThisExtension = initStatus?.ownIdentity.extensionName === ext.name;

                  return (
                    <ListItem
                      key={index}
                      sx={{
                        bgcolor: isThisExtension ? 'action.selected' : 'transparent',
                        borderRadius: 1,
                        mb: 0.5,
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        {isCurrentOwner ? (
                          <Tooltip title="Current owner">
                            <StarIcon color="success" fontSize="small" />
                          </Tooltip>
                        ) : (
                          <ExtensionIcon fontSize="small" color="action" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {ext.name}
                            </Typography>
                            {isThisExtension && (
                              <Chip
                                size="small"
                                label="This"
                                color="primary"
                                variant="outlined"
                                sx={{ height: 18, fontSize: '0.65rem' }}
                              />
                            )}
                            {ext.fleetType && (
                              <Chip
                                size="small"
                                label={ext.fleetType}
                                color="default"
                                variant="outlined"
                                sx={{ height: 18, fontSize: '0.65rem' }}
                              />
                            )}
                          </Box>
                        }
                        secondary={ext.tag ? `Tag: ${ext.tag}` : undefined}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          ) : connected ? (
            <Typography variant="body2" color="text.secondary">
              No Fleet extensions detected. This may happen during initialization.
            </Typography>
          ) : null}

          {/* Show other (non-Fleet) extensions count */}
          {totalExtensions > fleetExtensions.length && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              + {totalExtensions - fleetExtensions.length} other extension{totalExtensions - fleetExtensions.length !== 1 ? 's' : ''} installed
            </Typography>
          )}

          {/* Uninstalled Fleet Images */}
          {uninstalledImages.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Fleet Extension Images (Not Installed) ({uninstalledImages.length})
              </Typography>
              <List dense disablePadding>
                {uninstalledImages.map((img, index) => (
                  <ListItem
                    key={index}
                    sx={{
                      bgcolor: 'action.hover',
                      borderRadius: 1,
                      mb: 0.5,
                      opacity: 0.8,
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Tooltip title="Docker image (not installed)">
                        <ImageIcon fontSize="small" color="action" />
                      </Tooltip>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {img.repository || img.id}
                          </Typography>
                          <Chip
                            size="small"
                            label="Image"
                            color="default"
                            variant="outlined"
                            sx={{ height: 18, fontSize: '0.65rem' }}
                          />
                          {img.type && (
                            <Chip
                              size="small"
                              label={img.type}
                              color="default"
                              variant="outlined"
                              sx={{ height: 18, fontSize: '0.65rem' }}
                            />
                          )}
                        </Box>
                      }
                      secondary={img.tag ? `Tag: ${img.tag}` : undefined}
                    />
                  </ListItem>
                ))}
              </List>
              {loadingImages && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <CircularProgress size={12} />
                  <Typography variant="caption" color="text.secondary">
                    Scanning for Fleet images...
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Actions */}
          {connected && initStatus?.kubernetesReady && (
            <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button
                size="small"
                variant="outlined"
                onClick={handleRecheckOwnership}
                disabled={recheckingOwnership}
                startIcon={recheckingOwnership ? <CircularProgress size={16} /> : <RefreshIcon />}
              >
                {recheckingOwnership ? 'Checking...' : 'Recheck Ownership'}
              </Button>
            </Box>
          )}

          {/* Debug info footer */}
          {status?.identity && (
            <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                Container: {status.identity.containerId.substring(0, 12)}... |
                Version: {status.identity.version} |
                K8s: {initStatus?.kubernetesReady ? 'Ready' : 'Not Ready'}
              </Typography>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

export default FleetExtensionsCard;
