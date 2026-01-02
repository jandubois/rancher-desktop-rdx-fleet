import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import { AddGitRepoResult } from '../types';

interface AddRepoDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, url: string, branch?: string) => Promise<AddGitRepoResult>;
}

export function AddRepoDialog({ open, onClose, onAdd }: AddRepoDialogProps) {
  const [name, setName] = useState('test-bundles');
  const [url, setUrl] = useState('https://github.com/jandubois/rancher-desktop-rdx-fleet');
  const [branch, setBranch] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form to defaults when dialog opens
  const handleEnter = useCallback(() => {
    setName('test-bundles');
    setUrl('https://github.com/jandubois/rancher-desktop-rdx-fleet');
    setBranch('');
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    setError(null);
    onClose();
  }, [onClose]);

  const handleAdd = useCallback(async () => {
    if (!name || !url) return;

    setAdding(true);
    setError(null);

    try {
      const result = await onAdd(name, url, branch || undefined);
      if (result.success) {
        handleClose();
      } else {
        setError(result.error || 'Failed to add repository. Please check the details and try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setAdding(false);
    }
  }, [name, url, branch, onAdd, handleClose]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      TransitionProps={{ onEnter: handleEnter }}
    >
      <DialogTitle>Add Git Repository</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-app"
            helperText="Unique name for this GitRepo resource"
            required
            fullWidth
          />
          <TextField
            label="Repository URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/org/repo"
            helperText="Git repository URL (HTTPS)"
            required
            fullWidth
          />
          <TextField
            label="Branch"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
            helperText="Branch to track (leave empty for default)"
            fullWidth
          />
          <Typography variant="body2" color="text.secondary">
            After adding the repository, available paths will be discovered automatically.
            You can then select which paths to deploy from the repository card.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          Cancel
        </Button>
        <Button
          onClick={handleAdd}
          variant="contained"
          disabled={!name || !url || adding}
        >
          {adding ? 'Adding...' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
