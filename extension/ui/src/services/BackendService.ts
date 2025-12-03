/**
 * Backend Service - Client for the extension backend API.
 *
 * The backend runs as a separate container (via compose.yaml) and provides:
 * - Extension identity (container ID, extension name)
 * - Health status
 * - Ownership management (future)
 *
 * Communication is via ddClient.extension.vm.service which routes requests
 * to the backend's Unix socket (defined in metadata.json exposes.socket).
 */

import { ddClient } from '../lib/ddClient';

/** Health status from the backend */
export interface BackendHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: string;
  containerId: string;
  checks: {
    name: string;
    status: 'pass' | 'fail';
    message?: string;
  }[];
}

/** Extension identity from the backend */
export interface ExtensionIdentity {
  containerId: string;
  extensionName: string;
  extensionType: string;
  version: string;
  startedAt: string;
}

/** Installed extension info (from rdctl extension ls) */
export interface InstalledExtension {
  name: string;
  tag: string;
  labels?: Record<string, string>;
}

/** Ownership status returned by backend */
export interface OwnershipStatus {
  isOwner: boolean;
  currentOwner?: string;
  ownContainerId: string;
  ownExtensionName: string;
  status: 'claimed' | 'reclaimed' | 'yielded' | 'waiting' | 'taken-over' | 'error' | 'pending';
  message: string;
  debugLog?: string[];
}

/** Initialization status from GET /api/init */
export interface InitStatus {
  initialized: boolean;
  lastInitTime: string | null;
  installedExtensionsCount: number;
  installedExtensions: {
    name: string;
    tag?: string;
    hasFleetLabel: boolean;
    fleetType: string | null;
  }[];
  kubernetesReady: boolean;
  dockerAvailable: boolean;
  ownership: {
    isOwner: boolean;
    status: string;
    message: string;
    currentOwner?: string;
  } | null;
  ownIdentity: {
    containerId: string;
    extensionName: string;
  };
}

/** Detailed ownership debug info from GET /api/init/ownership */
export interface OwnershipDebugInfo {
  ownership: OwnershipStatus | null;
  ownIdentity: {
    containerId: string;
    extensionName: string;
    priority: string;
  };
  kubernetes: {
    ready: boolean;
  };
  docker: {
    available: boolean;
    fleetContainers: {
      id: string;
      name: string;
      image: string;
      state: string;
      labels: Record<string, string>;
    }[];
    ownContainer: {
      id: string;
      name: string;
      image: string;
    } | null;
  };
  installedExtensions: InstalledExtension[];
  logs: {
    init: string[];
    ownership: string[];
    docker: string[];
  };
}

/** Backend connection status */
export interface BackendStatus {
  connected: boolean;
  health?: BackendHealth;
  identity?: ExtensionIdentity;
  initStatus?: InitStatus;
  ownership?: OwnershipStatus;
  error?: string;
  lastChecked: string;
}

/** VM Service interface for backend communication */
interface VmService {
  get(url: string): Promise<unknown>;
  post(url: string, data: unknown): Promise<unknown>;
}

/**
 * Service for communicating with the extension backend via vm.service.
 */
export class BackendService {
  private vmService: VmService | undefined;

  constructor() {
    this.vmService = ddClient.extension.vm?.service as VmService | undefined;
  }

  /**
   * Check if the backend is reachable
   */
  async isAvailable(): Promise<boolean> {
    if (!this.vmService) {
      return false;
    }
    try {
      await this.vmService.get('/health/live');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get backend health status
   */
  async getHealth(): Promise<BackendHealth> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    return await this.vmService.get('/health') as BackendHealth;
  }

  /**
   * Get extension identity (container ID, extension name, etc.)
   */
  async getIdentity(): Promise<ExtensionIdentity> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    return await this.vmService.get('/identity') as ExtensionIdentity;
  }

  /**
   * Initialize the backend with installed extensions list.
   * This is called on frontend startup to enable ownership checking.
   */
  async initialize(data: {
    installedExtensions: InstalledExtension[];
    kubeconfig?: string;
    debugInfo?: string[];
  }): Promise<OwnershipStatus> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    return await this.vmService.post('/api/init', data) as OwnershipStatus;
  }

  /**
   * Get initialization status from backend
   */
  async getInitStatus(): Promise<InitStatus> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    return await this.vmService.get('/api/init') as InitStatus;
  }

  /**
   * Get detailed ownership debug info
   */
  async getOwnershipDebugInfo(): Promise<OwnershipDebugInfo> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    return await this.vmService.get('/api/init/ownership') as OwnershipDebugInfo;
  }

  /**
   * Manually re-run ownership check
   */
  async recheckOwnership(): Promise<OwnershipStatus> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    const data = await this.vmService.post('/api/init/check-ownership', {}) as { ownership: OwnershipStatus };
    return data.ownership;
  }

  /**
   * Get full backend status (health + identity + init status)
   */
  async getStatus(): Promise<BackendStatus> {
    const lastChecked = new Date().toISOString();

    try {
      const [health, identity] = await Promise.all([
        this.getHealth(),
        this.getIdentity(),
      ]);

      // Try to get init status (may not be initialized yet)
      let initStatus: InitStatus | undefined;
      let ownership: OwnershipStatus | undefined;
      try {
        initStatus = await this.getInitStatus();
        if (initStatus.ownership) {
          ownership = {
            isOwner: initStatus.ownership.isOwner,
            currentOwner: initStatus.ownership.currentOwner,
            ownContainerId: initStatus.ownIdentity.containerId,
            ownExtensionName: initStatus.ownIdentity.extensionName,
            status: initStatus.ownership.status as OwnershipStatus['status'],
            message: initStatus.ownership.message,
          };
        }
      } catch {
        // Init status not available yet
      }

      return {
        connected: true,
        health,
        identity,
        initStatus,
        ownership,
        lastChecked,
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked,
      };
    }
  }
}

/** Default backend service instance */
export const backendService = new BackendService();
