/**
 * FleetStatusCard component - Displays Fleet installation status.
 *
 * This is a pure presentational component that receives all data via props,
 * making it easily testable without complex mocking.
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SyncIcon from '@mui/icons-material/Sync';

import { FleetState } from '../types';
import { EditableTitle } from './EditableTitle';

/** Props for the FleetStatusCard component */
export interface FleetStatusCardProps {
  /** Current Fleet state */
  fleetState: FleetState;
  /** Whether Fleet is currently being installed */
  installing: boolean;
  /** Whether edit mode is active */
  editMode: boolean;
  /** Current card title */
  title: string;
  /** Error from repo operations */
  repoError: string | null;
  /** Callback when title changes */
  onTitleChange: (title: string) => void;
  /** Callback to install Fleet */
  onInstallFleet: () => void;
  /** Callback to clear repo error */
  onClearRepoError: () => void;
}

/** Render the status icon based on Fleet state */
function StatusIcon({ status }: { status: FleetState['status'] }) {
  switch (status) {
    case 'checking':
      return <CircularProgress size={24} />;
    case 'initializing':
      return (
        <SyncIcon
          color="info"
          sx={{
            animation: 'spin 2s linear infinite',
            '@keyframes spin': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' },
            },
          }}
        />
      );
    case 'running':
      return <CheckCircleIcon color="success" />;
    case 'error':
      return <ErrorIcon color="error" />;
    default:
      return null;
  }
}

/** Get status suffix text for the title */
function getStatusSuffix(fleetState: FleetState): string {
  switch (fleetState.status) {
    case 'running':
      return `: Running (${fleetState.version})`;
    case 'checking':
      return ': Checking...';
    case 'initializing':
      return ': Initializing...';
    case 'not-installed':
      return ': Not Installed';
    case 'error':
      return ': Error';
    default:
      return '';
  }
}

/**
 * FleetStatusCard - Displays Fleet installation status.
 *
 * This component is a pure presentational component that receives
 * all data and callbacks via props, making it fully testable.
 */
export function FleetStatusCard({
  fleetState,
  installing,
  editMode,
  title,
  repoError,
  onTitleChange,
  onInstallFleet,
  onClearRepoError,
}: FleetStatusCardProps) {
  const statusSuffix = getStatusSuffix(fleetState);

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: fleetState.status === 'running' ? 0 : 1 }}>
        <StatusIcon status={fleetState.status} />
        <EditableTitle
          value={title}
          editMode={editMode}
          onChange={onTitleChange}
          placeholder="Fleet Status"
        >
          {!editMode && statusSuffix}
        </EditableTitle>
        {editMode && <Typography variant="h6">{statusSuffix}</Typography>}
      </Box>

      {fleetState.status === 'initializing' && fleetState.message && (
        <Alert severity="info" sx={{ mt: 1 }}>
          {fleetState.message}
        </Alert>
      )}

      {fleetState.status === 'error' && fleetState.error && (
        <Alert severity="error" sx={{ mt: 1, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
          {fleetState.error}
        </Alert>
      )}

      {fleetState.status === 'not-installed' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
          <Button
            variant="contained"
            size="small"
            onClick={onInstallFleet}
            disabled={installing}
          >
            {installing ? 'Installing...' : 'Install Fleet'}
          </Button>
        </Box>
      )}

      {repoError && (
        <Alert severity="error" sx={{ mt: 1 }} onClose={onClearRepoError}>
          {repoError}
        </Alert>
      )}
    </>
  );
}

export default FleetStatusCard;
