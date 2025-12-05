/**
 * Credential service for managing authentication credentials.
 *
 * This service provides methods for storing and retrieving credentials
 * using host credential helpers (Keychain, Windows Credential Manager, etc.)
 * and integrating with the GitHub CLI.
 */

import { CommandExecutor } from './CommandExecutor';

/** GitHub CLI authentication status */
export interface GhAuthStatus {
  installed: boolean;
  authenticated: boolean;
  user?: string;
  debug?: string;  // Debug info for troubleshooting
}

/** Credential helper availability status */
export interface CredHelperStatus {
  available: boolean;
  helper: string;
  configured: boolean;
  debug?: string;  // Debug info for troubleshooting
}

/** Stored credential */
export interface StoredCredential {
  ServerURL?: string;
  Username: string;
  Secret: string;
}

/** Server URL for GitHub API credentials (PATs) - distinct from gh CLI's 'github.com' */
export const GITHUB_CREDENTIAL_SERVER = 'https://fleet-extension.rancherdesktop.io';

/** Server URL for AppCo credentials (OCI registry at dp.apps.rancher.io) */
export const APPCO_CREDENTIAL_SERVER = 'dp.apps.rancher.io';

/** Marker username to indicate gh CLI auth is authorized */
const GH_CLI_AUTH_MARKER = '__gh-cli-authorized__';

/** Auth source type */
export type AuthSource = 'pat' | 'gh-cli' | 'none';

/**
 * Service for managing credentials stored in host credential helpers.
 */
export class CredentialService {
  private executor: CommandExecutor;

  constructor(executor: CommandExecutor) {
    this.executor = executor;
  }

  /**
   * Check if gh CLI is installed and authenticated
   */
  async getGhAuthStatus(): Promise<GhAuthStatus> {
    try {
      const result = await this.executor.exec('gh-auth-status', []);
      const status = JSON.parse(result.stdout.trim());
      return {
        installed: status.installed ?? false,
        authenticated: status.authenticated ?? false,
        user: status.user,
        debug: status.debug,
      };
    } catch (error) {
      console.error('[CredentialService] Error checking gh auth status:', error);
      return { installed: false, authenticated: false };
    }
  }

  /**
   * Get GitHub token from gh CLI
   * @throws Error with message including debug info if token retrieval fails
   */
  async getGhToken(): Promise<string | null> {
    try {
      const result = await this.executor.exec('gh-token', []);
      const output = result.stdout.trim();

      if (!output) {
        throw new Error('gh-token returned empty output');
      }

      // Parse JSON response
      let response: { token?: string; error?: string; debug?: string };
      try {
        response = JSON.parse(output);
      } catch {
        throw new Error(`Invalid JSON from gh-token: ${output}`);
      }

      if (response.error) {
        throw new Error(`${response.error}${response.debug ? ` (${response.debug})` : ''}`);
      }

      if (!response.token) {
        throw new Error(`No token in response${response.debug ? ` (${response.debug})` : ''}`);
      }

      return response.token;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get gh token: ${message}`);
    }
  }

  /**
   * Check if a credential helper is available
   */
  async getCredHelperStatus(): Promise<CredHelperStatus> {
    try {
      const result = await this.executor.exec('cred-helper-check', []);
      const status = JSON.parse(result.stdout.trim());
      return {
        available: status.available ?? false,
        helper: status.helper ?? '',
        configured: status.configured ?? false,
        debug: status.debug,
      };
    } catch (error) {
      console.error('[CredentialService] Error checking credential helper:', error);
      return { available: false, helper: '', configured: false, debug: `Error: ${error}` };
    }
  }

  /**
   * Store a credential in the host credential helper
   */
  async storeCredential(server: string, username: string, secret: string): Promise<void> {
    const result = await this.executor.exec('cred-store', [server, username, secret]);
    if (result.stderr && !result.stdout.includes('successfully')) {
      throw new Error(result.stderr || 'Failed to store credential');
    }
  }

  /**
   * Get a credential from the host credential helper
   */
  async getCredential(server: string): Promise<StoredCredential | null> {
    try {
      const result = await this.executor.exec('cred-get', [server]);
      const output = result.stdout.trim();
      if (!output || output === '{}') {
        return null;
      }
      const cred = JSON.parse(output);
      if (!cred.Username && !cred.Secret) {
        return null;
      }
      return cred;
    } catch (error) {
      console.error('[CredentialService] Error getting credential:', error);
      return null;
    }
  }

  /**
   * Delete a credential from the host credential helper
   */
  async deleteCredential(server: string): Promise<void> {
    await this.executor.exec('cred-delete', [server]);
  }

  /**
   * Get the stored GitHub API token
   */
  async getStoredGitHubToken(): Promise<string | null> {
    const cred = await this.getCredential(GITHUB_CREDENTIAL_SERVER);
    return cred?.Secret ?? null;
  }

  /**
   * Store a GitHub API token
   */
  async storeGitHubToken(token: string, username: string): Promise<void> {
    await this.storeCredential(GITHUB_CREDENTIAL_SERVER, username, token);
  }

  /**
   * Delete the stored GitHub API token
   */
  async deleteGitHubToken(): Promise<void> {
    await this.deleteCredential(GITHUB_CREDENTIAL_SERVER);
  }

  /**
   * Set the auth source preference.
   * For 'gh-cli': stores a marker indicating gh CLI auth is authorized (token fetched fresh each time)
   * For 'pat': PAT should be stored separately via storeGitHubToken
   * For 'none': clears the preference
   */
  async setAuthSource(source: AuthSource, username?: string): Promise<void> {
    if (source === 'gh-cli') {
      // Store marker with username but no token - indicates "use gh CLI"
      await this.storeCredential(GITHUB_CREDENTIAL_SERVER, GH_CLI_AUTH_MARKER, username || '');
    } else if (source === 'none') {
      // Clear any stored preference/token
      await this.deleteCredential(GITHUB_CREDENTIAL_SERVER);
    }
    // For 'pat', the token is stored via storeGitHubToken which sets a real username
  }

  /**
   * Get the current auth source preference.
   * Returns 'gh-cli' if user authorized gh CLI, 'pat' if a PAT is stored, 'none' otherwise.
   */
  async getAuthSource(): Promise<{ source: AuthSource; username?: string }> {
    const cred = await this.getCredential(GITHUB_CREDENTIAL_SERVER);
    if (!cred) {
      return { source: 'none' };
    }
    if (cred.Username === GH_CLI_AUTH_MARKER) {
      // gh CLI auth - Secret contains the cached username
      return { source: 'gh-cli', username: cred.Secret || undefined };
    }
    // PAT auth - Username is the GitHub username, Secret is the token
    return { source: 'pat', username: cred.Username };
  }

  /**
   * Get a GitHub token from any available source
   * Priority: 1. Stored credential, 2. gh CLI
   */
  async getAvailableGitHubToken(): Promise<{ token: string; source: 'stored' | 'gh-cli' } | null> {
    // First check stored credential
    const storedToken = await this.getStoredGitHubToken();
    if (storedToken) {
      return { token: storedToken, source: 'stored' };
    }

    // Fall back to gh CLI - let errors propagate so caller can handle them
    try {
      const ghToken = await this.getGhToken();
      if (ghToken) {
        return { token: ghToken, source: 'gh-cli' };
      }
    } catch {
      // gh CLI not available or not authenticated, that's ok
    }

    return null;
  }

  // ============================================
  // AppCo Credential Methods
  // ============================================

  /**
   * Get stored AppCo credentials
   */
  async getAppCoCredential(): Promise<StoredCredential | null> {
    return this.getCredential(APPCO_CREDENTIAL_SERVER);
  }

  /**
   * Store AppCo credentials
   * Uses the standard credential helper which also enables `docker pull dp.apps.rancher.io/...`
   */
  async storeAppCoCredential(username: string, token: string): Promise<void> {
    await this.storeCredential(APPCO_CREDENTIAL_SERVER, username, token);
  }

  /**
   * Delete stored AppCo credentials
   */
  async deleteAppCoCredential(): Promise<void> {
    await this.deleteCredential(APPCO_CREDENTIAL_SERVER);
  }

  /**
   * Check if AppCo credentials are stored
   */
  async hasAppCoCredential(): Promise<boolean> {
    const cred = await this.getAppCoCredential();
    return cred !== null && !!cred.Username && !!cred.Secret;
  }

  // ============================================
  // Helm Registry Methods
  // ============================================

  /**
   * Log in to a Helm OCI registry.
   * This enables `helm pull oci://<registry>/...` commands.
   *
   * @param registry Registry server URL (e.g., 'dp.apps.rancher.io')
   * @param username Registry username
   * @param password Registry password/token
   */
  async helmRegistryLogin(registry: string, username: string, password: string): Promise<void> {
    try {
      const result = await this.executor.exec('helm-registry-login', [registry, username, password]);
      const output = result.stdout.trim();

      if (output) {
        try {
          const response = JSON.parse(output);
          if (response.error) {
            throw new Error(response.error);
          }
        } catch {
          // If output isn't JSON, check for success indicators
          if (!output.includes('Login Succeeded') && !output.includes('success')) {
            console.warn('[CredentialService] Unexpected helm-registry-login output:', output);
          }
        }
      }

      if (result.stderr && result.stderr.includes('error')) {
        throw new Error(result.stderr);
      }
    } catch (error) {
      console.error('[CredentialService] Error logging into helm registry:', error);
      throw error;
    }
  }

  /**
   * Log out from a Helm OCI registry.
   *
   * @param registry Registry server URL (e.g., 'dp.apps.rancher.io')
   */
  async helmRegistryLogout(registry: string): Promise<void> {
    try {
      const result = await this.executor.exec('helm-registry-logout', [registry]);
      // Logout may fail if not logged in, which is fine
      if (result.stderr && result.stderr.includes('error') && !result.stderr.includes('not logged in')) {
        console.warn('[CredentialService] helm-registry-logout warning:', result.stderr);
      }
    } catch (error) {
      // Logout errors are usually not critical
      console.warn('[CredentialService] Error logging out of helm registry:', error);
    }
  }

  /**
   * Log in to AppCo Helm registry.
   * This is a convenience method for the AppCo OCI registry.
   */
  async helmRegistryLoginAppCo(username: string, password: string): Promise<void> {
    await this.helmRegistryLogin(APPCO_CREDENTIAL_SERVER, username, password);
  }

  /**
   * Log out from AppCo Helm registry.
   */
  async helmRegistryLogoutAppCo(): Promise<void> {
    await this.helmRegistryLogout(APPCO_CREDENTIAL_SERVER);
  }
}
