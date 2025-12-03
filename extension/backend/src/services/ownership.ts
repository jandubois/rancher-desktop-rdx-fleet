/**
 * Ownership Service - Manages Fleet extension ownership via ConfigMap.
 *
 * Handles:
 * - Reading/writing ownership ConfigMap in fleet-local namespace
 * - Ownership check algorithm (race-condition safe)
 * - Debug logging for troubleshooting
 */

import * as k8s from '@kubernetes/client-node';
import os from 'os';

/** Installed extension info from rdctl extension ls */
export interface InstalledExtension {
  name: string;
  tag?: string;
  labels?: Record<string, string>;
}

/** Ownership status result */
export interface OwnershipStatus {
  isOwner: boolean;
  currentOwner?: string;
  ownContainerId: string;
  ownExtensionName: string;
  status: 'claimed' | 'reclaimed' | 'yielded' | 'waiting' | 'taken-over' | 'error' | 'pending';
  message: string;
  debugLog: string[];
}

/** ConfigMap data structure */
interface OwnershipConfigMapData {
  ownerExtensionName: string;
  ownerContainerId: string;
  claimedAt: string;
  ownerPriority?: string;
}

const NAMESPACE = 'fleet-local';
const CONFIGMAP_NAME = 'fleet-extension-ownership';
const OWNER_WAIT_TIMEOUT_MS = 30000; // 30 seconds
const OWNER_POLL_INTERVAL_MS = 2000; // 2 seconds

/**
 * Service for managing extension ownership of Fleet.
 */
export class OwnershipService {
  private k8sApi: k8s.CoreV1Api | null = null;
  private ownContainerId: string;
  private ownExtensionName: string;
  private ownPriority: number;
  private debugLog: string[] = [];
  private kubeconfig: string | null = null;
  private initialized = false;

  constructor() {
    this.ownContainerId = os.hostname();
    this.ownExtensionName = process.env.EXTENSION_NAME || 'fleet-gitops';
    this.ownPriority = parseInt(process.env.EXTENSION_PRIORITY || '100', 10);
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}`;
    console.log(`[Ownership] ${message}`);
    this.debugLog.push(entry);
    // Keep only last 100 entries
    if (this.debugLog.length > 100) {
      this.debugLog = this.debugLog.slice(-100);
    }
  }

  /**
   * Initialize with kubeconfig from frontend.
   */
  async initialize(kubeconfig: string): Promise<void> {
    this.log(`Initializing with kubeconfig (${kubeconfig.length} bytes)`);

    // Patch kubeconfig to work from inside Docker container
    // Replace localhost/127.0.0.1 with host.docker.internal
    let patchedKubeconfig = kubeconfig
      .replace(/server:\s*https?:\/\/127\.0\.0\.1:/g, 'server: https://host.docker.internal:')
      .replace(/server:\s*https?:\/\/localhost:/g, 'server: https://host.docker.internal:');

    if (patchedKubeconfig !== kubeconfig) {
      this.log('Patched kubeconfig: replaced localhost/127.0.0.1 with host.docker.internal');

      // Also need to skip TLS verification since host.docker.internal
      // is not in the K8s API server certificate's SANs
      // Add insecure-skip-tls-verify to clusters that use host.docker.internal
      patchedKubeconfig = patchedKubeconfig.replace(
        /(\s+server:\s*https:\/\/host\.docker\.internal:[^\n]+)/g,
        '$1\n    insecure-skip-tls-verify: true'
      );
      this.log('Added insecure-skip-tls-verify for host.docker.internal');
    }

    this.kubeconfig = patchedKubeconfig;

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
   * Check if Kubernetes client is ready.
   */
  isReady(): boolean {
    return this.initialized && this.k8sApi !== null;
  }

  /**
   * Get the debug log entries.
   */
  getDebugLog(): string[] {
    return [...this.debugLog];
  }

  /**
   * Clear the debug log.
   */
  clearDebugLog(): void {
    this.debugLog = [];
  }

  /**
   * Read the ownership ConfigMap.
   */
  async getOwnershipConfigMap(): Promise<OwnershipConfigMapData | null> {
    if (!this.k8sApi) {
      this.log('Cannot read ConfigMap: Kubernetes client not initialized');
      return null;
    }

    try {
      const response = await this.k8sApi.readNamespacedConfigMap(
        CONFIGMAP_NAME,
        NAMESPACE
      );

      const data = response.body.data || {};
      this.log(`Read ConfigMap: owner=${data.ownerExtensionName}, container=${data.ownerContainerId}`);

      return {
        ownerExtensionName: data.ownerExtensionName || '',
        ownerContainerId: data.ownerContainerId || '',
        claimedAt: data.claimedAt || '',
        ownerPriority: data.ownerPriority,
      };
    } catch (error: unknown) {
      // Check if it's a 404 (not found)
      if (error && typeof error === 'object' && 'response' in error) {
        const httpError = error as { response?: { statusCode?: number } };
        if (httpError.response?.statusCode === 404) {
          this.log('ConfigMap not found (first time setup)');
          return null;
        }
      }
      const msg = error instanceof Error ? error.message : String(error);
      this.log(`Error reading ConfigMap: ${msg}`);
      throw error;
    }
  }

  /**
   * Create or update the ownership ConfigMap.
   */
  async claimOwnership(): Promise<void> {
    if (!this.k8sApi) {
      throw new Error('Kubernetes client not initialized');
    }

    const now = new Date().toISOString();
    const configMapData: Record<string, string> = {
      ownerExtensionName: this.ownExtensionName,
      ownerContainerId: this.ownContainerId,
      claimedAt: now,
      ownerPriority: String(this.ownPriority),
    };

    const configMap: k8s.V1ConfigMap = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: CONFIGMAP_NAME,
        namespace: NAMESPACE,
      },
      data: configMapData,
    };

    try {
      // Try to create first
      await this.k8sApi.createNamespacedConfigMap(NAMESPACE, configMap);
      this.log(`Created ownership ConfigMap: claimed by ${this.ownExtensionName}`);
    } catch (error: unknown) {
      // If already exists, update it
      if (error && typeof error === 'object' && 'response' in error) {
        const httpError = error as { response?: { statusCode?: number } };
        if (httpError.response?.statusCode === 409) {
          await this.k8sApi.replaceNamespacedConfigMap(
            CONFIGMAP_NAME,
            NAMESPACE,
            configMap
          );
          this.log(`Updated ownership ConfigMap: claimed by ${this.ownExtensionName}`);
          return;
        }
      }
      throw error;
    }
  }

  /**
   * Main ownership check algorithm (race-condition safe).
   *
   * @param installedExtensions - List of installed Fleet extensions from rdctl
   * @param checkContainerRunning - Function to check if a container is running
   */
  async checkOwnership(
    installedExtensions: InstalledExtension[],
    checkContainerRunning: (extensionName: string) => Promise<boolean>
  ): Promise<OwnershipStatus> {
    this.log('=== Starting ownership check ===');
    this.log(`Own identity: ${this.ownExtensionName} (container: ${this.ownContainerId})`);
    this.log(`Installed extensions: ${installedExtensions.map(e => e.name).join(', ') || 'none'}`);

    const baseStatus = {
      ownContainerId: this.ownContainerId,
      ownExtensionName: this.ownExtensionName,
      debugLog: this.debugLog,
    };

    if (!this.isReady()) {
      this.log('ERROR: Kubernetes client not initialized');
      return {
        ...baseStatus,
        isOwner: false,
        status: 'error',
        message: 'Kubernetes client not initialized. Waiting for kubeconfig from frontend.',
      };
    }

    try {
      // Read current ownership
      const configMap = await this.getOwnershipConfigMap();

      // Case 1: No ownership claimed yet
      if (!configMap) {
        this.log('DECISION: No existing owner - claiming ownership');
        await this.claimOwnership();
        return {
          ...baseStatus,
          isOwner: true,
          status: 'claimed',
          message: 'Claimed ownership (first extension to start)',
        };
      }

      const currentOwner = configMap.ownerExtensionName;
      const currentOwnerId = configMap.ownerContainerId;

      // Case 2: We are the current owner (same extension name)
      if (currentOwner === this.ownExtensionName) {
        this.log(`DECISION: We are the owner (${currentOwner}), reclaiming with new container ID`);
        await this.claimOwnership();
        return {
          ...baseStatus,
          isOwner: true,
          currentOwner,
          status: 'reclaimed',
          message: `Reclaimed ownership after restart (was container ${currentOwnerId})`,
        };
      }

      // Case 3: Different owner - check if still installed
      const ownerInstalled = installedExtensions.some(
        ext => ext.name === currentOwner || ext.name.includes(currentOwner)
      );

      this.log(`Current owner: ${currentOwner} (container: ${currentOwnerId})`);
      this.log(`Owner installed: ${ownerInstalled}`);

      if (!ownerInstalled) {
        // Owner extension was uninstalled - take over immediately
        this.log('DECISION: Owner extension not installed - taking over immediately');
        await this.claimOwnership();
        return {
          ...baseStatus,
          isOwner: true,
          currentOwner,
          status: 'taken-over',
          message: `Took over from uninstalled extension: ${currentOwner}`,
        };
      }

      // Case 4: Owner is installed but may not be running yet (race condition)
      this.log(`Owner ${currentOwner} is installed, checking if running...`);

      // First quick check
      const ownerRunningNow = await checkContainerRunning(currentOwner);
      if (ownerRunningNow) {
        this.log('DECISION: Owner is running - yielding');
        return {
          ...baseStatus,
          isOwner: false,
          currentOwner,
          status: 'yielded',
          message: `Another extension owns Fleet: ${currentOwner}`,
        };
      }

      // Owner not running yet - wait with timeout
      this.log(`Owner not running yet, waiting up to ${OWNER_WAIT_TIMEOUT_MS}ms...`);
      const startTime = Date.now();
      let waited = 0;

      while (Date.now() - startTime < OWNER_WAIT_TIMEOUT_MS) {
        await this.sleep(OWNER_POLL_INTERVAL_MS);
        waited = Date.now() - startTime;

        const running = await checkContainerRunning(currentOwner);
        if (running) {
          this.log(`DECISION: Owner started after ${waited}ms - yielding`);
          return {
            ...baseStatus,
            isOwner: false,
            currentOwner,
            status: 'yielded',
            message: `Owner ${currentOwner} started (waited ${waited}ms)`,
          };
        }
        this.log(`Still waiting for owner... (${waited}ms elapsed)`);
      }

      // Timeout - owner didn't start
      this.log(`DECISION: Owner didn't start after ${OWNER_WAIT_TIMEOUT_MS}ms - taking over`);
      await this.claimOwnership();
      return {
        ...baseStatus,
        isOwner: true,
        currentOwner,
        status: 'taken-over',
        message: `Took over from non-responsive ${currentOwner} (waited ${OWNER_WAIT_TIMEOUT_MS}ms)`,
      };

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.log(`ERROR during ownership check: ${msg}`);
      return {
        ...baseStatus,
        isOwner: false,
        status: 'error',
        message: `Error checking ownership: ${msg}`,
      };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const ownershipService = new OwnershipService();
