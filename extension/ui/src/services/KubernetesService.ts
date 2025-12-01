/**
 * Kubernetes service abstraction layer.
 *
 * Provides typed methods for kubectl and helm operations,
 * abstracting away the raw command execution details.
 * This makes the code more testable and maintainable.
 */

import { CommandExecutor } from './CommandExecutor';
import { GitRepo, FleetState } from '../types';
import { getErrorMessage, KUBE_CONTEXT, FLEET_NAMESPACE } from '../utils';

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
 * All kubectl/helm commands are executed through the injected CommandExecutor,
 * making this service fully testable via mock executors.
 */
export class KubernetesService {
  constructor(private executor: CommandExecutor) {}

  /**
   * Check if Fleet CRD exists in the cluster
   */
  async checkFleetCrdExists(): Promise<boolean> {
    try {
      const result = await this.executor.exec('kubectl', [
        '--context', KUBE_CONTEXT,
        'get', 'crd', 'gitrepos.fleet.cattle.io',
        '-o', 'jsonpath={.metadata.name}',
      ]);
      return !result.stderr && result.stdout.includes('gitrepos.fleet.cattle.io');
    } catch (err) {
      const errMsg = getErrorMessage(err);
      if (errMsg.includes('NotFound') || errMsg.includes('not found')) {
        return false;
      }
      throw err;
    }
  }

  /**
   * Check if Fleet controller pod is running
   */
  async checkFleetPodRunning(): Promise<boolean> {
    const result = await this.executor.exec('kubectl', [
      '--context', KUBE_CONTEXT,
      'get', 'pods', '-n', 'cattle-fleet-system',
      '-l', 'app=fleet-controller',
      '-o', 'jsonpath={.items[0].status.phase}',
    ]);
    return result.stdout === 'Running';
  }

  /**
   * Check if the Fleet namespace exists
   */
  async checkFleetNamespaceExists(): Promise<boolean> {
    try {
      const result = await this.executor.exec('kubectl', [
        '--context', KUBE_CONTEXT,
        'get', 'namespace', FLEET_NAMESPACE,
        '-o', 'jsonpath={.metadata.name}',
      ]);
      return !result.stderr && result.stdout === FLEET_NAMESPACE;
    } catch (err) {
      const errMsg = getErrorMessage(err);
      if (errMsg.includes('NotFound') || errMsg.includes('not found')) {
        return false;
      }
      throw err;
    }
  }

  /**
   * Create the Fleet namespace
   */
  async createFleetNamespace(): Promise<void> {
    try {
      await this.executor.exec('kubectl', [
        '--context', KUBE_CONTEXT,
        'create', 'namespace', FLEET_NAMESPACE,
      ]);
    } catch (err) {
      const errMsg = getErrorMessage(err);
      if (!errMsg.includes('already exists')) {
        throw err;
      }
    }
  }

  /**
   * Get Fleet version from Helm release
   */
  async getFleetVersion(): Promise<string> {
    try {
      const result = await this.executor.exec('helm', [
        '--kube-context', KUBE_CONTEXT,
        'list', '-n', 'cattle-fleet-system',
        '-f', 'fleet',
        '-o', 'json',
      ]);
      const releases = JSON.parse(result.stdout || '[]');
      if (releases.length > 0) {
        return releases[0].app_version || releases[0].chart || 'unknown';
      }
    } catch {
      // Ignore parse errors
    }
    return 'unknown';
  }

  /**
   * Check Fleet status and return the current state
   */
  async checkFleetStatus(): Promise<FleetStatusCheckResult> {
    // Check if CRD exists
    const crdExists = await this.checkFleetCrdExists();
    if (!crdExists) {
      return { state: { status: 'not-installed' } };
    }

    // Check if pod is running
    const podRunning = await this.checkFleetPodRunning();
    if (!podRunning) {
      return { state: { status: 'not-installed' } };
    }

    // Check if namespace exists
    const namespaceExists = await this.checkFleetNamespaceExists();
    if (!namespaceExists) {
      return {
        state: {
          status: 'initializing',
          message: `Creating the "${FLEET_NAMESPACE}" namespace...`,
        },
        needsNamespaceCreation: true,
      };
    }

    // Get version
    const version = await this.getFleetVersion();
    return { state: { status: 'running', version } };
  }

  /**
   * Install Fleet using Helm
   */
  async installFleet(): Promise<void> {
    // Add Helm repo
    await this.executor.exec('helm', [
      '--kube-context', KUBE_CONTEXT,
      'repo', 'add', 'fleet', 'https://rancher.github.io/fleet-helm-charts/',
    ]);

    // Update repos
    await this.executor.exec('helm', [
      '--kube-context', KUBE_CONTEXT,
      'repo', 'update',
    ]);

    // Install Fleet CRD
    await this.executor.exec('helm', [
      '--kube-context', KUBE_CONTEXT,
      'install', '--create-namespace', '-n', 'cattle-fleet-system',
      'fleet-crd', 'fleet/fleet-crd',
      '--wait',
    ]);

    // Install Fleet controller
    await this.executor.exec('helm', [
      '--kube-context', KUBE_CONTEXT,
      'install', '--create-namespace', '-n', 'cattle-fleet-system',
      'fleet', 'fleet/fleet',
      '--wait',
    ]);

    // Create Fleet namespace
    await this.createFleetNamespace();
  }

  /**
   * Fetch all GitRepos from the cluster
   */
  async fetchGitRepos(): Promise<GitRepo[]> {
    const result = await this.executor.exec('kubectl', [
      '--context', KUBE_CONTEXT,
      'get', 'gitrepos', '-n', FLEET_NAMESPACE,
      '-o', 'json',
    ]);

    if (result.stderr) {
      throw new Error(result.stderr);
    }

    const data = JSON.parse(result.stdout || '{"items":[]}');
    return this.parseGitRepoItems(data.items || []);
  }

  /**
   * Apply a GitRepo to the cluster (create or update)
   */
  async applyGitRepo(
    name: string,
    repoUrl: string,
    branch?: string,
    paths?: string[]
  ): Promise<void> {
    const gitRepoYaml = {
      apiVersion: 'fleet.cattle.io/v1alpha1',
      kind: 'GitRepo',
      metadata: {
        name,
        namespace: FLEET_NAMESPACE,
      },
      spec: {
        repo: repoUrl,
        ...(branch && { branch }),
        ...(paths && paths.length > 0 && { paths }),
      },
    };

    const jsonStr = JSON.stringify(gitRepoYaml);
    await this.executor.exec('kubectl', [
      '--apply-json', jsonStr,
      '--context', KUBE_CONTEXT,
    ]);
  }

  /**
   * Delete a GitRepo from the cluster
   */
  async deleteGitRepo(name: string): Promise<void> {
    await this.executor.exec('kubectl', [
      '--context', KUBE_CONTEXT,
      'delete', 'gitrepo', name, '-n', FLEET_NAMESPACE,
    ]);
  }

  /**
   * Parse raw GitRepo items from kubectl JSON output
   */
  private parseGitRepoItems(items: Record<string, unknown>[]): GitRepo[] {
    return items.map((item) => {
      const spec = (item.spec as Record<string, unknown>) || {};
      const status = (item.status as Record<string, unknown>) || {};
      const metadata = (item.metadata as Record<string, unknown>) || {};
      const conditions = (status.conditions as Array<Record<string, unknown>>) || [];
      const display = status.display as Record<string, unknown> | undefined;
      const resources = (status.resources as Array<Record<string, unknown>>) || [];

      return {
        name: metadata.name as string,
        repo: spec.repo as string,
        branch: spec.branch as string | undefined,
        paths: spec.paths as string[] | undefined,
        status: {
          ready: conditions.some((c) => c.type === 'Ready' && c.status === 'True'),
          display: display
            ? {
                state: display.state as string | undefined,
                message: display.message as string | undefined,
                error: display.error as boolean | undefined,
              }
            : undefined,
          desiredReadyClusters: (status.desiredReadyClusters as number) || 0,
          readyClusters: (status.readyClusters as number) || 0,
          resources: resources.map((r) => ({
            kind: r.kind as string,
            name: r.name as string,
            state: r.state as string,
          })),
          conditions: conditions.map((c) => ({
            type: c.type as string,
            status: c.status as string,
            message: c.message as string | undefined,
          })),
        },
      };
    });
  }
}
