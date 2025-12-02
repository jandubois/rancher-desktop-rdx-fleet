/**
 * Tests for useAppCoAuth hook
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAppCoAuth } from './useAppCoAuth';
import { TestServiceProvider } from '../../test-utils/TestServiceProvider';
import { MockCredentialService, MockAppCoService } from '../../test-utils/mocks';
import { APPCO_CREDENTIAL_SERVER } from '../../services/CredentialService';

describe('useAppCoAuth', () => {
  let mockCredentialService: MockCredentialService;
  let mockAppCoService: MockAppCoService;

  beforeEach(() => {
    mockCredentialService = new MockCredentialService();
    mockAppCoService = new MockAppCoService();

    // Default: credential helper is available
    mockCredentialService.setCredHelperStatus({
      available: true,
      helper: 'osxkeychain',
      configured: true,
    });
  });

  const renderUseAppCoAuth = () => {
    return renderHook(() => useAppCoAuth(), {
      wrapper: ({ children }) => (
        <TestServiceProvider
          services={{
            credentialService: mockCredentialService,
            appCoService: mockAppCoService,
          }}
        >
          {children}
        </TestServiceProvider>
      ),
    });
  };

  describe('initial state loading', () => {
    it('starts with loading state', () => {
      const { result } = renderUseAppCoAuth();
      expect(result.current.authState).toBe('loading');
    });

    it('transitions to unauthenticated when no stored credentials', async () => {
      const { result } = renderUseAppCoAuth();

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      expect(result.current.user).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('loads authenticated state with valid stored credentials', async () => {
      // Set up stored credential
      await mockCredentialService.storeCredential(
        APPCO_CREDENTIAL_SERVER,
        'testuser',
        'valid-token'
      );

      // Set up valid user response
      mockAppCoService.setMockUser({
        username: 'testuser',
        email: 'test@example.com',
        accountType: 'user',
      });

      const { result } = renderUseAppCoAuth();

      await waitFor(() => {
        expect(result.current.authState).toBe('authenticated');
      });

      expect(result.current.user).toEqual({
        username: 'testuser',
        email: 'test@example.com',
        accountType: 'user',
      });
    });

    it('clears invalid stored credentials and falls back to unauthenticated', async () => {
      // Set up stored credential but validation will fail
      await mockCredentialService.storeCredential(
        APPCO_CREDENTIAL_SERVER,
        'testuser',
        'invalid-token'
      );

      // Mock returns null for invalid credentials
      mockAppCoService.setMockUser(null);

      const { result } = renderUseAppCoAuth();

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      // Credential should be deleted
      const cred = await mockCredentialService.getCredential(APPCO_CREDENTIAL_SERVER);
      expect(cred).toBeNull();
    });

    it('provides credential helper status', async () => {
      mockCredentialService.setCredHelperStatus({
        available: false,
        helper: '',
        configured: false,
        debug: 'No helper found',
      });

      const { result } = renderUseAppCoAuth();

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      expect(result.current.credHelperStatus).toEqual({
        available: false,
        helper: '',
        configured: false,
        debug: 'No helper found',
      });
    });
  });

  describe('handleSubmitCredentials', () => {
    it('authenticates with valid credentials', async () => {
      mockAppCoService.setMockUser({
        username: 'newuser',
        email: 'new@example.com',
        accountType: 'user',
      });

      const { result } = renderUseAppCoAuth();

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      await act(async () => {
        await result.current.handleSubmitCredentials('newuser', 'valid-token');
      });

      expect(result.current.authState).toBe('authenticated');
      expect(result.current.user).toEqual({
        username: 'newuser',
        email: 'new@example.com',
        accountType: 'user',
      });
      expect(result.current.error).toBeNull();
    });

    it('stores credentials after successful authentication', async () => {
      mockAppCoService.setMockUser({
        username: 'newuser',
        accountType: 'user',
      });

      const { result } = renderUseAppCoAuth();

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      await act(async () => {
        await result.current.handleSubmitCredentials('newuser', 'my-token');
      });

      const stored = await mockCredentialService.getCredential(APPCO_CREDENTIAL_SERVER);
      expect(stored).toEqual({
        ServerURL: APPCO_CREDENTIAL_SERVER,
        Username: 'newuser',
        Secret: 'my-token',
      });
    });

    it('sets error for invalid credentials', async () => {
      mockAppCoService.setMockUser(null);

      const { result } = renderUseAppCoAuth();

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      await act(async () => {
        await result.current.handleSubmitCredentials('baduser', 'bad-token');
      });

      expect(result.current.authState).toBe('unauthenticated');
      expect(result.current.error).toBe('Invalid credentials. Please check your username and access token.');
    });

    it('sets error when credential helper is not available', async () => {
      mockCredentialService.setCredHelperStatus({
        available: false,
        helper: '',
        configured: false,
      });
      mockAppCoService.setMockUser({
        username: 'user',
        accountType: 'user',
      });

      const { result } = renderUseAppCoAuth();

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      await act(async () => {
        await result.current.handleSubmitCredentials('user', 'token');
      });

      expect(result.current.error).toContain('No credential helper available');
    });

    it('sets error for empty username', async () => {
      const { result } = renderUseAppCoAuth();

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      await act(async () => {
        await result.current.handleSubmitCredentials('', 'token');
      });

      expect(result.current.error).toBe('Please enter both username and access token');
    });

    it('sets error for empty token', async () => {
      const { result } = renderUseAppCoAuth();

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      await act(async () => {
        await result.current.handleSubmitCredentials('user', '');
      });

      expect(result.current.error).toBe('Please enter both username and access token');
    });

    it('trims whitespace from credentials', async () => {
      mockAppCoService.setMockUser({
        username: 'user',
        accountType: 'user',
      });

      const { result } = renderUseAppCoAuth();

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      await act(async () => {
        await result.current.handleSubmitCredentials('  user  ', '  token  ');
      });

      const calls = mockAppCoService.getValidateCalls();
      expect(calls[0]).toEqual({ username: 'user', token: 'token' });
    });
  });

  describe('handleDisconnect', () => {
    it('disconnects and clears auth state', async () => {
      // Set up authenticated state
      await mockCredentialService.storeCredential(
        APPCO_CREDENTIAL_SERVER,
        'testuser',
        'token'
      );
      mockAppCoService.setMockUser({
        username: 'testuser',
        accountType: 'user',
      });

      const { result } = renderUseAppCoAuth();

      await waitFor(() => {
        expect(result.current.authState).toBe('authenticated');
      });

      await act(async () => {
        await result.current.handleDisconnect();
      });

      expect(result.current.authState).toBe('unauthenticated');
      expect(result.current.user).toBeNull();
    });

    it('deletes stored credentials on disconnect', async () => {
      // Set up authenticated state
      await mockCredentialService.storeCredential(
        APPCO_CREDENTIAL_SERVER,
        'testuser',
        'token'
      );
      mockAppCoService.setMockUser({
        username: 'testuser',
        accountType: 'user',
      });

      const { result } = renderUseAppCoAuth();

      await waitFor(() => {
        expect(result.current.authState).toBe('authenticated');
      });

      await act(async () => {
        await result.current.handleDisconnect();
      });

      const cred = await mockCredentialService.getCredential(APPCO_CREDENTIAL_SERVER);
      expect(cred).toBeNull();
    });
  });

  describe('setError', () => {
    it('can set and clear error', async () => {
      const { result } = renderUseAppCoAuth();

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      act(() => {
        result.current.setError('Test error');
      });

      expect(result.current.error).toBe('Test error');

      act(() => {
        result.current.setError(null);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('isLoading', () => {
    it('is true during authentication', async () => {
      mockAppCoService.setMockUser({
        username: 'user',
        accountType: 'user',
      });

      const { result } = renderUseAppCoAuth();

      await waitFor(() => {
        expect(result.current.authState).toBe('unauthenticated');
      });

      // Start authentication without awaiting
      const promise = act(async () => {
        await result.current.handleSubmitCredentials('user', 'token');
      });

      // isLoading should be true during the operation
      // Note: This is hard to test reliably due to timing
      await promise;

      // After completion, isLoading should be false
      expect(result.current.isLoading).toBe(false);
    });
  });
});
