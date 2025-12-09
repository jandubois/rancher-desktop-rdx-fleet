/**
 * GitRepo Service
 *
 * Manages GitRepo custom resources in the fleet-local namespace.
 * Uses Kubernetes client library for all operations (no kubectl CLI).
 */

import * as k8s from '@kubernetes/client-node';

// Constants - exported for testing
export const FLEET_NAMESPACE = 'fleet-local';
export const FLEET_GROUP = 'fleet.cattle.io';
export const FLEET_VERSION = 'v1alpha1';
export const GITREPO_PLURAL = 'gitrepos';

/** GitRepo status display info */
export interface GitRepoDisplay {
  state?: string;
  message?: string;
  error?: boolean;
}

/** GitRepo resource info */
export interface GitRepoResource {
  kind: string;
  name: string;
  state: string;
}

/** GitRepo condition */
export interface GitRepoCondition {
  type: string;
  status: string;
  message?: string;
}

/** GitRepo status */
export interface GitRepoStatus {
  ready: boolean;
  display?: GitRepoDisplay;
  desiredReadyClusters: number;
  readyClusters: number;
  resources?: GitRepoResource[];
  conditions?: GitRepoCondition[];
}

/** GitRepo representation */
export interface GitRepo {
  name: string;
  repo: string;
  branch?: string;
  paths?: string[];
  paused?: boolean;
  status?: GitRepoStatus;
}

/** Request to create/update a GitRepo */
export interface GitRepoRequest {
  name: string;
  repo: string;
  branch?: string;
  paths?: string[];
  paused?: boolean;
}

/**
 * Parse a raw GitRepo item from Kubernetes API response.
 * Exported for testing.
 */
export function parseGitRepoItem(item: Record<string, unknown>): GitRepo {
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
    paused: spec.paused as boolean | undefined,
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
}

/**
 * Build GitRepo spec from a request.
 * Exported for testing.
 */
export function buildGitRepoSpec(request: GitRepoRequest): Record<string, unknown> {
  const { repo, branch, paths, paused } = request;

  const gitRepoSpec: Record<string, unknown> = { repo };

  if (branch) {
    gitRepoSpec.branch = branch;
  }

  // Include paths field if defined - empty array means "deploy nothing"
  // Omitting paths entirely causes Fleet to deploy from root (all bundles)
  if (paths !== undefined) {
    gitRepoSpec.paths = paths;
  }

  if (paused !== undefined) {
    gitRepoSpec.paused = paused;
  }

  return gitRepoSpec;
}

/**
 * Check if an error is a Kubernetes 404 Not Found error.
 * Exported for testing.
 */
export function isNotFoundError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'response' in error) {
    const httpError = error as { response?: { statusCode?: number } };
    return httpError.response?.statusCode === 404;
  }
  return false;
}

class GitRepoService {
  private k8sApi: k8s.CoreV1Api | null = null;
  private k8sCustomApi: k8s.CustomObjectsApi | null = null;
  private initialized = false;
  private debugLog: string[] = [];

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}`;
    console.log(`[GitRepo] ${message}`);
    this.debugLog.push(entry);
    if (this.debugLog.length > 100) {
      this.debugLog = this.debugLog.slice(-100);
    }
  }

  getDebugLog(): string[] {
    return [...this.debugLog];
  }

  /**
   * Initialize with kubeconfig (called from init route after patching).
   */
  initialize(patchedKubeconfig: string): void {
    this.log(`Initializing GitRepo service with kubeconfig (${patchedKubeconfig.length} bytes)`);

    try {
      const kc = new k8s.KubeConfig();
      kc.loadFromString(patchedKubeconfig);
      this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
      this.k8sCustomApi = kc.makeApiClient(k8s.CustomObjectsApi);
      this.initialized = true;
      this.log('Kubernetes clients initialized successfully');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.log(`Failed to initialize Kubernetes clients: ${msg}`);
      throw error;
    }
  }

  /**
   * Check if service is ready.
   */
  isReady(): boolean {
    return this.initialized && this.k8sCustomApi !== null;
  }

  /**
   * List all GitRepos in the fleet-local namespace
   */
  async listGitRepos(): Promise<GitRepo[]> {
    if (!this.k8sCustomApi) {
      throw new Error('Kubernetes client not initialized');
    }

    this.log('Listing GitRepos...');

    try {
      const response = await this.k8sCustomApi.listNamespacedCustomObject(
        FLEET_GROUP,
        FLEET_VERSION,
        FLEET_NAMESPACE,
        GITREPO_PLURAL
      );

      const list = response.body as { items?: unknown[] };
      const items = list.items || [];

      const gitRepos = items.map((item) => parseGitRepoItem(item as Record<string, unknown>));
      this.log(`Found ${gitRepos.length} GitRepos`);
      return gitRepos;
    } catch (error) {
      if (isNotFoundError(error)) {
        this.log('GitRepo CRD not found or namespace does not exist');
        return [];
      }
      const msg = error instanceof Error ? error.message : String(error);
      this.log(`Error listing GitRepos: ${msg}`);
      throw error;
    }
  }

  /**
   * Get a specific GitRepo by name
   */
  async getGitRepo(name: string): Promise<GitRepo | null> {
    if (!this.k8sCustomApi) {
      throw new Error('Kubernetes client not initialized');
    }

    this.log(`Getting GitRepo: ${name}`);

    try {
      const response = await this.k8sCustomApi.getNamespacedCustomObject(
        FLEET_GROUP,
        FLEET_VERSION,
        FLEET_NAMESPACE,
        GITREPO_PLURAL,
        name
      );

      return parseGitRepoItem(response.body as Record<string, unknown>);
    } catch (error) {
      if (isNotFoundError(error)) {
        this.log(`GitRepo not found: ${name}`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Create or update a GitRepo
   */
  async applyGitRepo(request: GitRepoRequest): Promise<GitRepo> {
    if (!this.k8sCustomApi) {
      throw new Error('Kubernetes client not initialized');
    }

    const { name } = request;
    this.log(`Applying GitRepo: ${name} -> ${request.repo}`);

    const gitRepoSpec = buildGitRepoSpec(request);

    const gitRepoResource = {
      apiVersion: `${FLEET_GROUP}/${FLEET_VERSION}`,
      kind: 'GitRepo',
      metadata: {
        name,
        namespace: FLEET_NAMESPACE,
      },
      spec: gitRepoSpec,
    };

    try {
      // Try to get existing resource first
      const existing = await this.getGitRepo(name);

      if (existing) {
        // Update existing resource
        this.log(`Updating existing GitRepo: ${name}`);
        const response = await this.k8sCustomApi.replaceNamespacedCustomObject(
          FLEET_GROUP,
          FLEET_VERSION,
          FLEET_NAMESPACE,
          GITREPO_PLURAL,
          name,
          gitRepoResource
        );
        return parseGitRepoItem(response.body as Record<string, unknown>);
      } else {
        // Create new resource
        this.log(`Creating new GitRepo: ${name}`);
        const response = await this.k8sCustomApi.createNamespacedCustomObject(
          FLEET_GROUP,
          FLEET_VERSION,
          FLEET_NAMESPACE,
          GITREPO_PLURAL,
          gitRepoResource
        );
        return parseGitRepoItem(response.body as Record<string, unknown>);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.log(`Error applying GitRepo: ${msg}`);
      throw error;
    }
  }

  /**
   * Delete a GitRepo by name
   */
  async deleteGitRepo(name: string): Promise<void> {
    if (!this.k8sCustomApi) {
      throw new Error('Kubernetes client not initialized');
    }

    this.log(`Deleting GitRepo: ${name}`);

    try {
      await this.k8sCustomApi.deleteNamespacedCustomObject(
        FLEET_GROUP,
        FLEET_VERSION,
        FLEET_NAMESPACE,
        GITREPO_PLURAL,
        name
      );
      this.log(`GitRepo deleted: ${name}`);
    } catch (error) {
      if (isNotFoundError(error)) {
        this.log(`GitRepo not found (already deleted): ${name}`);
        return;
      }
      const msg = error instanceof Error ? error.message : String(error);
      this.log(`Error deleting GitRepo: ${msg}`);
      throw error;
    }
  }
}

export const gitRepoService = new GitRepoService();
