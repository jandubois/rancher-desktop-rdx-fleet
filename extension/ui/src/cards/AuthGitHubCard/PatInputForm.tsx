/**
 * Personal Access Token input form component.
 *
 * Provides UI for entering and submitting a GitHub PAT.
 */

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import KeyIcon from '@mui/icons-material/Key';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

/** GitHub token creation URL with recommended scopes */
const GITHUB_TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=repo,read:org&description=Fleet+Extension';

interface PatInputFormProps {
  onSubmit: (token: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export const PatInputForm: React.FC<PatInputFormProps> = ({
  onSubmit,
  isLoading,
  disabled = false,
}) => {
  const [patInput, setPatInput] = useState('');

  const handleSubmit = () => {
    if (patInput.trim()) {
      onSubmit(patInput.trim());
      setPatInput(''); // Clear input after submission
    }
  };

  return (
    <Box
      sx={{
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <KeyIcon color="primary" />
        <Typography variant="subtitle2">Personal Access Token</Typography>
      </Box>

      <TextField
        fullWidth
        type="password"
        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
        value={patInput}
        onChange={(e) => setPatInput(e.target.value)}
        size="small"
        sx={{ mb: 1.5 }}
        disabled={isLoading || disabled}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleSubmit();
          }
        }}
      />

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Recommended scopes: <code>public_repo</code> (rate limits) or <code>repo</code> (private repos), <code>read:org</code>
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isLoading || !patInput.trim() || disabled}
          size="small"
        >
          {isLoading ? 'Saving...' : 'Save Token'}
        </Button>

        <Link
          href={GITHUB_TOKEN_URL}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <Typography variant="body2">Create token on GitHub</Typography>
          <OpenInNewIcon fontSize="small" />
        </Link>
      </Box>
    </Box>
  );
};

export default PatInputForm;
