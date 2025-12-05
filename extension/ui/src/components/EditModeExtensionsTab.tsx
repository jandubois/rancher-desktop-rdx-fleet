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

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import Radio from '@mui/material/Radio';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExtensionIcon from '@mui/icons-material/Extension';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import DeleteIcon from '@mui/icons-material/Delete';
import CircularProgress from '@mui/material/CircularProgress';

import { BackendStatus, backendService, InstalledExtension } from '../services/BackendService';
import { listFleetExtensionImages, FleetExtensionImage } from '../utils/extensionBuilder';
import { useServices } from '../context/ServiceContext';

/**
 * Parse rdctl extension ls output.
 * Output format: Plain text with header "Extension IDs" followed by image:tag lines.
 */
function parseRdctlOutput(stdout: string): InstalledExtension[] {
  const extensions: InstalledExtension[] = [];
  const lines = stdout.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and header lines (lines without a colon are not image:tag format)
    if (!trimmed || !trimmed.includes(':')) {
      continue;
    }
    // Parse image:tag format - the tag is after the last colon
    const lastColonIndex = trimmed.lastIndexOf(':');
    if (lastColonIndex > 0) {
      const name = trimmed.substring(0, lastColonIndex);
      const tag = trimmed.substring(lastColonIndex + 1);
      // Only include if both name and tag are non-empty
      if (name && tag) {
        extensions.push({ name, tag });
      }
    }
  }

  return extensions;
}

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
/** Operation type for tracking which button is spinning */
type OperationType = 'uninstall' | 'activate' | 'delete';

export function EditModeExtensionsTab({ status, loading, onRefresh }: EditModeExtensionsTabProps) {
  const [recheckingOwnership, setRecheckingOwnership] = useState(false);
  const [fleetImages, setFleetImages] = useState<FleetExtensionImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [operatingImage, setOperatingImage] = useState<{ image: string; op: OperationType } | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

  const { commandExecutor } = useServices();

  const connected = status?.connected ?? false;
  const initStatus = status?.initStatus;
  const ownership = status?.ownership;
  const kubernetesReady = initStatus?.kubernetesReady ?? false;

  // Use backend's isOwner - each extension runs its own backend with the same image name
  // as the frontend, so the backend correctly identifies itself via Docker lookup
  const isOwner = ownership?.isOwner ?? false;
  const currentOwner = ownership?.currentOwner;

  // Only show ownership status when it's meaningful:
  // - K8s is ready (required for ownership ConfigMap)
  // - Ownership has been determined (not pending/waiting/error)
  const ownershipDetermined = ownership &&
    kubernetesReady &&
    ownership.status !== 'pending' &&
    ownership.status !== 'waiting' &&
    ownership.status !== 'error';

  // Get all installed extensions (for matching with Docker images)
  const allInstalledExtensions = useMemo(
    () => initStatus?.installedExtensions ?? [],
    [initStatus?.installedExtensions]
  );

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

  // Refresh installed extensions list by re-running rdctl and updating backend
  const refreshInstalledExtensions = useCallback(async () => {
    try {
      // Run rdctl extension ls to get current extension list
      const rdctlResult = await commandExecutor.rdExec('rdctl', ['extension', 'ls']);

      if (rdctlResult.stdout) {
        const installedExtensions = parseRdctlOutput(rdctlResult.stdout);
        console.log('[ExtensionsTab] Refreshed extensions list:', installedExtensions.map(e => `${e.name}:${e.tag}`));

        // Update backend with new extension list
        await backendService.initialize({ installedExtensions });
      }
    } catch (error) {
      console.error('[ExtensionsTab] Failed to refresh extensions list:', error);
    }
  }, [commandExecutor]);

  // Normalize image reference to full form: repository:tag (lowercase)
  const normalizeImageRef = useCallback((name: string): string => {
    const lower = name.toLowerCase();
    return lower.includes(':') ? lower : `${lower}:latest`;
  }, []);

  // Create unified list of all images with their status
  const unifiedImages: UnifiedImageInfo[] = fleetImages.map(img => {
    const imageName = img.repository + (img.tag ? `:${img.tag}` : ':latest');
    const normalizedImageName = normalizeImageRef(imageName);

    // Check if this image is installed as an extension
    // Compare normalized full image names (repository:tag)
    // Note: ext.name is just the repository, ext.tag is the tag
    const installedExt = allInstalledExtensions.find(ext => {
      const extFullName = ext.tag ? `${ext.name}:${ext.tag}` : ext.name;
      const normalizedExtName = normalizeImageRef(extFullName);
      return normalizedExtName === normalizedImageName;
    });

    // Check if this is the extension we're currently running in
    const isThisExtension = !!installedExt && initStatus?.ownIdentity.extensionName === installedExt.name;

    // Check if this is the currently active (owner) extension
    // currentOwner is already defined in outer scope from ownership?.currentOwner
    const isActive = !!installedExt && (
      currentOwner === imageName ||
      currentOwner === normalizedImageName ||
      (isThisExtension && isOwner)
    );

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

  // Sort so base extension always comes first
  const sortedUnifiedImages = [...unifiedImages].sort((a, b) => {
    if (a.type === 'base' && b.type !== 'base') return -1;
    if (a.type !== 'base' && b.type === 'base') return 1;
    return 0;
  });

  // Find the base image for fallback when deleting/uninstalling active image
  const baseImage = sortedUnifiedImages.find(img => img.type === 'base');

  // Debug logging - log extension matching data to backend
  useEffect(() => {
    if (fleetImages.length > 0 || allInstalledExtensions.length > 0) {
      backendService.debugLog('ExtensionsTab', 'Extension matching data', {
        fleetImages: fleetImages.map(img => ({
          repository: img.repository,
          tag: img.tag,
          type: img.type,
          normalized: normalizeImageRef(img.repository + (img.tag ? `:${img.tag}` : ':latest')),
        })),
        installedExtensions: allInstalledExtensions.map(ext => ({
          name: ext.name,
          tag: ext.tag,
          fullName: ext.tag ? `${ext.name}:${ext.tag}` : ext.name,
          normalized: normalizeImageRef(ext.tag ? `${ext.name}:${ext.tag}` : ext.name),
          hasFleetLabel: ext.hasFleetLabel,
          fleetType: ext.fleetType,
        })),
        unifiedResults: sortedUnifiedImages.map(img => ({
          imageName: img.imageName,
          isInstalled: img.isInstalled,
          isActive: img.isActive,
          isThisExtension: img.isThisExtension,
          type: img.type,
        })),
        ownership: {
          ownExtensionName: ownership?.ownExtensionName,
          currentOwner: ownership?.currentOwner,
          isOwner,
          status: ownership?.status,
        },
        ownIdentity: initStatus?.ownIdentity,
      });
    }
  }, [fleetImages, allInstalledExtensions, sortedUnifiedImages, ownership, isOwner, initStatus, normalizeImageRef]);

  // Uninstall a Fleet extension
  const handleUninstall = async (img: UnifiedImageInfo) => {
    setOperatingImage({ image: img.imageName, op: 'uninstall' });
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

      // If this was the active extension and there's a base image, activate the base
      if (img.isActive && baseImage && baseImage.imageName !== img.imageName) {
        console.log(`[ExtensionsTab] Activating base extension after uninstall: ${baseImage.imageName}`);

        // Ensure base is installed
        if (!baseImage.isInstalled) {
          const installResult = await commandExecutor.rdExec('rdctl', [
            'extension',
            'install',
            baseImage.imageName,
          ]);
          if (installResult.stderr && installResult.stderr.includes('Error')) {
            console.warn('Failed to install base extension:', installResult.stderr);
          }
        }

        // Transfer ownership to base
        await backendService.transferOwnership(baseImage.imageName);
      }

      // Refresh extension list and UI after successful uninstall
      await loadFleetImages();
      await refreshInstalledExtensions();
      onRefresh();
    } catch (error) {
      console.error('Failed to uninstall extension:', error);
      setOperationError(error instanceof Error ? error.message : 'Failed to uninstall extension');
    } finally {
      setOperatingImage(null);
    }
  };

  // Activate an extension (transfer ownership to it)
  const handleActivate = async (img: UnifiedImageInfo) => {
    setOperatingImage({ image: img.imageName, op: 'activate' });
    setOperationError(null);

    try {
      // If not installed, install it first (inline to avoid operatingImage being cleared by handleInstall)
      if (!img.isInstalled) {
        console.log(`[ExtensionsTab] Installing ${img.imageName} before activation...`);
        const result = await commandExecutor.rdExec('rdctl', [
          'extension',
          'install',
          img.imageName,
        ]);

        if (result.stderr && result.stderr.includes('Error')) {
          throw new Error(result.stderr);
        }

        // Refresh extension list after install
        await refreshInstalledExtensions();
      }

      // Transfer ownership using the full image name as the canonical identifier
      console.log(`[ExtensionsTab] Transferring ownership to: ${img.imageName}`);
      await backendService.transferOwnership(img.imageName);

      // Refresh to show updated status
      await loadFleetImages();
      onRefresh();
    } catch (error) {
      console.error('Failed to activate extension:', error);
      setOperationError(error instanceof Error ? error.message : 'Failed to activate extension');
    } finally {
      setOperatingImage(null);
    }
  };

  // Delete a Docker image
  const handleDelete = async (img: UnifiedImageInfo) => {
    setOperatingImage({ image: img.imageName, op: 'delete' });
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

        // If this was the active image and there's a base image, activate the base
        if (img.isActive && baseImage && baseImage.imageName !== img.imageName) {
          console.log(`[ExtensionsTab] Activating base extension after delete: ${baseImage.imageName}`);

          // Ensure base is installed
          if (!baseImage.isInstalled) {
            const installResult = await commandExecutor.rdExec('rdctl', [
              'extension',
              'install',
              baseImage.imageName,
            ]);
            if (installResult.stderr && installResult.stderr.includes('Error')) {
              console.warn('Failed to install base extension:', installResult.stderr);
            }
          }

          // Transfer ownership to base
          await backendService.transferOwnership(baseImage.imageName);
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

      // Refresh extension list and UI after successful delete
      await loadFleetImages();
      await refreshInstalledExtensions();
      onRefresh();
    } catch (error) {
      console.error('Failed to delete image:', error);
      setOperationError(error instanceof Error ? error.message : 'Failed to delete image');
    } finally {
      setOperatingImage(null);
    }
  };

  const handleRefresh = async () => {
    setRecheckingOwnership(true);
    try {
      await backendService.recheckOwnership();
    } catch (error) {
      console.error('Failed to recheck ownership:', error);
    } finally {
      setRecheckingOwnership(false);
    }
    onRefresh();
    loadFleetImages();
  };

  return (
    <Box>
      {/* Header with status and refresh */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flexGrow: 1 }}>
          Fleet Extensions Status
        </Typography>

        {/* Extension count chip */}
        <Chip
          size="small"
          label={`${sortedUnifiedImages.filter(i => i.isInstalled).length} installed, ${sortedUnifiedImages.length} images`}
          color="primary"
          variant="outlined"
        />

        {/* Ownership status chip - only show when ownership is determined */}
        {ownershipDetermined && (
          <Chip
            size="small"
            icon={isOwner ? <CheckCircleIcon /> : undefined}
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

        <Tooltip title="Refresh status and images">
          <IconButton size="small" onClick={handleRefresh} disabled={loading || loadingImages || recheckingOwnership}>
            {(loading || recheckingOwnership) ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
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
            alignItems: 'center',
            gap: 1,
          }}
        >
          {isOwner ? (
            <CheckCircleIcon color="success" />
          ) : (
            <WarningIcon color="warning" />
          )}
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {isOwner
              ? 'This extension controls Fleet'
              : `Another extension controls Fleet: ${ownership.currentOwner}`
            }
          </Typography>
        </Box>
      )}

      {/* Fleet Extension Images List */}
      {sortedUnifiedImages.length > 0 ? (
        <Box>
          {operationError && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'error.main' }}>
              <ErrorIcon fontSize="small" />
              <Typography variant="caption">{operationError}</Typography>
            </Box>
          )}
          <List dense disablePadding>
            {sortedUnifiedImages.map((img, index) => {
              // Check if this specific image+operation is in progress
              const isActivating = operatingImage?.image === img.imageName && operatingImage?.op === 'activate';
              const isUninstalling = operatingImage?.image === img.imageName && operatingImage?.op === 'uninstall';
              const isDeleting = operatingImage?.image === img.imageName && operatingImage?.op === 'delete';
              const canModify = img.type !== 'base'; // Base image cannot be uninstalled or deleted

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
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                      {/* Uninstall button - show if installed and not base image */}
                      {img.isInstalled && canModify && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          onClick={() => handleUninstall(img)}
                          disabled={!!operatingImage}
                          startIcon={isUninstalling ? <CircularProgress size={14} /> : undefined}
                          sx={{ minWidth: 'auto', px: 1, py: 0.25, fontSize: '0.75rem' }}
                        >
                          {isUninstalling ? 'Uninstalling...' : 'Uninstall'}
                        </Button>
                      )}
                      {/* Delete button - show if not base image */}
                      {canModify && (
                        <Tooltip title={img.isInstalled ? 'Uninstall and delete image' : 'Delete image'}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(img)}
                            disabled={!!operatingImage}
                          >
                            {isDeleting ? <CircularProgress size={18} /> : <DeleteIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  }
                >
                  {/* Radio button for selecting active extension */}
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Tooltip title={img.isActive ? 'Active extension' : 'Click to activate'}>
                      <span>
                        <Radio
                          size="small"
                          checked={img.isActive}
                          onChange={() => !img.isActive && handleActivate(img)}
                          disabled={!!operatingImage || !ownershipDetermined}
                          sx={{ p: 0.5 }}
                        />
                      </span>
                    </Tooltip>
                    {isActivating && (
                      <CircularProgress size={16} sx={{ position: 'absolute', ml: 0.25 }} />
                    )}
                  </ListItemIcon>
                  {/* Extension icon */}
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    <ExtensionIcon fontSize="small" color={img.isInstalled ? 'primary' : 'action'} />
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
                          {!img.isInstalled && (
                            <Chip
                              size="small"
                              label="not installed"
                              color="default"
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
        </Box>
      ) : connected ? (
        <Typography variant="body2" color="text.secondary">
          No Fleet extension images found.
        </Typography>
      ) : null}


    </Box>
  );
}

export default EditModeExtensionsTab;
