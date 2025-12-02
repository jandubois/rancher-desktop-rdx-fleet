/* eslint-disable react-refresh/only-export-components */
/**
 * Service context for dependency injection.
 *
 * This provides services throughout the component tree, making it easy
 * to inject mock implementations for testing.
 */

import { createContext, useContext, useMemo, ReactNode } from 'react';
import { ddClient } from '../lib/ddClient';
import {
  KubernetesService,
  DdClientExecutor,
  CommandExecutor,
  GitHubService,
  HttpClient,
  FetchHttpClient,
  CredentialService,
} from '../services';

/** Services available through context */
export interface Services {
  kubernetesService: KubernetesService;
  gitHubService: GitHubService;
  credentialService: CredentialService;
  commandExecutor: CommandExecutor;
  httpClient: HttpClient;
}

/** Context for service dependency injection */
const ServiceContext = createContext<Services | null>(null);

interface ServiceProviderProps {
  children: ReactNode;
  /**
   * Optional services override for testing.
   * If not provided, default implementations will be used.
   */
  services?: Partial<Services>;
}

/**
 * Provider component for service dependency injection.
 *
 * Usage in production:
 * ```tsx
 * <ServiceProvider>
 *   <App />
 * </ServiceProvider>
 * ```
 *
 * Usage in tests (see test-utils/TestServiceProvider for convenience wrapper):
 * ```tsx
 * import { TestServiceProvider } from '../test-utils';
 *
 * <TestServiceProvider services={{ gitHubService: mockGitHubService }}>
 *   <ComponentUnderTest />
 * </TestServiceProvider>
 * ```
 */
export function ServiceProvider({ children, services }: ServiceProviderProps) {
  const value = useMemo<Services>(() => {
    // Create default executor if not provided
    const commandExecutor = services?.commandExecutor ?? new DdClientExecutor(ddClient);

    // Create default HTTP client if not provided
    const httpClient = services?.httpClient ?? new FetchHttpClient();

    // Create default services if not provided
    const kubernetesService = services?.kubernetesService ?? new KubernetesService(commandExecutor);
    const gitHubService = services?.gitHubService ?? new GitHubService(httpClient);
    const credentialService = services?.credentialService ?? new CredentialService(commandExecutor);

    return {
      commandExecutor,
      httpClient,
      kubernetesService,
      gitHubService,
      credentialService,
    };
  }, [services]);

  return (
    <ServiceContext.Provider value={value}>
      {children}
    </ServiceContext.Provider>
  );
}

/**
 * Hook to access services from context.
 *
 * @throws Error if used outside of ServiceProvider
 */
export function useServices(): Services {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error('useServices must be used within a ServiceProvider');
  }
  return context;
}

/**
 * Hook to access the KubernetesService.
 */
export function useKubernetesService(): KubernetesService {
  return useServices().kubernetesService;
}

/**
 * Hook to access the GitHubService.
 */
export function useGitHubService(): GitHubService {
  return useServices().gitHubService;
}

/**
 * Hook to access the CredentialService.
 */
export function useCredentialService(): CredentialService {
  return useServices().credentialService;
}
