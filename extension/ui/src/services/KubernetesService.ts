/**
 * Kubernetes service abstraction layer for CLI-based operations.
 *
 * Kubernetes operations are handled by the backend service via its REST API.
 * This class provides a CommandExecutor holder for the service provider pattern.
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
 */
export class KubernetesService {
  constructor(private executor: CommandExecutor) {
    void this.executor;
  }
}
