/**
 * EditModeExtensionsTab - Tab content for Fleet extensions management in edit mode.
 *
 * Shows:
 * - List of installed Fleet extensions with their status
 * - List of Fleet extension images (built but not installed)
 * - Which extension currently owns/controls Fleet
 * - Actions to take control if applicable
 *
 * This is displayed as a tab within the EditModePanel, providing a user-friendly
 * view of the extension ownership mechanism for users working on custom extensions.
 */

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExtensionIcon from '@mui/icons-material/Extension';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import StarIcon from '@mui/icons-material/Star';
import ImageIcon from '@mui/icons-material/Image';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import CircularProgress from '@mui/material/CircularProgress';

import { BackendStatus, backendService } from '../services/BackendService';
import { listFleetExtensionImages, FleetExtensionImage } from '../utils/extensionBuilder';
import { useServices } from '../context/ServiceContext';

/** Unified image info combining Docker image and extension status */
interface UnifiedImageInfo {
  /** Full image name (repository:tag) */
  imageName: string;
  /** Image ID from Docker */
  id: string;
  /** Repository name */
  repository: string;
  /** Tag */
  tag: string;
  /** Fleet type: base or custom */
  type: 'base' | 'custom';
  /** Human-readable title from OCI label */
  title?: string;
  /** For custom extensions, the base image used */
  baseImage?: string;
  /** Whether this image is installed as an extension */
  isInstalled: boolean;
  /** Whether this is the currently active (owner) extension */
  isActive: boolean;
  /** Whether this is the extension we're running in */
  isThisExtension: boolean;
}

export interface EditModeExtensionsTabProps {
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
 * Tab content showing installed Fleet extensions and ownership status.
 */
export function EditModeExtensionsTab({ status, loading, onRefresh }: EditModeExtensionsTabProps) {
  const [recheckingOwnership, setRecheckingOwnership] = useState(false);
  const [fleetImages, setFleetImages] = useState<FleetExtensionImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [operatingImage, setOperatingImage] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

  const { commandExecutor } = useServices();

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

  // Create unified list of all images with their status
  const unifiedImages: UnifiedImageInfo[] = fleetImages.map(img => {
    const imageName = img.repository + (img.tag ? `:${img.tag}` : ':latest');
    const imgNameLower = img.repository.toLowerCase();

    // Check if this image is installed as an extension
    const installedExt = fleetExtensions.find(ext => {
      const extName = ext.name.toLowerCase();
      return extName.includes(imgNameLower) || imgNameLower.includes(extName.split(':')[0]);
    });

    // Check if this is the currently active (owner) extension
    const isActive = installedExt && ownership?.ownExtensionName === installedExt.name;

    // Check if this is the extension we're running in
    const isThisExtension = installedExt && initStatus?.ownIdentity.extensionName === installedExt.name;

    return {
      imageName,
      id: img.id,
      repository: img.repository,
      tag: img.tag,
      type: img.type,
      title: img.title,
      baseImage: img.baseImage,
      isInstalled: !!installedExt,
      isActive: !!isActive,
      isThisExtension: !!isThisExtension,
    };
  });

  // Find the base image for fallback when deleting active image
  const baseImage = unifiedImages.find(img => img.type === 'base');

  // Install a Fleet extension image
  const handleInstall = async (img: UnifiedImageInfo) => {
    setOperatingImage(img.imageName);
    setOperationError(null);

    try {
      const result = await commandExecutor.rdExec('rdctl', [
        'extension',
        'install',
        img.imageName,
      ]);

      if (result.stderr && result.stderr.includes('Error')) {
        throw new Error(result.stderr);
      }

      // Refresh after successful install
      await loadFleetImages();
      onRefresh();
    } catch (error) {
      console.error('Failed to install extension:', error);
      setOperationError(error instanceof Error ? error.message : 'Failed to install extension');
    } finally {
      setOperatingImage(null);
    }
  };

  // Uninstall a Fleet extension
  const handleUninstall = async (img: UnifiedImageInfo) => {
    setOperatingImage(img.imageName);
    setOperationError(null);

    try {
      const result = await commandExecutor.rdExec('rdctl', [
        'extension',
        'uninstall',
        img.imageName,
      ]);

      if (result.stderr && result.stderr.includes('Error')) {
        throw new Error(result.stderr);
      }

      // Refresh after successful uninstall
      await loadFleetImages();
      onRefresh();
    } catch (error) {
      console.error('Failed to uninstall extension:', error);
      setOperationError(error instanceof Error ? error.message : 'Failed to uninstall extension');
    } finally {
      setOperatingImage(null);
    }
  };

  // Activate an extension (install it, which will make it the owner via the ownership mechanism)
  const handleActivate = async (img: UnifiedImageInfo) => {
    // If not installed, install it first
    if (!img.isInstalled) {
      await handleInstall(img);
    }
    // The ownership mechanism will handle making it active
    // Trigger a recheck of ownership
    await handleRecheckOwnership();
  };

  // Delete a Docker image
  const handleDelete = async (img: UnifiedImageInfo) => {
    setOperatingImage(img.imageName);
    setOperationError(null);

    try {
      // If installed, uninstall first
      if (img.isInstalled) {
        const uninstallResult = await commandExecutor.rdExec('rdctl', [
          'extension',
          'uninstall',
          img.imageName,
        ]);

        if (uninstallResult.stderr && uninstallResult.stderr.includes('Error')) {
          throw new Error(uninstallResult.stderr);
        }

        // If this was the active image and there's a base image, install the base
        if (img.isActive && baseImage && baseImage.imageName !== img.imageName) {
          const installResult = await commandExecutor.rdExec('rdctl', [
            'extension',
            'install',
            baseImage.imageName,
          ]);

          if (installResult.stderr && installResult.stderr.includes('Error')) {
            console.warn('Failed to install base image as fallback:', installResult.stderr);
          }
        }
      }

      // Delete the Docker image
      const deleteResult = await commandExecutor.rdExec('docker', [
        'rmi',
        img.imageName,
      ]);

      if (deleteResult.stderr && deleteResult.stderr.includes('Error')) {
        throw new Error(deleteResult.stderr);
      }

      // Refresh after successful delete
      await loadFleetImages();
      onRefresh();
    } catch (error) {
      console.error('Failed to delete image:', error);
      setOperationError(error instanceof Error ? error.message : 'Failed to delete image');
    } finally {
      setOperatingImage(null);
    }
  };

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

  const handleRefresh = () => {
    onRefresh();
    loadFleetImages();
  };

  return (
    <Box>
      {/* Header with status and refresh */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {loading ? (
          <CircularProgress size={20} />
        ) : (
          <ExtensionIcon color={connected && kubernetesReady ? (ownershipDetermined && isOwner ? 'success' : 'primary') : 'disabled'} />
        )}

        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          Fleet Extensions Status
        </Typography>

        {/* Extension count chip */}
        <Chip
          size="small"
          label={`${unifiedImages.filter(i => i.isInstalled).length} installed, ${unifiedImages.length} images`}
          color="primary"
          variant="outlined"
        />

        {/* Ownership status chip - only show when ownership is determined */}
        {ownershipDetermined && (
          <Chip
            size="small"
            icon={isOwner ? <StarIcon /> : undefined}
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

        <IconButton size="small" onClick={handleRefresh} disabled={loading || loadingImages}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Box>

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

      {/* Fleet Extension Images List */}
      {unifiedImages.length > 0 ? (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Fleet Extension Images ({unifiedImages.length})
          </Typography>
          {operationError && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'error.main' }}>
              <ErrorIcon fontSize="small" />
              <Typography variant="caption">{operationError}</Typography>
            </Box>
          )}
          <List dense disablePadding>
            {unifiedImages.map((img, index) => {
              const isOperating = operatingImage === img.imageName;
              const canDelete = img.type !== 'base'; // Base image cannot be deleted

              return (
                <ListItem
                  key={index}
                  sx={{
                    bgcolor: img.isThisExtension ? 'action.selected' : img.isInstalled ? 'action.hover' : 'transparent',
                    borderRadius: 1,
                    mb: 0.5,
                    pr: 1,
                  }}
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {/* Activate button - show if installed but not active */}
                      {img.isInstalled && !img.isActive && (
                        <Tooltip title="Activate this extension">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleActivate(img)}
                            disabled={!!operatingImage}
                          >
                            {isOperating ? <CircularProgress size={18} /> : <PlayArrowIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      )}
                      {/* Install button - show if not installed */}
                      {!img.isInstalled && (
                        <Tooltip title="Install extension">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleInstall(img)}
                            disabled={!!operatingImage}
                          >
                            {isOperating ? <CircularProgress size={18} /> : <DownloadIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      )}
                      {/* Uninstall button - show if installed */}
                      {img.isInstalled && (
                        <Tooltip title="Uninstall extension">
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => handleUninstall(img)}
                            disabled={!!operatingImage}
                          >
                            {isOperating ? <CircularProgress size={18} /> : <StopIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      )}
                      {/* Delete button - show if not base image */}
                      {canDelete && (
                        <Tooltip title={img.isInstalled ? 'Uninstall and delete image' : 'Delete image'}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(img)}
                            disabled={!!operatingImage}
                          >
                            {isOperating ? <CircularProgress size={18} /> : <DeleteIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  }
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {img.isActive ? (
                      <Tooltip title="Active (current owner)">
                        <StarIcon color="success" fontSize="small" />
                      </Tooltip>
                    ) : img.isInstalled ? (
                      <Tooltip title="Installed">
                        <ExtensionIcon fontSize="small" color="primary" />
                      </Tooltip>
                    ) : (
                      <Tooltip title="Docker image (not installed)">
                        <ImageIcon fontSize="small" color="action" />
                      </Tooltip>
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Tooltip title={img.title ? `Title: ${img.title}` : ''} placement="top-start">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {img.imageName}
                          </Typography>
                          {img.isThisExtension && (
                            <Chip
                              size="small"
                              label="This"
                              color="primary"
                              variant="outlined"
                              sx={{ height: 18, fontSize: '0.65rem' }}
                            />
                          )}
                          {img.type && (
                            <Chip
                              size="small"
                              label={img.type}
                              color={img.type === 'base' ? 'info' : 'default'}
                              variant="outlined"
                              sx={{ height: 18, fontSize: '0.65rem' }}
                            />
                          )}
                          {img.isInstalled && (
                            <Chip
                              size="small"
                              label="installed"
                              color="success"
                              variant="outlined"
                              sx={{ height: 18, fontSize: '0.65rem' }}
                            />
                          )}
                        </Box>
                      </Tooltip>
                    }
                  />
                </ListItem>
              );
            })}
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
      ) : connected ? (
        <Typography variant="body2" color="text.secondary">
          No Fleet extension images found. {loadingImages ? 'Scanning...' : ''}
        </Typography>
      ) : null}

      {/* Show other (non-Fleet) extensions count */}
      {totalExtensions > fleetExtensions.length && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          + {totalExtensions - fleetExtensions.length} other extension{totalExtensions - fleetExtensions.length !== 1 ? 's' : ''} installed
        </Typography>
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
  );
}

export default EditModeExtensionsTab;
