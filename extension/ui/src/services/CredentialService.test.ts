/**
 * Tests for CredentialService
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CredentialService, GITHUB_CREDENTIAL_SERVER } from './CredentialService';
import { MockCommandExecutor } from '../test-utils';

describe('CredentialService', () => {
  let executor: MockCommandExecutor;
  let service: CredentialService;

  beforeEach(() => {
    executor = new MockCommandExecutor();
    service = new CredentialService(executor);
  });

  describe('getGhAuthStatus', () => {
    it('returns full status when gh CLI is authenticated', async () => {
      executor.mockCommandResponse('gh-auth-status', {
        stdout: JSON.stringify({
          installed: true,
          authenticated: true,
          user: 'testuser',
          debug: 'some debug info',
        }),
        stderr: '',
      });

      const status = await service.getGhAuthStatus();

      expect(status).toEqual({
        installed: true,
        authenticated: true,
        user: 'testuser',
        debug: 'some debug info',
      });
    });

    it('handles partial status with missing fields', async () => {
      executor.mockCommandResponse('gh-auth-status', {
        stdout: JSON.stringify({ installed: true }),
        stderr: '',
      });

      const status = await service.getGhAuthStatus();

      expect(status).toEqual({
        installed: true,
        authenticated: false,
        user: undefined,
        debug: undefined,
      });
    });

    it('returns default status on error', async () => {
      executor.mockCommandResponse('gh-auth-status', new Error('Command failed'));

      const status = await service.getGhAuthStatus();

      expect(status).toEqual({
        installed: false,
        authenticated: false,
      });
    });

    it('returns default status on invalid JSON', async () => {
      executor.mockCommandResponse('gh-auth-status', {
        stdout: 'not valid json',
        stderr: '',
      });

      const status = await service.getGhAuthStatus();

      expect(status).toEqual({
        installed: false,
        authenticated: false,
      });
    });
  });

  describe('getGhToken', () => {
    it('returns token on success', async () => {
      executor.mockCommandResponse('gh-token', {
        stdout: JSON.stringify({ token: 'ghp_test123' }),
        stderr: '',
      });

      const token = await service.getGhToken();

      expect(token).toBe('ghp_test123');
    });

    it('throws error when output is empty', async () => {
      executor.mockCommandResponse('gh-token', {
        stdout: '',
        stderr: '',
      });

      await expect(service.getGhToken()).rejects.toThrow('Failed to get gh token: gh-token returned empty output');
    });

    it('throws error on invalid JSON', async () => {
      executor.mockCommandResponse('gh-token', {
        stdout: 'not json',
        stderr: '',
      });

      await expect(service.getGhToken()).rejects.toThrow('Failed to get gh token: Invalid JSON from gh-token');
    });

    it('throws error with response error field', async () => {
      executor.mockCommandResponse('gh-token', {
        stdout: JSON.stringify({ error: 'Not authenticated' }),
        stderr: '',
      });

      await expect(service.getGhToken()).rejects.toThrow('Failed to get gh token: Not authenticated');
    });

    it('includes debug info in error when available', async () => {
      executor.mockCommandResponse('gh-token', {
        stdout: JSON.stringify({ error: 'Failed', debug: 'token expired' }),
        stderr: '',
      });

      await expect(service.getGhToken()).rejects.toThrow('Failed to get gh token: Failed (token expired)');
    });

    it('throws error when token is missing from response', async () => {
      executor.mockCommandResponse('gh-token', {
        stdout: JSON.stringify({ other: 'data' }),
        stderr: '',
      });

      await expect(service.getGhToken()).rejects.toThrow('Failed to get gh token: No token in response');
    });

    it('throws error when executor fails', async () => {
      executor.mockCommandResponse('gh-token', new Error('Execution failed'));

      await expect(service.getGhToken()).rejects.toThrow('Failed to get gh token: Execution failed');
    });
  });

  describe('getCredHelperStatus', () => {
    it('returns full status when credential helper is available', async () => {
      executor.mockCommandResponse('cred-helper-check', {
        stdout: JSON.stringify({
          available: true,
          helper: 'osxkeychain',
          configured: true,
          debug: 'found in PATH',
        }),
        stderr: '',
      });

      const status = await service.getCredHelperStatus();

      expect(status).toEqual({
        available: true,
        helper: 'osxkeychain',
        configured: true,
        debug: 'found in PATH',
      });
    });

    it('handles partial status with defaults', async () => {
      executor.mockCommandResponse('cred-helper-check', {
        stdout: JSON.stringify({ available: true }),
        stderr: '',
      });

      const status = await service.getCredHelperStatus();

      expect(status).toEqual({
        available: true,
        helper: '',
        configured: false,
        debug: undefined,
      });
    });

    it('returns error status on failure', async () => {
      executor.mockCommandResponse('cred-helper-check', new Error('Command not found'));

      const status = await service.getCredHelperStatus();

      expect(status.available).toBe(false);
      expect(status.helper).toBe('');
      expect(status.configured).toBe(false);
      expect(status.debug).toContain('Error');
    });
  });

  describe('storeCredential', () => {
    it('stores credential successfully', async () => {
      executor.mockCommandResponse('cred-store', {
        stdout: 'Credential stored successfully',
        stderr: '',
      });

      await expect(service.storeCredential('https://github.com', 'user', 'secret')).resolves.not.toThrow();

      const calls = executor.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].command).toBe('cred-store');
      expect(calls[0].args).toEqual(['https://github.com', 'user', 'secret']);
    });

    it('throws error on stderr without success message', async () => {
      executor.mockCommandResponse('cred-store', {
        stdout: '',
        stderr: 'Storage error occurred',
      });

      await expect(service.storeCredential('https://github.com', 'user', 'secret'))
        .rejects.toThrow('Storage error occurred');
    });

    it('succeeds when stderr present but success message in stdout', async () => {
      executor.mockCommandResponse('cred-store', {
        stdout: 'Credential stored successfully',
        stderr: 'Warning: something minor',
      });

      await expect(service.storeCredential('https://github.com', 'user', 'secret')).resolves.not.toThrow();
    });
  });

  describe('getCredential', () => {
    it('returns credential when found', async () => {
      executor.mockCommandResponse('cred-get', {
        stdout: JSON.stringify({ Username: 'testuser', Secret: 'testsecret' }),
        stderr: '',
      });

      const cred = await service.getCredential('https://github.com');

      expect(cred).toEqual({ Username: 'testuser', Secret: 'testsecret' });
    });

    it('returns null for empty output', async () => {
      executor.mockCommandResponse('cred-get', {
        stdout: '',
        stderr: '',
      });

      const cred = await service.getCredential('https://github.com');

      expect(cred).toBeNull();
    });

    it('returns null for empty object', async () => {
      executor.mockCommandResponse('cred-get', {
        stdout: '{}',
        stderr: '',
      });

      const cred = await service.getCredential('https://github.com');

      expect(cred).toBeNull();
    });

    it('returns null when username and secret are missing', async () => {
      executor.mockCommandResponse('cred-get', {
        stdout: JSON.stringify({ ServerURL: 'https://github.com' }),
        stderr: '',
      });

      const cred = await service.getCredential('https://github.com');

      expect(cred).toBeNull();
    });

    it('returns null on error', async () => {
      executor.mockCommandResponse('cred-get', new Error('Not found'));

      const cred = await service.getCredential('https://github.com');

      expect(cred).toBeNull();
    });
  });

  describe('deleteCredential', () => {
    it('deletes credential', async () => {
      executor.mockCommandResponse('cred-delete', {
        stdout: 'Deleted',
        stderr: '',
      });

      await service.deleteCredential('https://github.com');

      const calls = executor.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].command).toBe('cred-delete');
      expect(calls[0].args).toEqual(['https://github.com']);
    });
  });

  describe('getStoredGitHubToken', () => {
    it('returns token when credential exists', async () => {
      executor.mockResponse('cred-get', [GITHUB_CREDENTIAL_SERVER], {
        stdout: JSON.stringify({ Username: 'user', Secret: 'ghp_token123' }),
        stderr: '',
      });

      const token = await service.getStoredGitHubToken();

      expect(token).toBe('ghp_token123');
    });

    it('returns null when no credential exists', async () => {
      executor.mockResponse('cred-get', [GITHUB_CREDENTIAL_SERVER], {
        stdout: '{}',
        stderr: '',
      });

      const token = await service.getStoredGitHubToken();

      expect(token).toBeNull();
    });
  });

  describe('storeGitHubToken', () => {
    it('stores token with correct server URL', async () => {
      executor.mockCommandResponse('cred-store', {
        stdout: 'successfully',
        stderr: '',
      });

      await service.storeGitHubToken('ghp_token123', 'testuser');

      const calls = executor.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].args).toEqual([GITHUB_CREDENTIAL_SERVER, 'testuser', 'ghp_token123']);
    });
  });

  describe('deleteGitHubToken', () => {
    it('deletes token with correct server URL', async () => {
      executor.mockCommandResponse('cred-delete', {
        stdout: '',
        stderr: '',
      });

      await service.deleteGitHubToken();

      const calls = executor.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].args).toEqual([GITHUB_CREDENTIAL_SERVER]);
    });
  });

  describe('setAuthSource', () => {
    it('stores gh-cli marker for gh-cli source', async () => {
      executor.mockCommandResponse('cred-store', {
        stdout: 'successfully',
        stderr: '',
      });

      await service.setAuthSource('gh-cli');

      const calls = executor.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].args).toEqual([GITHUB_CREDENTIAL_SERVER, '__gh-cli-authorized__', '']);
    });

    it('stores gh-cli marker with username', async () => {
      executor.mockCommandResponse('cred-store', {
        stdout: 'successfully',
        stderr: '',
      });

      await service.setAuthSource('gh-cli', 'testuser');

      const calls = executor.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].args).toEqual([GITHUB_CREDENTIAL_SERVER, '__gh-cli-authorized__', 'testuser']);
    });

    it('deletes credential for none source', async () => {
      executor.mockCommandResponse('cred-delete', {
        stdout: '',
        stderr: '',
      });

      await service.setAuthSource('none');

      const calls = executor.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].command).toBe('cred-delete');
      expect(calls[0].args).toEqual([GITHUB_CREDENTIAL_SERVER]);
    });

    it('does nothing for pat source (token stored separately)', async () => {
      await service.setAuthSource('pat');

      const calls = executor.getCalls();
      expect(calls).toHaveLength(0);
    });
  });

  describe('getAuthSource', () => {
    it('returns none when no credential exists', async () => {
      executor.mockResponse('cred-get', [GITHUB_CREDENTIAL_SERVER], {
        stdout: '{}',
        stderr: '',
      });

      const result = await service.getAuthSource();

      expect(result).toEqual({ source: 'none' });
    });

    it('returns gh-cli when marker is stored', async () => {
      executor.mockResponse('cred-get', [GITHUB_CREDENTIAL_SERVER], {
        stdout: JSON.stringify({ Username: '__gh-cli-authorized__', Secret: '' }),
        stderr: '',
      });

      const result = await service.getAuthSource();

      expect(result).toEqual({ source: 'gh-cli', username: undefined });
    });

    it('returns gh-cli with username from Secret field', async () => {
      executor.mockResponse('cred-get', [GITHUB_CREDENTIAL_SERVER], {
        stdout: JSON.stringify({ Username: '__gh-cli-authorized__', Secret: 'testuser' }),
        stderr: '',
      });

      const result = await service.getAuthSource();

      expect(result).toEqual({ source: 'gh-cli', username: 'testuser' });
    });

    it('returns pat when real username is stored', async () => {
      executor.mockResponse('cred-get', [GITHUB_CREDENTIAL_SERVER], {
        stdout: JSON.stringify({ Username: 'realuser', Secret: 'ghp_token' }),
        stderr: '',
      });

      const result = await service.getAuthSource();

      expect(result).toEqual({ source: 'pat', username: 'realuser' });
    });
  });

  describe('getAvailableGitHubToken', () => {
    it('returns stored token with priority', async () => {
      executor.mockResponse('cred-get', [GITHUB_CREDENTIAL_SERVER], {
        stdout: JSON.stringify({ Username: 'user', Secret: 'stored_token' }),
        stderr: '',
      });

      const result = await service.getAvailableGitHubToken();

      expect(result).toEqual({ token: 'stored_token', source: 'stored' });
      // Should not have called gh-token
      const calls = executor.getCalls();
      expect(calls.every(c => c.command !== 'gh-token')).toBe(true);
    });

    it('falls back to gh CLI when no stored token', async () => {
      executor.mockResponse('cred-get', [GITHUB_CREDENTIAL_SERVER], {
        stdout: '{}',
        stderr: '',
      });
      executor.mockCommandResponse('gh-token', {
        stdout: JSON.stringify({ token: 'gh_cli_token' }),
        stderr: '',
      });

      const result = await service.getAvailableGitHubToken();

      expect(result).toEqual({ token: 'gh_cli_token', source: 'gh-cli' });
    });

    it('returns null when no token available', async () => {
      executor.mockResponse('cred-get', [GITHUB_CREDENTIAL_SERVER], {
        stdout: '{}',
        stderr: '',
      });
      executor.mockCommandResponse('gh-token', {
        stdout: JSON.stringify({ error: 'Not authenticated' }),
        stderr: '',
      });

      const result = await service.getAvailableGitHubToken();

      expect(result).toBeNull();
    });

    it('handles gh CLI error gracefully', async () => {
      executor.mockResponse('cred-get', [GITHUB_CREDENTIAL_SERVER], {
        stdout: '{}',
        stderr: '',
      });
      executor.mockCommandResponse('gh-token', new Error('gh not installed'));

      const result = await service.getAvailableGitHubToken();

      expect(result).toBeNull();
    });

    it('prefers stored token even when gh CLI is available', async () => {
      executor.mockResponse('cred-get', [GITHUB_CREDENTIAL_SERVER], {
        stdout: JSON.stringify({ Username: 'user', Secret: 'stored_token' }),
        stderr: '',
      });
      executor.mockCommandResponse('gh-token', {
        stdout: JSON.stringify({ token: 'gh_cli_token' }),
        stderr: '',
      });

      const result = await service.getAvailableGitHubToken();

      expect(result).toEqual({ token: 'stored_token', source: 'stored' });
    });
  });

  describe('GITHUB_CREDENTIAL_SERVER', () => {
    it('uses correct server URL for credentials', () => {
      expect(GITHUB_CREDENTIAL_SERVER).toBe('https://fleet-extension.rancherdesktop.io');
    });
  });
});
