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
  status: 'claimed' | 'yielded' | 'waiting' | 'taken-over' | 'error';
  message: string;
}

/** Backend connection status */
export interface BackendStatus {
  connected: boolean;
  health?: BackendHealth;
  identity?: ExtensionIdentity;
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
   * Get full backend status (health + identity)
   */
  async getStatus(): Promise<BackendStatus> {
    const lastChecked = new Date().toISOString();

    try {
      const [health, identity] = await Promise.all([
        this.getHealth(),
        this.getIdentity(),
      ]);

      return {
        connected: true,
        health,
        identity,
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
