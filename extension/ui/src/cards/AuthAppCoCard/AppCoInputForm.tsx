/**
 * AppCo credential input form component.
 *
 * Provides UI for entering and submitting AppCo username and access token.
 */

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import KeyIcon from '@mui/icons-material/Key';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

/** AppCo documentation URL */
const APPCO_DOCS_URL = 'https://apps.rancher.io/docs';

/** AppCo sign up/login URL */
const APPCO_LOGIN_URL = 'https://apps.rancher.io';

interface AppCoInputFormProps {
  onSubmit: (username: string, token: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export const AppCoInputForm: React.FC<AppCoInputFormProps> = ({
  onSubmit,
  isLoading,
  disabled = false,
}) => {
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');

  const handleSubmit = () => {
    if (username.trim() && token.trim()) {
      onSubmit(username.trim(), token.trim());
      setToken(''); // Clear token after submission (keep username for retry)
    }
  };

  const canSubmit = username.trim() && token.trim() && !isLoading && !disabled;

  return (
    <Box
      sx={{
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <KeyIcon color="primary" />
        <Typography variant="subtitle2">AppCo Credentials</Typography>
      </Box>

      <TextField
        fullWidth
        label="Username or Email"
        placeholder="user@example.com"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        size="small"
        sx={{ mb: 2 }}
        disabled={isLoading || disabled}
        autoComplete="username"
      />

      <TextField
        fullWidth
        type="password"
        label="Access Token"
        placeholder="Enter your access token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        size="small"
        sx={{ mb: 1.5 }}
        disabled={isLoading || disabled}
        autoComplete="current-password"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canSubmit) {
            handleSubmit();
          }
        }}
      />

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Use your SUSE Application Collection account credentials or a service account token.
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!canSubmit}
          size="small"
        >
          {isLoading ? 'Authenticating...' : 'Authenticate'}
        </Button>

        <Link
          href={APPCO_LOGIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <Typography variant="body2">Get Account</Typography>
          <OpenInNewIcon fontSize="small" />
        </Link>

        <Link
          href={APPCO_DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <Typography variant="body2">Documentation</Typography>
          <OpenInNewIcon fontSize="small" />
        </Link>
      </Box>
    </Box>
  );
};

export default AppCoInputForm;
