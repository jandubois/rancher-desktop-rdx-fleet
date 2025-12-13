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
import { dockerService } from './docker.js';

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
    this.ownExtensionName = process.env.EXTENSION_NAME || 'fleet-gitops-extension';
    this.ownPriority = parseInt(process.env.EXTENSION_PRIORITY || '100', 10);
  }

  /**
   * Initialize own extension name by looking up this container's image from Docker.
   * This gives the backend its actual identity, not whatever the frontend claims.
   */
  async initializeOwnIdentity(): Promise<void> {
    try {
      const containers = await dockerService.listContainers();
      const shortId = this.ownContainerId.substring(0, 12);

      const ownContainer = containers.find(c =>
        c.id === shortId || c.id.startsWith(shortId)
      );

      if (ownContainer) {
        this.ownExtensionName = ownContainer.image;
        this.log(`Detected own image from Docker: ${this.ownExtensionName}`);
      } else {
        this.log(`Could not find own container (id: ${shortId}), using default: ${this.ownExtensionName}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.log(`Failed to detect own image from Docker: ${msg}`);
    }
  }

  /**
   * No-op: Extension identity is determined from Docker, not from frontend.
   * Kept for API compatibility.
   */
  setOwnExtensionName(imageName: string): void {
    this.log(`Ignoring frontend-provided extension name: ${imageName} (backend identity is: ${this.ownExtensionName})`);
  }

  /**
   * Get this extension's own image name.
   */
  getOwnExtensionName(): string {
    return this.ownExtensionName;
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
   * Ensure the fleet-local namespace exists, create if needed.
   */
  async ensureNamespace(): Promise<void> {
    if (!this.k8sApi) {
      throw new Error('Kubernetes client not initialized');
    }

    try {
      await this.k8sApi.createNamespace({
        metadata: { name: NAMESPACE },
      });
      this.log(`Created namespace ${NAMESPACE}`);
    } catch (error: unknown) {
      // Ignore if already exists (409 Conflict)
      if (error && typeof error === 'object' && 'response' in error) {
        const httpError = error as { response?: { statusCode?: number } };
        if (httpError.response?.statusCode === 409) {
          this.log(`Namespace ${NAMESPACE} already exists`);
          return;
        }
      }
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

    // Ensure namespace exists before creating ConfigMap
    await this.ensureNamespace();

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
   * Transfer ownership to another extension.
   * This writes the new owner to the ConfigMap, allowing another extension to take control.
   */
  async transferOwnership(newOwnerExtensionName: string): Promise<void> {
    if (!this.k8sApi) {
      throw new Error('Kubernetes client not initialized');
    }

    // Ensure namespace exists before creating ConfigMap
    await this.ensureNamespace();

    const now = new Date().toISOString();
    const configMapData: Record<string, string> = {
      ownerExtensionName: newOwnerExtensionName,
      ownerContainerId: '', // Empty - the new owner will fill this in when it reclaims
      claimedAt: now,
      ownerPriority: '100', // Default priority
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
      this.log(`Created ownership ConfigMap: transferred to ${newOwnerExtensionName}`);
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
          this.log(`Updated ownership ConfigMap: transferred to ${newOwnerExtensionName}`);
          return;
        }
      }
      throw error;
    }
  }

  /**
   * Check if we are the current designated owner based on ConfigMap.
   * Unlike checkOwnership, this doesn't require the extensions list.
   * Used at backend startup to determine if we should sync GitRepos.
   *
   * @returns true if we are the owner (and reclaims with our container ID)
   */
  async isCurrentOwner(): Promise<boolean> {
    this.log('Checking if we are the current owner...');

    if (!this.isReady()) {
      this.log('Kubernetes client not initialized, cannot check ownership');
      return false;
    }

    try {
      const configMap = await this.getOwnershipConfigMap();

      if (!configMap) {
        this.log('No ownership ConfigMap found, we are not the owner');
        return false;
      }

      const currentOwner = configMap.ownerExtensionName;
      this.log(`ConfigMap owner: ${currentOwner}, our identity: ${this.ownExtensionName}`);

      if (currentOwner === this.ownExtensionName) {
        // We are the designated owner, reclaim with our container ID
        this.log('We are the designated owner, reclaiming with our container ID');
        await this.claimOwnership();
        return true;
      }

      this.log('We are not the owner');
      return false;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.log(`Error checking ownership: ${msg}`);
      return false;
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
          message: 'Reclaimed ownership after restart',
        };
      }

      // Case 3: Different owner - check if still installed
      // Compare full image names (repository:tag) for exact matching
      const ownerInstalled = installedExtensions.some(ext => {
        const fullImageName = ext.tag ? `${ext.name}:${ext.tag}` : ext.name;
        this.log(`  Comparing: ${fullImageName} === ${currentOwner} ? ${fullImageName === currentOwner}`);
        return fullImageName === currentOwner;
      });

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

  /**
   * Watch the ownership ConfigMap for changes.
   * Calls the callback when we become the owner.
   *
   * @param onBecomeOwner - Callback to run when we become the owner
   * @returns A function to stop watching
   */
  async watchOwnership(onBecomeOwner: () => void): Promise<() => void> {
    if (!this.kubeconfig) {
      this.log('Cannot watch ownership: kubeconfig not available');
      return () => {};
    }

    let isWatching = true;
    let abortController: AbortController | null = null;
    let isSyncing = false;
    let lastSeenOwner = '';
    let lastSeenContainerId = '';

    const startWatch = async () => {
      if (!isWatching) return;

      try {
        const kc = new k8s.KubeConfig();
        kc.loadFromString(this.kubeconfig!);
        const watch = new k8s.Watch(kc);

        abortController = new AbortController();
        const { signal } = abortController;

        this.log('Starting ownership ConfigMap watch...');

        await watch.watch(
          `/api/v1/namespaces/${NAMESPACE}/configmaps`,
          { fieldSelector: `metadata.name=${CONFIGMAP_NAME}` },
          (type: string, obj: k8s.V1ConfigMap) => {
            if (!isWatching) return;

            const eventType = type.toUpperCase();
            const ownerExtension = obj.data?.ownerExtensionName || '';
            const ownerContainerId = obj.data?.ownerContainerId || '';

            // Check if this is a new ownership change we haven't processed
            const isNewOwnershipChange = ownerExtension !== lastSeenOwner ||
              (ownerExtension === this.ownExtensionName &&
               lastSeenContainerId !== '' &&
               ownerContainerId === '');

            // Update tracking
            lastSeenOwner = ownerExtension;
            lastSeenContainerId = ownerContainerId;

            // Skip if not a relevant event
            if (eventType !== 'ADDED' && eventType !== 'MODIFIED') {
              return;
            }

            // Skip if not our extension
            if (ownerExtension !== this.ownExtensionName) {
              return;
            }

            // Skip if we're already syncing
            if (isSyncing) {
              this.log('Watch event: already syncing, skipping');
              return;
            }

            // Skip if ConfigMap already has our container ID (we already claimed)
            if (ownerContainerId === this.ownContainerId) {
              this.log('Watch event: already claimed with our container ID, skipping');
              return;
            }

            // Only trigger on actual ownership transfer (empty container ID means transfer)
            if (ownerContainerId !== '' && !isNewOwnershipChange) {
              this.log(`Watch event: container ID set by someone else (${ownerContainerId}), skipping`);
              return;
            }

            this.log(`Watch event: ownership transferred to us, triggering sync...`);
            isSyncing = true;

            // Reclaim with our container ID and trigger callback
            this.claimOwnership().then(() => {
              return onBecomeOwner();
            }).catch((err) => {
              this.log(`Error during ownership claim/sync: ${err}`);
            }).finally(() => {
              // Small delay before allowing next sync to prevent rapid re-triggering
              setTimeout(() => {
                isSyncing = false;
              }, 2000);
            });
          },
          (err) => {
            if (!isWatching) return;
            if (signal?.aborted) return;

            if (err) {
              this.log(`Watch error: ${err}`);
            } else {
              this.log('Watch closed unexpectedly');
            }

            // Restart watch after a delay
            setTimeout(() => {
              if (isWatching) {
                this.log('Restarting ownership watch...');
                startWatch();
              }
            }, 5000);
          }
        );
      } catch (err) {
        if (!isWatching) return;
        this.log(`Failed to start watch: ${err}`);
        // Retry after a delay
        setTimeout(() => {
          if (isWatching) startWatch();
        }, 5000);
      }
    };

    // Start watching
    startWatch();

    // Return stop function
    return () => {
      isWatching = false;
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      this.log('Ownership watch stopped');
    };
  }
}

// Singleton instance
export const ownershipService = new OwnershipService();
