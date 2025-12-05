/**
 * Kubernetes service abstraction layer.
 *
 * NOTE: Most Kubernetes operations have been moved to the backend service,
 * which uses the Kubernetes client library directly instead of kubectl CLI.
 *
 * Operations now handled by backend:
 * - GitRepo CRUD → Backend /api/gitrepos
 * - Secret CRUD → Backend /api/secrets
 * - Fleet status/install → Backend /api/fleet
 *
 * The backend approach is preferred because:
 * 1. Uses native Kubernetes client library (more reliable)
 * 2. No host CLI round-trips (faster)
 * 3. Centralized error handling and logging
 * 4. Consistent behavior across platforms
 *
 * This service is kept for backward compatibility with tests and
 * for potential future CLI-based operations that can't go through
 * the backend (e.g., operations requiring host-specific tools).
 */

import { CommandExecutor } from './CommandExecutor';
import { FleetState } from '../types';

/** Result of adding a GitRepo */
export interface AddGitRepoResult {
  success: boolean;
  error?: string;
}

/** Fleet installation status check result */
export interface FleetStatusCheckResult {
  state: FleetState;
  needsNamespaceCreation?: boolean;
}

/**
 * Service for Kubernetes operations related to Fleet GitOps.
 *
 * @deprecated Most operations now go through the backend service.
 * This class is kept for backward compatibility and potential future needs.
 */
export class KubernetesService {
  constructor(private executor: CommandExecutor) {
    // Executor is available for potential future CLI needs
    void this.executor; // Silence unused variable warning
  }

  // All Kubernetes operations (GitRepo, Secrets, Fleet) are now handled
  // by the backend service using the Kubernetes client library.
  //
  // See:
  // - BackendService.listGitRepos(), applyGitRepo(), deleteGitRepo()
  // - BackendService.createRegistrySecret(), deleteRegistrySecret()
  // - BackendService.createAppCoRegistrySecret(), deleteAppCoRegistrySecret()
  // - BackendService.getFleetState()
}
