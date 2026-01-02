/* eslint-disable react-refresh/only-export-components */
/**
 * Test wrapper for ServiceProvider.
 *
 * Provides a convenient way to wrap components in ServiceProvider
 * with mock services for testing.
 */

import React, { ReactNode } from 'react';
import { ServiceProvider, Services } from '../context/ServiceContext';
import { MockCommandExecutor, MockHttpClient, MockCredentialService, MockAppCoService } from './mocks';
import { GitHubService } from '../services';

export interface TestServicesOptions {
  /** Override command executor */
  commandExecutor?: Services['commandExecutor'];
  /** Override HTTP client */
  httpClient?: Services['httpClient'];
  /** Override GitHub service */
  gitHubService?: Services['gitHubService'];
  /** Override credential service */
  credentialService?: Services['credentialService'];
  /** Override AppCo service */
  appCoService?: Services['appCoService'];
}

/**
 * Create mock services for testing
 */
export function createTestServices(options: TestServicesOptions = {}): Partial<Services> {
  const commandExecutor = options.commandExecutor ?? new MockCommandExecutor();
  const httpClient = options.httpClient ?? new MockHttpClient();

  return {
    commandExecutor,
    httpClient,
    gitHubService: options.gitHubService ?? new GitHubService(httpClient),
    credentialService: options.credentialService ?? new MockCredentialService(),
    appCoService: options.appCoService ?? new MockAppCoService(),
  };
}

interface TestServiceProviderProps {
  children: ReactNode;
  services?: TestServicesOptions;
}

/**
 * Test wrapper component that provides mock services
 *
 * Usage:
 * ```tsx
 * const { result } = renderHook(() => useMyHook(), {
 *   wrapper: ({ children }) => (
 *     <TestServiceProvider services={{ gitHubService: mockGitHubService }}>
 *       {children}
 *     </TestServiceProvider>
 *   ),
 * });
 * ```
 */
export const TestServiceProvider: React.FC<TestServiceProviderProps> = ({
  children,
  services = {},
}) => {
  const testServices = createTestServices(services);

  return (
    <ServiceProvider services={testServices}>
      {children}
    </ServiceProvider>
  );
};

export default TestServiceProvider;
