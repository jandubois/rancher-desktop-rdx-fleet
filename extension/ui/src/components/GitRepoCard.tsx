/**
 * GitRepoCard component - Displays a Git repository card with path selection.
 *
 * This is a pure presentational component that receives all data via props,
 * making it easily testable without complex mocking.
 *
 * Refactored to use extracted PathCheckbox and RepoStatusChip components.
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import FormGroup from '@mui/material/FormGroup';
import Divider from '@mui/material/Divider';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

import { GitRepo, BundleInfo, DependencyResolution } from '../types';
import { PathInfo } from '../utils';
import { EditableTitle } from './EditableTitle';
import { PathCheckbox } from './PathCheckbox';
import { RepoStatusChip } from './RepoStatusChip';

/** Props for the GitRepoCard component */
export interface GitRepoCardProps {
  /** The GitRepo data to display */
  repo: GitRepo;
  /** Index of this repo in the list */
  index: number;
  /** Total number of repos (used to determine if delete is allowed) */
  totalCount: number;
  /** Maximum number of visible paths before scrolling */
  maxVisiblePaths?: number;
  /** Custom card ID for edit mode */
  cardId?: string;
  /** Whether edit mode is active */
  editMode: boolean;
  /** Current card title */
  title: string;
  /** Whether this repo is currently being updated */
  isUpdating: boolean;
  /** Whether Fleet is running (enables actions) */
  fleetRunning: boolean;
  /** Available paths discovered for this repo */
  availablePaths: PathInfo[];
  /** Whether path discovery is in progress */
  loadingPaths: boolean;
  /** Whether paths have been discovered (even if empty) */
  hasDiscoveredPaths: boolean;
  /** Discovery error message if any */
  discoveryError?: string;
  /** Timestamp when discovery started (for timeout display) */
  discoveryStartTime?: number;
  /** Current time for timeout checks */
  currentTime: number;
  /** Function to get selection info for a path */
  getSelectionInfo: (repoName: string, path: string, selectedPaths: Map<string, Set<string>>) => DependencyResolution;
  /** Function to check if a path can be deselected */
  canDeselect: (repoName: string, path: string, selectedPaths: Map<string, Set<string>>) => { canDeselect: boolean; requiredBy: BundleInfo[] } | null;
  /** Currently selected paths map */
  currentlySelectedPaths: Map<string, Set<string>>;
  /** Callback when title changes */
  onTitleChange: (title: string) => void;
  /** Callback to add a new repo */
  onAddRepo: () => void;
  /** Callback to delete this repo */
  onDeleteRepo: (name: string) => void;
  /** Callback to toggle a path */
  onTogglePath: (repo: GitRepo, path: string) => void;
  /** Callback to show dependency dialog */
  onShowDependencyDialog: (repoName: string, path: string, willAutoSelect: BundleInfo[]) => void;
  /** Callback to retry path discovery */
  onRetryDiscovery: () => void;
  /** Callback to discover paths */
  onDiscoverPaths: () => void;
}

/**
 * GitRepoCard - Displays a Git repository with path selection.
 *
 * This component is a pure presentational component that receives
 * all data and callbacks via props, making it fully testable.
 */
export function GitRepoCard({
  repo,
  totalCount,
  maxVisiblePaths = 6,
  cardId: _cardId,
  editMode,
  title,
  isUpdating,
  fleetRunning,
  availablePaths,
  loadingPaths,
  hasDiscoveredPaths,
  discoveryError,
  discoveryStartTime,
  currentTime,
  getSelectionInfo,
  canDeselect,
  currentlySelectedPaths,
  onTitleChange,
  onAddRepo,
  onDeleteRepo,
  onTogglePath,
  onShowDependencyDialog,
  onRetryDiscovery,
  onDiscoverPaths,
}: GitRepoCardProps) {
  const enabledPaths = repo.paths || [];
  const canDelete = totalCount > 1;
  const isTimedOut = discoveryStartTime && (currentTime - discoveryStartTime) > 30000;

  return (
    <>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <EditableTitle
              value={title}
              editMode={editMode}
              onChange={onTitleChange}
              placeholder={repo.name}
            />
            <RepoStatusChip repo={repo} />
            {isUpdating && <CircularProgress size={16} />}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            {repo.repo}
          </Typography>
          {repo.branch && (
            <Typography variant="caption" color="text.secondary">
              Branch: {repo.branch}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={onAddRepo}
            title="Add another repository"
            disabled={!fleetRunning}
          >
            <AddIcon />
          </IconButton>
          {canDelete && (
            <IconButton
              size="small"
              onClick={() => onDeleteRepo(repo.name)}
              title="Delete repository"
              disabled={isUpdating}
            >
              <DeleteIcon />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Error message if any */}
      {repo.status?.display?.error && repo.status.display.message && (
        <Alert severity="error" sx={{ my: 1, fontSize: '0.85rem' }}>
          {repo.status.display.message}
        </Alert>
      )}

      <Divider sx={{ my: 1.5 }} />

      {/* Paths */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">
          Paths{enabledPaths.length > 0 ? ` (${enabledPaths.length} deployed)` : ''}
        </Typography>
        {loadingPaths && <CircularProgress size={12} />}
      </Box>

      {/* Discovery error with retry */}
      {discoveryError && !loadingPaths && (
        <Alert
          severity="warning"
          sx={{ mb: 1 }}
          action={
            <Button color="inherit" size="small" onClick={onRetryDiscovery}>
              Retry
            </Button>
          }
        >
          {discoveryError}
        </Alert>
      )}

      {/* Timeout warning with retry */}
      {isTimedOut && loadingPaths && (
        <Alert
          severity="info"
          sx={{ mb: 1 }}
          action={
            <Button color="inherit" size="small" onClick={onRetryDiscovery}>
              Retry
            </Button>
          }
        >
          Path discovery is taking longer than expected...
        </Alert>
      )}

      {availablePaths.length > 0 ? (
        <Box
          sx={{
            pl: 1,
            ...(availablePaths.length > maxVisiblePaths && {
              maxHeight: maxVisiblePaths * 32,
              overflowY: 'auto',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 1,
            }),
          }}
        >
          <FormGroup sx={{ gap: 0 }}>
            {availablePaths.map((pathInfo) => {
              const isSelected = enabledPaths.includes(pathInfo.path);
              const selectionInfo = getSelectionInfo(repo.name, pathInfo.path, currentlySelectedPaths);
              const deselectionInfo = isSelected ? canDeselect(repo.name, pathInfo.path, currentlySelectedPaths) : null;

              return (
                <PathCheckbox
                  key={pathInfo.path}
                  pathInfo={pathInfo}
                  isSelected={isSelected}
                  selectionInfo={selectionInfo}
                  deselectionInfo={deselectionInfo}
                  isUpdating={isUpdating}
                  onToggle={() => onTogglePath(repo, pathInfo.path)}
                  onShowDependencyDialog={() => onShowDependencyDialog(repo.name, pathInfo.path, selectionInfo.willAutoSelect)}
                />
              );
            })}
          </FormGroup>
        </Box>
      ) : loadingPaths && !isTimedOut ? (
        <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
          Discovering available paths...
        </Typography>
      ) : !hasDiscoveredPaths && !discoveryError ? (
        <Box sx={{ pl: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Click to discover available paths
          </Typography>
          <Button size="small" onClick={onDiscoverPaths}>
            Discover
          </Button>
        </Box>
      ) : hasDiscoveredPaths && availablePaths.length === 0 && !discoveryError ? (
        enabledPaths.length > 0 ? (
          <Box sx={{ pl: 1 }}>
            {enabledPaths.map((path) => (
              <Chip key={path} label={path} size="small" sx={{ mr: 0.5, mb: 0.5, fontFamily: 'monospace' }} />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
            No fleet.yaml files found. Deploying all paths (root).
          </Typography>
        )
      ) : null}

      {/* Resources summary */}
      {repo.status?.resources && repo.status.resources.length > 0 && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Resources ({repo.status.resources.length})
          </Typography>
          <Box sx={{ pl: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {repo.status.resources.map((resource, idx) => (
              <Chip
                key={idx}
                label={`${resource.kind}/${resource.name}`}
                size="small"
                color={resource.state === 'Ready' ? 'success' : resource.state === 'WaitApplied' ? 'info' : 'default'}
                variant="outlined"
              />
            ))}
          </Box>
        </>
      )}
    </>
  );
}

export default GitRepoCard;
