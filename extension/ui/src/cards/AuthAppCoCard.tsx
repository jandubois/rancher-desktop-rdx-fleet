/**
 * AppCo (SUSE Application Collection) Authentication Card Component.
 *
 * Provides UI for authenticating with AppCo to access the application catalog
 * and pull Helm charts/container images from dp.apps.rancher.io.
 * Uses AuthCardBase for common patterns and useAppCoAuth for provider-specific logic.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { SuseGeekoIcon } from '../components/icons/SuseGeekoIcon';
import { CardProps } from './types';
import { AppCoCardSettings } from '../manifest/types';
import { registerCard } from './registry';
import { AuthCardBase } from './AuthCardBase';
import { CredentialHelperWarning } from './AuthGitHubCard/StatusAlerts';
import { useAppCoAuth, AppCoInputForm } from './AuthAppCoCard/index';

/** AppCo catalog URL */
const APPCO_CATALOG_URL = 'https://apps.rancher.io';

export const AuthAppCoCard: React.FC<CardProps<AppCoCardSettings>> = ({
  definition,
  settings,
  editMode = false,
  onSettingsChange,
}) => {
  const {
    authState,
    user,
    credHelperStatus,
    error,
    isLoading,
    handleSubmitCredentials,
    handleDisconnect,
    setError,
  } = useAppCoAuth();

  const autoCollapse = settings?.auto_collapse ?? false;

  const handleAutoCollapseChange = (checked: boolean) => {
    if (onSettingsChange) {
      onSettingsChange({ ...settings, auto_collapse: checked });
    }
  };

  // Authenticated alert content: username, email, account type
  const authenticatedAlertContent = user && (
    <Box>
      <Typography variant="body2">
        Authenticated as <strong>{user.username}</strong>
        {user.email && user.email !== user.username && (
          <Typography component="span" color="text.secondary">
            {' '}({user.email})
          </Typography>
        )}
      </Typography>
      {user.accountType && (
        <Typography variant="caption" color="text.secondary">
          Account type: {user.accountType}
        </Typography>
      )}
    </Box>
  );

  // Authenticated content: registry info and catalog link
  const authenticatedContent = (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        You can now pull Helm charts and container images from <code>dp.apps.rancher.io</code>
      </Typography>

      <Link
        href={APPCO_CATALOG_URL}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
      >
        <Typography variant="body2">Browse Application Catalog</Typography>
        <OpenInNewIcon fontSize="small" />
      </Link>
    </>
  );

  // Unauthenticated content: credential input form
  const unauthenticatedContent = (
    <AppCoInputForm
      onSubmit={handleSubmitCredentials}
      isLoading={isLoading}
      disabled={!credHelperStatus?.available}
    />
  );

  return (
    <AuthCardBase
      definition={definition}
      editMode={editMode}
      autoCollapse={autoCollapse}
      onAutoCollapseChange={onSettingsChange ? handleAutoCollapseChange : undefined}
      authState={authState}
      error={error}
      isLoading={isLoading}
      credHelperStatus={credHelperStatus}
      setError={setError}
      onDisconnect={handleDisconnect}
      icon={<SuseGeekoIcon sx={{ verticalAlign: 'middle', height: '1.25em', width: 'auto' }} />}
      providerName="AppCo"
      userChipLabel={user?.username ?? null}
      authenticatedAlertContent={authenticatedAlertContent}
      authenticatedContent={authenticatedContent}
      unauthenticatedContent={unauthenticatedContent}
      unauthenticatedDescription="Authenticate with SUSE Application Collection to access Helm charts and container images."
      credentialHelperWarning={credHelperStatus ? <CredentialHelperWarning credHelperStatus={credHelperStatus} /> : undefined}
    />
  );
};

// Register the auth-appco card
registerCard('auth-appco', AuthAppCoCard, {
  label: 'SUSE Application Collection Authentication',
  orderable: true,
  category: 'auth',
  singleton: true,
  defaultSettings: () => ({ required: false, show_status: true, auto_collapse: false } as AppCoCardSettings),
});

export default AuthAppCoCard;
