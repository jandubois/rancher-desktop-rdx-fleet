/**
 * AppCo (SUSE Application Collection) service.
 *
 * Provides methods for interacting with the AppCo API to validate
 * credentials and access the application catalog. Uses injectable
 * HttpClient for testability.
 */

import { HttpClient, FetchHttpClient } from './HttpClient';

/** AppCo API base URL */
export const APPCO_API_BASE = 'https://api.apps.rancher.io';

/** AppCo OCI registry host */
export const APPCO_REGISTRY_HOST = 'dp.apps.rancher.io';

/** AppCo user information from API */
export interface AppCoUser {
  username: string;
  email?: string;
  accountType?: 'user' | 'service';
}

/** AppCo authentication status */
export interface AppCoAuthStatus {
  authenticated: boolean;
  user?: AppCoUser;
  error?: string;
}

/**
 * Service for AppCo (SUSE Application Collection) API operations.
 *
 * Uses injectable HttpClient for testability. All network operations
 * go through the httpClient, making it easy to mock for tests.
 */
export class AppCoService {
  private httpClient: HttpClient;

  constructor(httpClient?: HttpClient) {
    this.httpClient = httpClient ?? new FetchHttpClient();
  }

  /**
   * Create Basic auth header value from username and token
   */
  private createBasicAuthHeader(username: string, token: string): string {
    // Base64 encode "username:token"
    const credentials = btoa(`${username}:${token}`);
    return `Basic ${credentials}`;
  }

  /**
   * Validate AppCo credentials and return user information
   *
   * @param username - AppCo username or email
   * @param token - AppCo access token
   * @returns User info if valid, null if invalid
   */
  async validateCredentials(username: string, token: string): Promise<AppCoUser | null> {
    try {
      const response = await this.httpClient.get(`${APPCO_API_BASE}/v1/user`, {
        Authorization: this.createBasicAuthHeader(username, token),
        Accept: 'application/json',
      });

      if (!response.ok) {
        console.error('[AppCoService] Credential validation failed:', response.status);
        return null;
      }

      const data = await response.json() as Record<string, unknown>;

      // Extract user info from response
      // The API may return different fields, so we handle variations
      return {
        username: (data.username as string) || (data.login as string) || username,
        email: data.email as string | undefined,
        accountType: data.type === 'service' ? 'service' : 'user',
      };
    } catch (error) {
      console.error('[AppCoService] Error validating credentials:', error);
      return null;
    }
  }

  /**
   * Check authentication status with stored credentials
   *
   * @param username - AppCo username
   * @param token - AppCo access token
   * @returns Authentication status
   */
  async getAuthStatus(username: string, token: string): Promise<AppCoAuthStatus> {
    try {
      const user = await this.validateCredentials(username, token);

      if (user) {
        return {
          authenticated: true,
          user,
        };
      }

      return {
        authenticated: false,
        error: 'Invalid credentials',
      };
    } catch (error) {
      return {
        authenticated: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get catalog information (placeholder for future catalog browsing)
   *
   * @param username - AppCo username
   * @param token - AppCo access token
   * @returns Catalog data or null if unauthorized
   */
  async getCatalog(username: string, token: string): Promise<unknown | null> {
    try {
      const response = await this.httpClient.get(`${APPCO_API_BASE}/v1/apps`, {
        Authorization: this.createBasicAuthHeader(username, token),
        Accept: 'application/json',
      });

      if (!response.ok) {
        console.error('[AppCoService] Failed to fetch catalog:', response.status);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('[AppCoService] Error fetching catalog:', error);
      return null;
    }
  }
}
