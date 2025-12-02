/**
 * Tests for AppCoService
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AppCoService, APPCO_API_BASE, APPCO_REGISTRY_HOST } from './AppCoService';
import { MockHttpClient, createMockResponse } from '../test-utils/mocks';

describe('AppCoService', () => {
  let service: AppCoService;
  let mockHttpClient: MockHttpClient;

  beforeEach(() => {
    mockHttpClient = new MockHttpClient();
    service = new AppCoService(mockHttpClient);
  });

  describe('constants', () => {
    it('has correct API base URL', () => {
      expect(APPCO_API_BASE).toBe('https://api.apps.rancher.io');
    });

    it('has correct registry host', () => {
      expect(APPCO_REGISTRY_HOST).toBe('dp.apps.rancher.io');
    });
  });

  describe('validateCredentials', () => {
    it('returns user info for valid credentials', async () => {
      mockHttpClient.mockResponse(
        `${APPCO_API_BASE}/v1/user`,
        createMockResponse({
          ok: true,
          status: 200,
          body: {
            username: 'testuser',
            email: 'test@example.com',
            type: 'user',
          },
        })
      );

      const result = await service.validateCredentials('testuser', 'valid-token');

      expect(result).toEqual({
        username: 'testuser',
        email: 'test@example.com',
        accountType: 'user',
      });
    });

    it('returns service account type correctly', async () => {
      mockHttpClient.mockResponse(
        `${APPCO_API_BASE}/v1/user`,
        createMockResponse({
          ok: true,
          status: 200,
          body: {
            username: 'service-account',
            type: 'service',
          },
        })
      );

      const result = await service.validateCredentials('service-account', 'token');

      expect(result?.accountType).toBe('service');
    });

    it('returns null for invalid credentials (401)', async () => {
      mockHttpClient.mockResponse(
        `${APPCO_API_BASE}/v1/user`,
        createMockResponse({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        })
      );

      const result = await service.validateCredentials('baduser', 'bad-token');

      expect(result).toBeNull();
    });

    it('returns null for server error (500)', async () => {
      mockHttpClient.mockResponse(
        `${APPCO_API_BASE}/v1/user`,
        createMockResponse({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
      );

      const result = await service.validateCredentials('user', 'token');

      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      mockHttpClient.mockResponse(
        `${APPCO_API_BASE}/v1/user`,
        new Error('Network error')
      );

      const result = await service.validateCredentials('user', 'token');

      expect(result).toBeNull();
    });

    it('uses login field as fallback for username', async () => {
      mockHttpClient.mockResponse(
        `${APPCO_API_BASE}/v1/user`,
        createMockResponse({
          ok: true,
          status: 200,
          body: {
            login: 'loginuser',
          },
        })
      );

      const result = await service.validateCredentials('test', 'token');

      expect(result?.username).toBe('loginuser');
    });

    it('falls back to provided username if no username in response', async () => {
      mockHttpClient.mockResponse(
        `${APPCO_API_BASE}/v1/user`,
        createMockResponse({
          ok: true,
          status: 200,
          body: {},
        })
      );

      const result = await service.validateCredentials('provideduser', 'token');

      expect(result?.username).toBe('provideduser');
    });
  });

  describe('getAuthStatus', () => {
    it('returns authenticated true with user for valid credentials', async () => {
      mockHttpClient.mockResponse(
        `${APPCO_API_BASE}/v1/user`,
        createMockResponse({
          ok: true,
          status: 200,
          body: {
            username: 'testuser',
            email: 'test@example.com',
          },
        })
      );

      const result = await service.getAuthStatus('testuser', 'valid-token');

      expect(result.authenticated).toBe(true);
      expect(result.user).toEqual({
        username: 'testuser',
        email: 'test@example.com',
        accountType: 'user',
      });
      expect(result.error).toBeUndefined();
    });

    it('returns authenticated false for invalid credentials', async () => {
      mockHttpClient.mockResponse(
        `${APPCO_API_BASE}/v1/user`,
        createMockResponse({
          ok: false,
          status: 401,
        })
      );

      const result = await service.getAuthStatus('user', 'bad-token');

      expect(result.authenticated).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toBe('Invalid credentials');
    });
  });

  describe('getCatalog', () => {
    it('returns catalog data for authenticated user', async () => {
      mockHttpClient.mockResponse(
        `${APPCO_API_BASE}/v1/apps`,
        createMockResponse({
          ok: true,
          status: 200,
          body: {
            apps: [
              { name: 'app1', version: '1.0' },
              { name: 'app2', version: '2.0' },
            ],
          },
        })
      );

      const result = await service.getCatalog('user', 'token');

      expect(result).toEqual({
        apps: [
          { name: 'app1', version: '1.0' },
          { name: 'app2', version: '2.0' },
        ],
      });
    });

    it('returns null for unauthenticated request', async () => {
      mockHttpClient.mockResponse(
        `${APPCO_API_BASE}/v1/apps`,
        createMockResponse({
          ok: false,
          status: 401,
        })
      );

      const result = await service.getCatalog('user', 'bad-token');

      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      mockHttpClient.mockResponse(
        `${APPCO_API_BASE}/v1/apps`,
        new Error('Network error')
      );

      const result = await service.getCatalog('user', 'token');

      expect(result).toBeNull();
    });
  });
});
