/**
 * Mock implementations for testing.
 *
 * These mocks are moved from the production service files to keep
 * production code clean and focused.
 */

import type { CommandExecutor, ExecResult } from '../services/CommandExecutor';
import type { HttpClient, HttpResponse } from '../services/HttpClient';
import type { GhAuthStatus, CredHelperStatus, StoredCredential } from '../services/CredentialService';
import { CredentialService } from '../services/CredentialService';

/**
 * Mock executor for testing.
 * Allows setting up expected command responses.
 */
export class MockCommandExecutor implements CommandExecutor {
  private responses: Map<string, ExecResult | Error> = new Map();
  private calls: Array<{ command: string; args: string[] }> = [];

  /**
   * Set up a mock response for a specific command
   * @param command Command string (e.g., 'kubectl')
   * @param args Expected arguments
   * @param response Response to return or Error to throw
   */
  mockResponse(command: string, args: string[], response: ExecResult | Error): void {
    const key = this.makeKey(command, args);
    this.responses.set(key, response);
  }

  /**
   * Set up a mock response that matches any args for a command
   */
  mockCommandResponse(command: string, response: ExecResult | Error): void {
    this.responses.set(`${command}:*`, response);
  }

  async exec(command: string, args: string[]): Promise<ExecResult> {
    this.calls.push({ command, args });

    // Try exact match first
    const key = this.makeKey(command, args);
    let response = this.responses.get(key);

    // Fall back to wildcard match
    if (!response) {
      response = this.responses.get(`${command}:*`);
    }

    if (!response) {
      return { stdout: '', stderr: '' };
    }

    if (response instanceof Error) {
      throw response;
    }

    return response;
  }

  /** Get all recorded calls */
  getCalls(): Array<{ command: string; args: string[] }> {
    return [...this.calls];
  }

  /** Clear recorded calls */
  clearCalls(): void {
    this.calls = [];
  }

  /** Reset all mocks and calls */
  reset(): void {
    this.responses.clear();
    this.calls = [];
  }

  private makeKey(command: string, args: string[]): string {
    return `${command}:${JSON.stringify(args)}`;
  }
}

/**
 * Mock HTTP client for testing.
 * Allows setting up expected responses for specific URLs.
 */
export class MockHttpClient implements HttpClient {
  private responses: Map<string, HttpResponse | Error> = new Map();
  private calls: string[] = [];

  /**
   * Set up a mock response for a specific URL
   */
  mockResponse(url: string, response: HttpResponse | Error): void {
    this.responses.set(url, response);
  }

  /**
   * Set up a mock response that matches URLs by pattern
   */
  mockPattern(pattern: RegExp, response: HttpResponse | Error): void {
    // Store pattern matches with a special key format
    this.responses.set(`__pattern__${pattern.source}`, response);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async get(url: string, _headers?: Record<string, string>): Promise<HttpResponse> {
    this.calls.push(url);

    // Check exact match first
    const exactResponse = this.responses.get(url);
    if (exactResponse) {
      if (exactResponse instanceof Error) {
        throw exactResponse;
      }
      return exactResponse;
    }

    // Check pattern matches
    for (const [key, response] of this.responses) {
      if (key.startsWith('__pattern__')) {
        const pattern = new RegExp(key.replace('__pattern__', ''));
        if (pattern.test(url)) {
          if (response instanceof Error) {
            throw response;
          }
          return response;
        }
      }
    }

    // Default response
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: { get: () => null },
      text: async () => 'Not Found',
      json: async () => ({ error: 'Not Found' }),
    };
  }

  /** Get all recorded calls */
  getCalls(): string[] {
    return [...this.calls];
  }

  /** Clear recorded calls */
  clearCalls(): void {
    this.calls = [];
  }

  /** Reset all mocks and calls */
  reset(): void {
    this.responses.clear();
    this.calls = [];
  }
}

/**
 * Create a mock HTTP response helper
 */
export function createMockResponse(options: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string | object;
}): HttpResponse {
  const {
    ok = true,
    status = 200,
    statusText = 'OK',
    headers = {},
    body = '',
  } = options;

  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

  return {
    ok,
    status,
    statusText,
    headers: {
      get: (name: string) => headers[name] ?? null,
    },
    text: async () => bodyStr,
    json: async () => typeof body === 'string' ? JSON.parse(body) : body,
  };
}

/**
 * Mock credential service for testing
 */
export class MockCredentialService extends CredentialService {
  private mockGhStatus: GhAuthStatus = { installed: false, authenticated: false };
  private mockGhToken: string | null = null;
  private mockCredHelperStatus: CredHelperStatus = { available: true, helper: 'mock', configured: true };
  private mockCredentials: Map<string, StoredCredential> = new Map();

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
}
