/**
 * Docker Service - Check running containers via Docker socket.
 *
 * Used to determine if an extension's backend container is running.
 */

import Dockerode from 'dockerode';

/** Container info for debugging */
export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  labels: Record<string, string>;
}

/**
 * Service for interacting with Docker via socket.
 */
export class DockerService {
  private docker: Dockerode;
  private debugLog: string[] = [];

  constructor(socketPath: string = '/var/run/docker.sock') {
    this.docker = new Dockerode({ socketPath });
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}`;
    console.log(`[Docker] ${message}`);
    this.debugLog.push(entry);
    if (this.debugLog.length > 50) {
      this.debugLog = this.debugLog.slice(-50);
    }
  }

  /**
   * Get the debug log.
   */
  getDebugLog(): string[] {
    return [...this.debugLog];
  }

  /**
   * Check if Docker socket is available.
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all running containers.
   */
  async listContainers(): Promise<ContainerInfo[]> {
    try {
      const containers = await this.docker.listContainers({ all: false });

      return containers.map(c => ({
        id: c.Id.substring(0, 12),
        name: c.Names?.[0]?.replace(/^\//, '') || 'unknown',
        image: c.Image,
        state: c.State,
        labels: c.Labels || {},
      }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.log(`Error listing containers: ${msg}`);
      return [];
    }
  }

  /**
   * List Fleet extension containers (have the fleet label).
   */
  async listFleetExtensionContainers(): Promise<ContainerInfo[]> {
    const containers = await this.listContainers();

    const fleetContainers = containers.filter(c =>
      c.labels['io.rancher-desktop.fleet.type'] ||
      c.labels['io.rancher-desktop.fleet.name'] ||
      c.image.includes('fleet-gitops-extension')
    );

    this.log(`Found ${fleetContainers.length} Fleet extension containers`);
    return fleetContainers;
  }

  /**
   * Check if a container for the given extension name is running.
   */
  async isExtensionRunning(extensionName: string): Promise<boolean> {
    const containers = await this.listContainers();

    const found = containers.some(c => {
      // Check by label (exact match)
      if (c.labels['io.rancher-desktop.fleet.name'] === extensionName) {
        return true;
      }
      // Check by image base name (exact match)
      // Extract base name: "ghcr.io/foo/bar:tag" -> "bar"
      const imageBaseName = c.image.split('/').pop()?.split(':')[0] || '';
      if (imageBaseName === extensionName) {
        return true;
      }
      // Check container name for exact segment match
      // Container names like "desktop-extension-fleet-gitops-extension-backend-1"
      // should match "fleet-gitops-extension" but NOT "fleet-gitops"
      const containerSegments = c.name.toLowerCase().split(/[-_]/);
      if (containerSegments.includes(extensionName.toLowerCase())) {
        return true;
      }
      return false;
    });

    this.log(`Extension ${extensionName} running: ${found}`);
    return found;
  }

  /**
   * Get detailed info about Fleet extension containers for debugging.
   */
  async getFleetContainerDebugInfo(): Promise<{
    available: boolean;
    containers: ContainerInfo[];
    ownContainer: ContainerInfo | null;
  }> {
    const available = await this.isAvailable();
    if (!available) {
      return {
        available: false,
        containers: [],
        ownContainer: null,
      };
    }

    const containers = await this.listFleetExtensionContainers();
    const ownContainerId = process.env.HOSTNAME || '';

    const ownContainer = containers.find(c =>
      c.id === ownContainerId || c.id.startsWith(ownContainerId.substring(0, 12))
    ) || null;

    return {
      available: true,
      containers,
      ownContainer,
    };
  }
}

// Singleton instance
export const dockerService = new DockerService();
