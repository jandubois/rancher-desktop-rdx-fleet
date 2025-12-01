/* eslint-disable react-refresh/only-export-components */
/**
 * DependencyConfirmationDialog component - Confirms enabling paths with dependencies.
 *
 * This is a pure presentational component that receives all data via props,
 * making it easily testable without complex mocking.
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';

import { BundleInfo } from '../types';

/** State for the dependency dialog */
export interface DependencyDialogState {
  open: boolean;
  gitRepoName: string;
  path: string;
  willAutoSelect: BundleInfo[];
}

/** Initial/closed state for the dialog */
export const INITIAL_DEPENDENCY_DIALOG_STATE: DependencyDialogState = {
  open: false,
  gitRepoName: '',
  path: '',
  willAutoSelect: [],
};

/** Props for the DependencyConfirmationDialog component */
export interface DependencyConfirmationDialogProps {
  /** Current dialog state */
  state: DependencyDialogState;
  /** Callback when dialog is closed/cancelled */
  onClose: () => void;
  /** Callback when user confirms enabling dependencies */
  onConfirm: () => void;
}

/**
 * DependencyConfirmationDialog - Shows dependencies that will be enabled.
 *
 * When a user tries to enable a path that has dependencies, this dialog
 * shows them what other paths will also be enabled and asks for confirmation.
 */
export function DependencyConfirmationDialog({
  state,
  onClose,
  onConfirm,
}: DependencyConfirmationDialogProps) {
  return (
    <Dialog
      open={state.open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Enable Dependencies</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          The path <strong>{state.path}</strong> has dependencies that will also be enabled:
        </DialogContentText>
        <Box sx={{ pl: 2 }}>
          {state.willAutoSelect.map((dep) => (
            <Box key={dep.bundleName} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {dep.path}
              </Typography>
              {dep.gitRepoName !== state.gitRepoName && (
                <Chip
                  size="small"
                  label={dep.gitRepoName}
                  variant="outlined"
                  sx={{ height: 18, fontSize: '0.7rem' }}
                />
              )}
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" onClick={onConfirm}>
          Enable All
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DependencyConfirmationDialog;
