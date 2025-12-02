/**
 * Tests for useGitHubAuth hook
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import { ReactNode } from 'react';
import { useGitHubAuth } from './useGitHubAuth';
import { TestServiceProvider, MockCredentialService, MockHttpClient, createMockResponse } from '../../test-utils';
import { GitHubService } from '../../services';

describe('useGitHubAuth', () => {
  let mockCredentialService: MockCredentialService;
  let mockHttpClient: MockHttpClient;
  let gitHubService: GitHubService;

  beforeEach(() => {
    mockCredentialService = new MockCredentialService();
    mockHttpClient = new MockHttpClient();
    gitHubService = new GitHubService(mockHttpClient);

    // Setup default credential helper status as available
    mockCredentialService.setCredHelperStatus({
      available: true,
      helper: 'secretservice',
      configured: true,
    });

    // Setup default unauthenticated rate limit response
    mockHttpClient.mockResponse('https://api.github.com/rate_limit', createMockResponse({
      body: {
        resources: { core: { limit: 60, remaining: 60, reset: Math.floor(Date.now() / 1000) + 3600 } },
      },
    }));
  });

  afterEach(() => {
    cleanup();
    mockHttpClient.reset();
  });

  const createWrapper = () => {
    return ({ children }: { children: ReactNode }) => (
      <TestServiceProvider
        services={{
          credentialService: mockCredentialService,
          gitHubService,
        }}
      >
        {children}
      </TestServiceProvider>
    );
  };

  describe('initial state loading', () => {
    it('starts with loading state', () => {
      mockCredentialService.setGhAuthStatus({ installed: false, authenticated: false });

      const { result } = renderHook(() => useGitHubAuth(), { wrapper: createWrapper() });

      // Initial state should be loading
      expect(result.current.authState).toBe('loading');
    });

    it('loads unauthenticated state when no auth source', async () => {
      mockCredentialService.setGhAuthStatus({ installed: false, authenticated: false });

      const { result } = renderHook(() => useGitHubAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      expect(result.current.user).toBeNull();
      expect(result.current.ghAuthStatus).toEqual({ installed: false, authenticated: false });
      expect(result.current.credHelperStatus?.available).toBe(true);
    });

    it('loads authenticated state with PAT auth source', async () => {
      mockCredentialService.setGhAuthStatus({ installed: false, authenticated: false });

      // Store a PAT
      await mockCredentialService.storeGitHubToken('ghp_test123', 'testuser');

      // Mock validate token
      mockHttpClient.mockResponse('https://api.github.com/user', createMockResponse({
        body: { login: 'testuser', name: 'Test User', avatar_url: 'https://example.com/avatar.jpg' },
      }));

      // Mock authenticated rate limit
      mockHttpClient.mockResponse('https://api.github.com/rate_limit', createMockResponse({
        body: {
          resources: { core: { limit: 5000, remaining: 4999, reset: Math.floor(Date.now() / 1000) + 3600 } },
        },
      }));

      const { result } = renderHook(() => useGitHubAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.authState).toBe('authenticated');
      });

      expect(result.current.user?.login).toBe('testuser');
    });

    it('loads authenticated state with gh-cli auth source', async () => {
      mockCredentialService.setGhAuthStatus({ installed: true, authenticated: true, user: 'ghuser' });
      mockCredentialService.setGhToken('ghp_ghclitoken');

      // Set auth source to gh-cli
      await mockCredentialService.setAuthSource('gh-cli', 'ghuser');

      // Mock validate token
      mockHttpClient.mockResponse('https://api.github.com/user', createMockResponse({
        body: { login: 'ghuser', name: 'GH User' },
      }));

      // Mock authenticated rate limit
      mockHttpClient.mockResponse('https://api.github.com/rate_limit', createMockResponse({
        body: {
          resources: { core: { limit: 5000, remaining: 4500, reset: Math.floor(Date.now() / 1000) + 3600 } },
        },
      }));

      const { result } = renderHook(() => useGitHubAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.authState).toBe('authenticated');
      });

      expect(result.current.user?.login).toBe('ghuser');
    });

    it('falls back to unauthenticated when gh-cli token fails', async () => {
      mockCredentialService.setGhAuthStatus({ installed: true, authenticated: true, user: 'ghuser' });
      mockCredentialService.setGhToken(null); // No token available

      // Set auth source to gh-cli
      await mockCredentialService.setAuthSource('gh-cli', 'ghuser');

      const { result } = renderHook(() => useGitHubAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });
    });

    it('deletes invalid PAT and falls back to unauthenticated', async () => {
      mockCredentialService.setGhAuthStatus({ installed: false, authenticated: false });

      // Store a PAT
      await mockCredentialService.storeGitHubToken('invalid_token', 'testuser');

      // Mock validate token - returns 401
      mockHttpClient.mockResponse('https://api.github.com/user', createMockResponse({
        ok: false,
        status: 401,
        body: { message: 'Bad credentials' },
      }));

      const { result } = renderHook(() => useGitHubAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      // Token should have been deleted
      const storedToken = await mockCredentialService.getStoredGitHubToken();
      expect(storedToken).toBeNull();
    });
  });

  describe('handleUseGhToken', () => {
    beforeEach(() => {
      mockCredentialService.setGhAuthStatus({ installed: true, authenticated: true, user: 'ghuser' });
    });

    it('authenticates with gh CLI token', async () => {
      mockCredentialService.setGhToken('ghp_clitoken');

      // Mock validate token
      mockHttpClient.mockResponse('https://api.github.com/user', createMockResponse({
        body: { login: 'ghuser', name: 'GH User' },
      }));

      // Mock authenticated rate limit
      mockHttpClient.mockResponse('https://api.github.com/rate_limit', createMockResponse({
        body: {
          resources: { core: { limit: 5000, remaining: 4999, reset: Math.floor(Date.now() / 1000) + 3600 } },
        },
      }));

      const { result } = renderHook(() => useGitHubAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      await act(async () => {
        await result.current.handleUseGhToken();
      });

      expect(result.current.authState).toBe('authenticated');
      expect(result.current.user?.login).toBe('ghuser');
      expect(result.current.error).toBeNull();
    });

    it('sets error when no token from gh CLI', async () => {
      mockCredentialService.setGhToken(null);

      const { result } = renderHook(() => useGitHubAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      await act(async () => {
        await result.current.handleUseGhToken();
      });

      expect(result.current.error).toBe('Failed to get token from gh CLI');
      expect(result.current.authState).toBe('unauthenticated');
    });

    it('sets error when token validation fails', async () => {
      mockCredentialService.setGhToken('ghp_badtoken');

      // Mock validate token - returns null (invalid)
      mockHttpClient.mockResponse('https://api.github.com/user', createMockResponse({
        ok: false,
        status: 401,
        body: { message: 'Bad credentials' },
      }));

      const { result } = renderHook(() => useGitHubAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      await act(async () => {
        await result.current.handleUseGhToken();
      });

      expect(result.current.error).toBe('Token validation failed');
    });
  });

  describe('handleSubmitPat', () => {
    beforeEach(() => {
      mockCredentialService.setGhAuthStatus({ installed: false, authenticated: false });
    });

    it('authenticates with valid PAT', async () => {
      // Mock validate token
      mockHttpClient.mockResponse('https://api.github.com/user', createMockResponse({
        body: { login: 'patuser', name: 'PAT User' },
      }));

      // Mock authenticated rate limit
      mockHttpClient.mockResponse('https://api.github.com/rate_limit', createMockResponse({
        body: {
          resources: { core: { limit: 5000, remaining: 4999, reset: Math.floor(Date.now() / 1000) + 3600 } },
        },
      }));

      const { result } = renderHook(() => useGitHubAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      await act(async () => {
        await result.current.handleSubmitPat('ghp_valid_token');
      });

      expect(result.current.authState).toBe('authenticated');
      expect(result.current.user?.login).toBe('patuser');
      expect(result.current.error).toBeNull();

      // Verify token was stored
      const storedToken = await mockCredentialService.getStoredGitHubToken();
      expect(storedToken).toBe('ghp_valid_token');
    });

    it('sets error for empty token', async () => {
      const { result } = renderHook(() => useGitHubAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      await act(async () => {
        await result.current.handleSubmitPat('');
      });

      expect(result.current.error).toBe('Please enter a token');
    });

    it('sets error for whitespace-only token', async () => {
      const { result } = renderHook(() => useGitHubAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      await act(async () => {
        await result.current.handleSubmitPat('   ');
      });

      expect(result.current.error).toBe('Please enter a token');
    });

    it('sets error for invalid token', async () => {
      // Mock validate token - fails
      mockHttpClient.mockResponse('https://api.github.com/user', createMockResponse({
        ok: false,
        status: 401,
        body: { message: 'Bad credentials' },
      }));

      const { result } = renderHook(() => useGitHubAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      await act(async () => {
        await result.current.handleSubmitPat('invalid_token');
      });

      expect(result.current.error).toBe('Invalid token. Please check and try again.');
    });

    it('sets error when credential helper not available', async () => {
      mockCredentialService.setCredHelperStatus({
        available: false,
        helper: '',
        configured: false,
      });

      // Mock validate token - succeeds
      mockHttpClient.mockResponse('https://api.github.com/user', createMockResponse({
        body: { login: 'user' },
      }));

      const { result } = renderHook(() => useGitHubAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      await act(async () => {
        await result.current.handleSubmitPat('ghp_valid_token');
      });

      expect(result.current.error).toContain('No credential helper available');
    });

    it('trims whitespace from token', async () => {
      mockHttpClient.mockResponse('https://api.github.com/user', createMockResponse({
        body: { login: 'user' },
      }));

      mockHttpClient.mockResponse('https://api.github.com/rate_limit', createMockResponse({
        body: {
          resources: { core: { limit: 5000, remaining: 5000, reset: Math.floor(Date.now() / 1000) + 3600 } },
        },
      }));

      const { result } = renderHook(() => useGitHubAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      await act(async () => {
        await result.current.handleSubmitPat('  ghp_token_with_spaces  ');
      });

      expect(result.current.authState).toBe('authenticated');

      // Verify trimmed token was stored
      const storedToken = await mockCredentialService.getStoredGitHubToken();
      expect(storedToken).toBe('ghp_token_with_spaces');
    });
  });

  describe('handleDisconnect', () => {
    it('disconnects and clears auth state', async () => {
      mockCredentialService.setGhAuthStatus({ installed: true, authenticated: true, user: 'ghuser' });
      mockCredentialService.setGhToken('ghp_token');
      await mockCredentialService.setAuthSource('gh-cli', 'ghuser');

      // Mock for initial authenticated load
      mockHttpClient.mockResponse('https://api.github.com/user', createMockResponse({
        body: { login: 'ghuser' },
      }));

      mockHttpClient.mockResponse('https://api.github.com/rate_limit', createMockResponse({
        body: {
          resources: { core: { limit: 5000, remaining: 5000, reset: Math.floor(Date.now() / 1000) + 3600 } },
        },
      }));

      const { result } = renderHook(() => useGitHubAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.authState).toBe('authenticated');
      });

      await act(async () => {
        await result.current.handleDisconnect();
      });

      expect(result.current.authState).toBe('unauthenticated');
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('refreshRateLimit', () => {
    it('calls refreshRateLimit without error', async () => {
      mockCredentialService.setGhAuthStatus({ installed: false, authenticated: false });

      const { result } = renderHook(() => useGitHubAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      // Verify refreshRateLimit can be called without throwing
      await act(async () => {
        await result.current.refreshRateLimit();
      });

      // The function should complete without error
      expect(result.current.error).toBeNull();
    });
  });

  describe('setError', () => {
    it('allows setting error manually', async () => {
      mockCredentialService.setGhAuthStatus({ installed: false, authenticated: false });

      const { result } = renderHook(() => useGitHubAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      expect(result.current.error).toBeNull();

      act(() => {
        result.current.setError('Custom error message');
      });

      expect(result.current.error).toBe('Custom error message');

      act(() => {
        result.current.setError(null);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('returned values', () => {
    it('returns all expected properties', async () => {
      mockCredentialService.setGhAuthStatus({ installed: true, authenticated: true, user: 'testuser' });

      const { result } = renderHook(() => useGitHubAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.authState).not.toBe('loading');
      });

      // Verify all expected properties are returned
      expect(result.current).toHaveProperty('authState');
      expect(result.current).toHaveProperty('user');
      expect(result.current).toHaveProperty('rateLimit');
      expect(result.current).toHaveProperty('ghAuthStatus');
      expect(result.current).toHaveProperty('credHelperStatus');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('handleUseGhToken');
      expect(result.current).toHaveProperty('handleSubmitPat');
      expect(result.current).toHaveProperty('handleDisconnect');
      expect(result.current).toHaveProperty('refreshRateLimit');
      expect(result.current).toHaveProperty('setError');

      // Verify function types
      expect(typeof result.current.handleUseGhToken).toBe('function');
      expect(typeof result.current.handleSubmitPat).toBe('function');
      expect(typeof result.current.handleDisconnect).toBe('function');
      expect(typeof result.current.refreshRateLimit).toBe('function');
      expect(typeof result.current.setError).toBe('function');
    });
  });
});
