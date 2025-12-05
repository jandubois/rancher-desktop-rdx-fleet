/**
 * Secrets Service
 *
 * Manages Kubernetes secrets in the fleet-local namespace.
 * Used for registry pull secrets (imagePullSecrets).
 */

import * as k8s from '@kubernetes/client-node';

// Constants
const FLEET_NAMESPACE = 'fleet-local';

/** Standard secret names */
export const APPCO_SECRET_NAME = 'fleet-ext-appco-registry';

/** Secret info */
export interface SecretInfo {
  name: string;
  namespace: string;
  type: string;
  createdAt?: string;
  labels?: Record<string, string>;
}

/** Request to create a registry secret */
export interface RegistrySecretRequest {
  name: string;
  registry: string;
  username: string;
  password: string;
}

class SecretsService {
  private k8sApi: k8s.CoreV1Api | null = null;
  private initialized = false;
  private debugLog: string[] = [];

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}`;
    console.log(`[Secrets] ${message}`);
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
    this.log(`Initializing Secrets service with kubeconfig (${patchedKubeconfig.length} bytes)`);

    try {
      const kc = new k8s.KubeConfig();
      kc.loadFromString(patchedKubeconfig);
      this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
      this.initialized = true;
      this.log('Kubernetes client initialized successfully');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.log(`Failed to initialize Kubernetes client: ${msg}`);
      throw error;
    }
  }

  /**
   * Check if service is ready.
   */
  isReady(): boolean {
    return this.initialized && this.k8sApi !== null;
  }

  /**
   * Check if a secret exists
   */
  async secretExists(name: string): Promise<boolean> {
    if (!this.k8sApi) {
      throw new Error('Kubernetes client not initialized');
    }

    try {
      await this.k8sApi.readNamespacedSecret(name, FLEET_NAMESPACE);
      return true;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get secret info (without exposing the actual secret data)
   */
  async getSecretInfo(name: string): Promise<SecretInfo | null> {
    if (!this.k8sApi) {
      throw new Error('Kubernetes client not initialized');
    }

    try {
      const response = await this.k8sApi.readNamespacedSecret(name, FLEET_NAMESPACE);
      const secret = response.body;

      return {
        name: secret.metadata?.name || name,
        namespace: secret.metadata?.namespace || FLEET_NAMESPACE,
        type: secret.type || 'Opaque',
        createdAt: secret.metadata?.creationTimestamp?.toISOString(),
        labels: secret.metadata?.labels,
      };
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create or update a docker registry secret (dockerconfigjson type)
   */
  async createRegistrySecret(request: RegistrySecretRequest): Promise<SecretInfo> {
    if (!this.k8sApi) {
      throw new Error('Kubernetes client not initialized');
    }

    const { name, registry, username, password } = request;
    this.log(`Creating registry secret: ${name} for ${registry}`);

    // Build the dockerconfigjson structure
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    const dockerConfig = {
      auths: {
        [registry]: {
          username,
          password,
          auth,
        },
      },
    };
    const dockerConfigJson = JSON.stringify(dockerConfig);

    const secret: k8s.V1Secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name,
        namespace: FLEET_NAMESPACE,
        labels: {
          'app.kubernetes.io/managed-by': 'fleet-extension',
          'fleet-extension/credential-type': 'registry',
        },
      },
      type: 'kubernetes.io/dockerconfigjson',
      data: {
        '.dockerconfigjson': Buffer.from(dockerConfigJson).toString('base64'),
      },
    };

    try {
      // Check if secret already exists
      const exists = await this.secretExists(name);

      if (exists) {
        // Update existing secret
        this.log(`Updating existing secret: ${name}`);
        const response = await this.k8sApi.replaceNamespacedSecret(name, FLEET_NAMESPACE, secret);
        return {
          name: response.body.metadata?.name || name,
          namespace: response.body.metadata?.namespace || FLEET_NAMESPACE,
          type: response.body.type || 'kubernetes.io/dockerconfigjson',
          labels: response.body.metadata?.labels,
        };
      } else {
        // Create new secret
        this.log(`Creating new secret: ${name}`);
        const response = await this.k8sApi.createNamespacedSecret(FLEET_NAMESPACE, secret);
        return {
          name: response.body.metadata?.name || name,
          namespace: response.body.metadata?.namespace || FLEET_NAMESPACE,
          type: response.body.type || 'kubernetes.io/dockerconfigjson',
          labels: response.body.metadata?.labels,
        };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.log(`Error creating registry secret: ${msg}`);
      throw error;
    }
  }

  /**
   * Delete a secret
   */
  async deleteSecret(name: string): Promise<void> {
    if (!this.k8sApi) {
      throw new Error('Kubernetes client not initialized');
    }

    this.log(`Deleting secret: ${name}`);

    try {
      await this.k8sApi.deleteNamespacedSecret(name, FLEET_NAMESPACE);
      this.log(`Secret deleted: ${name}`);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        this.log(`Secret not found (already deleted): ${name}`);
        return;
      }
      const msg = error instanceof Error ? error.message : String(error);
      this.log(`Error deleting secret: ${msg}`);
      throw error;
    }
  }

  /**
   * Create or update the AppCo registry secret
   */
  async createAppCoRegistrySecret(username: string, password: string): Promise<SecretInfo> {
    return this.createRegistrySecret({
      name: APPCO_SECRET_NAME,
      registry: 'dp.apps.rancher.io',
      username,
      password,
    });
  }

  /**
   * Delete the AppCo registry secret
   */
  async deleteAppCoRegistrySecret(): Promise<void> {
    return this.deleteSecret(APPCO_SECRET_NAME);
  }

  /**
   * Check if the AppCo registry secret exists
   */
  async appCoSecretExists(): Promise<boolean> {
    return this.secretExists(APPCO_SECRET_NAME);
  }

  private isNotFoundError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'response' in error) {
      const httpError = error as { response?: { statusCode?: number } };
      return httpError.response?.statusCode === 404;
    }
    return false;
  }
}

export const secretsService = new SecretsService();
