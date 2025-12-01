/**
 * RepoStatusChip component - Displays repository sync status.
 *
 * Extracted from GitRepoCard for better reusability.
 */

import Chip from '@mui/material/Chip';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SyncIcon from '@mui/icons-material/Sync';

import { GitRepo } from '../types';

/** Props for RepoStatusChip */
export interface RepoStatusChipProps {
  /** The GitRepo to display status for */
  repo: GitRepo;
}

/** State label mappings */
const STATE_LABELS: Record<string, string> = {
  'GitUpdating': 'Cloning...',
  'WaitApplied': 'Applying...',
  'Active': 'Deploying...',
  'Modified': 'Updating...',
};

/**
 * RepoStatusChip - Shows the current sync status of a GitRepo.
 *
 * Displays:
 * - Ready (green) - with resource count
 * - Error (red) - when there's an error
 * - Syncing states (blue) - GitUpdating, WaitApplied, Active, Modified
 * - Unknown - when status is not available
 */
export function RepoStatusChip({ repo }: RepoStatusChipProps) {
  if (!repo.status) {
    return <Chip label="Unknown" size="small" />;
  }

  if (repo.status.ready) {
    const resourceCount = repo.status.resources?.length || 0;
    return (
      <Chip
        label={`Ready${resourceCount > 0 ? ` (${resourceCount})` : ''}`}
        color="success"
        size="small"
        icon={<CheckCircleIcon />}
      />
    );
  }

  if (repo.status.display?.error) {
    return (
      <Chip
        label="Error"
        color="error"
        size="small"
        icon={<ErrorIcon />}
      />
    );
  }

  const state = repo.status.display?.state || 'Syncing';

  return (
    <Chip
      label={STATE_LABELS[state] || state}
      color="info"
      size="small"
      icon={
        <SyncIcon
          sx={{
            animation: 'spin 2s linear infinite',
            '@keyframes spin': {
              from: { transform: 'rotate(0deg)' },
              to: { transform: 'rotate(360deg)' },
            },
          }}
        />
      }
      title={repo.status.display?.message}
    />
  );
}

export default RepoStatusChip;
