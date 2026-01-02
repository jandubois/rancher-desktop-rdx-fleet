/**
 * GitHub Authentication Card Component.
 *
 * Provides UI for authenticating with GitHub via gh CLI or Personal Access Token.
 * Uses AuthCardBase for common patterns and useGitHubAuth for provider-specific logic.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import GitHubIcon from '@mui/icons-material/GitHub';
import { CardProps } from './types';
import { AuthCardSettings } from '../manifest/types';
import { registerCard } from './registry';
import { AuthCardBase } from './AuthCardBase';
import {
  useGitHubAuth,
  RateLimitDisplay,
  GhCliAuthOption,
  PatInputForm,
  CredentialHelperWarning,
  GhCliStatusInfo,
} from './AuthGitHubCard/index';

export const AuthGitHubCard: React.FC<CardProps<AuthCardSettings>> = ({
  definition,
  settings,
  editMode = false,
  onSettingsChange,
}) => {
  const {
    authState,
    user,
    rateLimit,
    ghAuthStatus,
    credHelperStatus,
    error,
    isLoading,
    handleUseGhToken,
    handleSubmitPat,
    handleDisconnect,
    refreshRateLimit,
    setError,
  } = useGitHubAuth();

  const autoCollapse = settings?.auto_collapse ?? false;

  const handleAutoCollapseChange = (checked: boolean) => {
    if (onSettingsChange) {
      onSettingsChange({ ...settings, auto_collapse: checked });
    }
  };

  // Authenticated content: rate limit display
  const authenticatedContent = (
    <>
      {user?.name && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, mt: -1 }}>
          ({user.name})
        </Typography>
      )}
      {rateLimit && (
        <RateLimitDisplay
          rateLimit={rateLimit}
          onRefresh={refreshRateLimit}
          warningThreshold={100}
        />
      )}
    </>
  );

  // Unauthenticated content: gh CLI option + PAT form + rate limit
  const unauthenticatedContent = (
    <>
      {/* gh CLI status info */}
      {ghAuthStatus && <GhCliStatusInfo ghAuthStatus={ghAuthStatus} />}

      {/* gh CLI option */}
      {ghAuthStatus?.installed && ghAuthStatus?.authenticated && (
        <>
          <GhCliAuthOption
            ghAuthStatus={ghAuthStatus}
            onUseGhToken={handleUseGhToken}
            isLoading={isLoading}
          />

          <Divider sx={{ my: 2 }}>
            <Typography variant="caption" color="text.secondary">
              OR
            </Typography>
          </Divider>
        </>
      )}

      {/* PAT input */}
      <PatInputForm
        onSubmit={handleSubmitPat}
        isLoading={isLoading}
        disabled={!credHelperStatus?.available}
      />

      {/* Unauthenticated rate limit info */}
      {rateLimit && (
        <Box sx={{ mt: 2 }}>
          <RateLimitDisplay
            rateLimit={rateLimit}
            onRefresh={refreshRateLimit}
            warningThreshold={10}
            suffix="unauthenticated"
          />
        </Box>
      )}
    </>
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
      icon={<GitHubIcon sx={{ verticalAlign: 'middle' }} />}
      providerName="GitHub"
      userChipLabel={user ? `@${user.login}` : null}
      authenticatedContent={authenticatedContent}
      unauthenticatedContent={unauthenticatedContent}
      unauthenticatedDescription="Authenticate to increase API rate limits (60 → 5,000/hour) and access private repositories."
      credentialHelperWarning={credHelperStatus ? <CredentialHelperWarning credHelperStatus={credHelperStatus} /> : undefined}
    />
  );
};

// Register the auth-github card
registerCard('auth-github', AuthGitHubCard, {
  label: 'GitHub Authentication',
  orderable: true,
  category: 'auth',
  singleton: true,
  defaultSettings: () => ({ required: false, show_status: true, auto_collapse: false }),
});

export default AuthGitHubCard;
