import { useState, useCallback, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';

interface EditRepoDialogProps {
  open: boolean;
  currentName: string;
  currentUrl: string;
  currentBranch?: string;
  onClose: () => void;
  onSave: (oldName: string, newName: string, url: string, branch?: string) => Promise<void>;
}

export function EditRepoDialog({ open, currentName, currentUrl, currentBranch, onClose, onSave }: EditRepoDialogProps) {
  const [name, setName] = useState(currentName);
  const [url, setUrl] = useState(currentUrl);
  const [branch, setBranch] = useState(currentBranch || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens with new repo
  useEffect(() => {
    if (open) {
      setName(currentName);
      setUrl(currentUrl);
      setBranch(currentBranch || '');
      setError(null);
    }
  }, [open, currentName, currentUrl, currentBranch]);

  const handleClose = useCallback(() => {
    setError(null);
    onClose();
  }, [onClose]);

  const handleSave = useCallback(async () => {
    if (!name || !url) return;

    setSaving(true);
    setError(null);

    try {
      await onSave(currentName, name, url, branch || undefined);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  }, [currentName, name, url, branch, onSave, handleClose]);

  const hasChanges = name !== currentName || url !== currentUrl || branch !== (currentBranch || '');

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Edit Repository</DialogTitle>
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
            Changing the repository URL will clear all selected paths. You will need to
            rediscover and select paths from the new repository.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!name || !url || !hasChanges || saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
