/**
 * Credential service for managing authentication credentials.
 *
 * This service provides methods for storing and retrieving credentials
 * using host credential helpers (Keychain, Windows Credential Manager, etc.)
 * and integrating with the GitHub CLI.
 */

import { CommandExecutor } from './CommandExecutor';
import { HttpClient, FetchHttpClient } from './HttpClient';

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

/** GitHub user information */
export interface GitHubUser {
  login: string;
  name?: string;
  avatar_url?: string;
}

/** GitHub rate limit information */
export interface GitHubRateLimit {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}

/** Server URL for GitHub API credentials (PATs) - distinct from gh CLI's 'github.com' */
export const GITHUB_CREDENTIAL_SERVER = 'https://fleet-extension.rancherdesktop.io';

/** Marker username to indicate gh CLI auth is authorized */
const GH_CLI_AUTH_MARKER = '__gh-cli-authorized__';

/** Auth source type */
export type AuthSource = 'pat' | 'gh-cli' | 'none';

/**
 * Service for managing credentials stored in host credential helpers.
 */
export class CredentialService {
  private executor: CommandExecutor;
  private httpClient: HttpClient;

  constructor(executor: CommandExecutor, httpClient?: HttpClient) {
    this.executor = executor;
    this.httpClient = httpClient ?? new FetchHttpClient();
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
   * Validate a GitHub token and return user information
   */
  async validateGitHubToken(token: string): Promise<GitHubUser | null> {
    try {
      const response = await this.httpClient.get('https://api.github.com/user', {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      });

      if (!response.ok) {
        console.error('[CredentialService] GitHub token validation failed:', response.status);
        return null;
      }

      const user = await response.json() as Record<string, unknown>;
      return {
        login: user.login as string,
        name: user.name as string | undefined,
        avatar_url: user.avatar_url as string | undefined,
      };
    } catch (error) {
      console.error('[CredentialService] Error validating GitHub token:', error);
      return null;
    }
  }

  /**
   * Get GitHub API rate limit information
   */
  async getGitHubRateLimit(token?: string): Promise<GitHubRateLimit | null> {
    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await this.httpClient.get('https://api.github.com/rate_limit', headers);

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as { rate?: { limit: number; remaining: number; reset: number } };
      if (!data.rate) {
        return null;
      }

      return {
        limit: data.rate.limit,
        remaining: data.rate.remaining,
        reset: data.rate.reset,
      };
    } catch (error) {
      console.error('[CredentialService] Error getting rate limit:', error);
      return null;
    }
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
}

/**
 * Mock credential service for testing
 */
export class MockCredentialService extends CredentialService {
  private mockGhStatus: GhAuthStatus = { installed: false, authenticated: false };
  private mockGhToken: string | null = null;
  private mockCredHelperStatus: CredHelperStatus = { available: true, helper: 'mock', configured: true };
  private mockCredentials: Map<string, StoredCredential> = new Map();
  private mockGitHubUser: GitHubUser | null = null;
  private mockRateLimit: GitHubRateLimit | null = null;

  constructor() {
    // Create a mock executor that does nothing
    const mockExecutor = {
      exec: async () => ({ stdout: '', stderr: '' }),
    };
    super(mockExecutor);
  }

  setGhAuthStatus(status: GhAuthStatus): void {
    this.mockGhStatus = status;
  }

  setGhToken(token: string | null): void {
    this.mockGhToken = token;
  }

  setCredHelperStatus(status: CredHelperStatus): void {
    this.mockCredHelperStatus = status;
  }

  setGitHubUser(user: GitHubUser | null): void {
    this.mockGitHubUser = user;
  }

  setRateLimit(rateLimit: GitHubRateLimit | null): void {
    this.mockRateLimit = rateLimit;
  }

  async getGhAuthStatus(): Promise<GhAuthStatus> {
    return this.mockGhStatus;
  }

  async getGhToken(): Promise<string | null> {
    return this.mockGhToken;
  }

  async getCredHelperStatus(): Promise<CredHelperStatus> {
    return this.mockCredHelperStatus;
  }

  async storeCredential(server: string, username: string, secret: string): Promise<void> {
    this.mockCredentials.set(server, { ServerURL: server, Username: username, Secret: secret });
  }

  async getCredential(server: string): Promise<StoredCredential | null> {
    return this.mockCredentials.get(server) ?? null;
  }

  async deleteCredential(server: string): Promise<void> {
    this.mockCredentials.delete(server);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async validateGitHubToken(_token: string): Promise<GitHubUser | null> {
    return this.mockGitHubUser;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getGitHubRateLimit(_token?: string): Promise<GitHubRateLimit | null> {
    return this.mockRateLimit;
  }
}
