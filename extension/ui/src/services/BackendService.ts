/**
 * Backend Service - Client for the extension backend API.
 *
 * The backend runs as a separate container (via compose.yaml) and provides:
 * - Extension identity (container ID, extension name)
 * - Health status
 * - Ownership management (future)
 *
 * Communication is via HTTP on localhost:8080 since ddClient.extension.vm.service
 * is not implemented in Rancher Desktop.
 */

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

/**
 * Service for communicating with the extension backend.
 */
export class BackendService {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
  }

  /**
   * Check if the backend is reachable
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health/live`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get backend health status
   */
  async getHealth(): Promise<BackendHealth> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Get extension identity (container ID, extension name, etc.)
   */
  async getIdentity(): Promise<ExtensionIdentity> {
    const response = await fetch(`${this.baseUrl}/identity`);
    if (!response.ok) {
      throw new Error(`Identity check failed: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Initialize the backend with installed extensions list.
   * This is called on frontend startup to enable ownership checking.
   */
  async initialize(data: {
    installedExtensions: InstalledExtension[];
    kubeconfig?: string;
  }): Promise<OwnershipStatus> {
    const response = await fetch(`${this.baseUrl}/api/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Initialize failed: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Get initialization status from backend
   */
  async getInitStatus(): Promise<InitStatus> {
    const response = await fetch(`${this.baseUrl}/api/init`);
    if (!response.ok) {
      throw new Error(`Init status check failed: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Get detailed ownership debug info
   */
  async getOwnershipDebugInfo(): Promise<OwnershipDebugInfo> {
    const response = await fetch(`${this.baseUrl}/api/init/ownership`);
    if (!response.ok) {
      throw new Error(`Ownership debug info failed: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Manually re-run ownership check
   */
  async recheckOwnership(): Promise<OwnershipStatus> {
    const response = await fetch(`${this.baseUrl}/api/init/check-ownership`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`Ownership recheck failed: ${response.status}`);
    }
    const data = await response.json();
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
