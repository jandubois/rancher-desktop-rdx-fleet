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
    ownExtensionImage?: string;
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
    return await this.vmService.get('/api/ownership') as OwnershipDebugInfo;
  }

  /**
   * Manually re-run ownership check
   */
  async recheckOwnership(): Promise<OwnershipStatus> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    const data = await this.vmService.post('/api/ownership/check', {}) as { ownership: OwnershipStatus };
    return data.ownership;
  }

  /**
   * Transfer ownership to another extension
   */
  async transferOwnership(newOwner: string): Promise<OwnershipStatus> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    const data = await this.vmService.post('/api/ownership/transfer', { newOwner }) as { ownership: OwnershipStatus };
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

  /**
   * Get Fleet installation state from backend
   */
  async getFleetState(): Promise<{
    status: 'checking' | 'not-installed' | 'installing' | 'running' | 'error';
    version?: string;
    error?: string;
    message?: string;
  }> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    return await this.vmService.get('/api/fleet/state') as {
      status: 'checking' | 'not-installed' | 'installing' | 'running' | 'error';
      version?: string;
      error?: string;
      message?: string;
    };
  }

  /**
   * Log debug information to the backend (visible via docker logs)
   */
  async debugLog(source: string, message: string, data?: unknown): Promise<void> {
    if (!this.vmService) {
      console.warn('[debugLog] vm.service not available');
      return;
    }
    try {
      await this.vmService.post('/api/debug/log', { source, message, data });
    } catch (error) {
      console.warn('[debugLog] Failed to send debug log:', error);
    }
  }

  /**
   * Build a custom extension image via the backend Docker API.
   *
   * @param request - Build request with image config
   * @returns Build result with success status and output
   */
  async buildImage(request: BuildRequest): Promise<BuildResult> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    return await this.vmService.post('/api/build', request) as BuildResult;
  }

  // ============================================
  // Icon Operations (via backend Docker API)
  // ============================================

  /**
   * Get icons for all Fleet extension images.
   * Uses the backend to extract icons from Docker images.
   */
  async getFleetIcons(): Promise<FleetIconsResponse> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    return await this.vmService.get('/api/icons') as FleetIconsResponse;
  }

  /**
   * Extract icon from a specific image.
   */
  async extractIcon(imageName: string, iconPath: string): Promise<IconResult | null> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    try {
      return await this.vmService.post('/api/icons/extract', { imageName, iconPath }) as IconResult;
    } catch {
      return null;
    }
  }

  // ============================================
  // GitRepo Operations (via backend Kubernetes client)
  // ============================================

  /**
   * List all GitRepos from the cluster
   */
  async listGitRepos(): Promise<GitRepo[]> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    const response = await this.vmService.get('/api/gitrepos') as { items: GitRepo[] };
    return response.items;
  }

  /**
   * Get a specific GitRepo by name
   */
  async getGitRepo(name: string): Promise<GitRepo | null> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    try {
      return await this.vmService.get(`/api/gitrepos/${encodeURIComponent(name)}`) as GitRepo;
    } catch (error) {
      // Return null if not found
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create or update a GitRepo
   */
  async applyGitRepo(request: GitRepoRequest): Promise<GitRepo> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    return await this.vmService.post('/api/gitrepos', request) as GitRepo;
  }

  /**
   * Delete a GitRepo by name
   */
  async deleteGitRepo(name: string): Promise<void> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    // Use POST with _method override since vm.service may not support DELETE
    await this.vmService.post(`/api/gitrepos/${encodeURIComponent(name)}/delete`, {});
  }

  // ============================================
  // Registry Secret Operations (via backend Kubernetes client)
  // ============================================

  /**
   * Check if a registry secret exists
   */
  async registrySecretExists(name: string): Promise<boolean> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    try {
      const response = await this.vmService.get(`/api/secrets/registry/${encodeURIComponent(name)}`) as { exists: boolean };
      return response.exists;
    } catch {
      return false;
    }
  }

  /**
   * Create or update a registry secret
   */
  async createRegistrySecret(request: RegistrySecretRequest): Promise<SecretInfo> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    return await this.vmService.post('/api/secrets/registry', request) as SecretInfo;
  }

  /**
   * Delete a registry secret
   */
  async deleteRegistrySecret(name: string): Promise<void> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    // Use POST with delete endpoint since vm.service may not support DELETE
    await this.vmService.post(`/api/secrets/registry/${encodeURIComponent(name)}/delete`, {});
  }

  /**
   * Check if AppCo registry secret exists
   */
  async appCoSecretExists(): Promise<boolean> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    try {
      const response = await this.vmService.get('/api/secrets/appco') as { exists: boolean };
      return response.exists;
    } catch {
      return false;
    }
  }

  /**
   * Create or update AppCo registry secret
   */
  async createAppCoRegistrySecret(username: string, password: string): Promise<SecretInfo> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    return await this.vmService.post('/api/secrets/appco', { username, password }) as SecretInfo;
  }

  /**
   * Delete AppCo registry secret
   */
  async deleteAppCoRegistrySecret(): Promise<void> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    // Use POST with delete endpoint since vm.service may not support DELETE
    await this.vmService.post('/api/secrets/appco/delete', {});
  }

  // ============================================
  // Git Path Discovery (via backend shallow clone)
  // ============================================

  /**
   * Discover Fleet bundle paths in a Git repository.
   * Uses backend shallow clone approach (provider-agnostic, no API rate limits).
   *
   * @param request - Discovery request with repo URL and optional credentials
   * @returns Discovery result with paths and timing info
   */
  async discoverPaths(request: DiscoverPathsRequest): Promise<DiscoverPathsResult> {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    return await this.vmService.post('/api/git/discover', request) as DiscoverPathsResult;
  }
}

// ============================================
// GitRepo Types
// ============================================

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

// ============================================
// Secret Types
// ============================================

/** Secret info (without sensitive data) */
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

// ============================================
// Build Types
// ============================================

/** Build request for custom extension images */
export interface BuildRequest {
  imageName: string;
  baseImage: string;
  title: string;
  manifest: string;      // Base64 encoded manifest.yaml content
  metadata: string;      // Base64 encoded metadata.json content
  iconPath?: string;     // Path for icon label (e.g., "/icons/custom-icon.svg")
  icon?: {               // Custom icon data
    filename: string;    // e.g., "custom-icon.svg"
    data: string;        // Base64 encoded icon data
  };
  bundledImages?: Array<{  // Bundled images for image cards
    path: string;        // e.g., "images/my-image.png"
    data: string;        // Base64 encoded image data
  }>;
}

/** Build result from the backend */
export interface BuildResult {
  success: boolean;
  imageName: string;
  output: string;
  error?: string;
}

// ============================================
// Icon Types
// ============================================

/** Icon result from backend */
export interface IconResult {
  data: string;      // Base64 encoded icon data
  mimeType: string;  // MIME type of the icon
}

/** Fleet image with icon info from GET /api/icons */
export interface FleetImageWithIcon {
  id: string;
  repository: string;
  tag: string;
  type: 'base' | 'custom';
  title?: string;
  baseImage?: string;
  headerBackground?: string;
  iconPath?: string;
  iconData?: string;
  iconMimeType?: string;
}

/** Icons response from GET /api/icons */
export interface FleetIconsResponse {
  images: FleetImageWithIcon[];
}

// ============================================
// Git Path Discovery Types
// ============================================

/** Path info with dependency data */
export interface PathInfo {
  path: string;
  dependsOn?: string[];
}

/** Git credentials for authenticated clones */
export interface GitCredentials {
  username: string;
  password: string;
}

/** Discovery request */
export interface DiscoverPathsRequest {
  repo: string;
  branch?: string;
  credentials?: GitCredentials;
  secretName?: string;
}

/** Discovery result */
export interface DiscoverPathsResult {
  paths: PathInfo[];
  branch: string;
  cloneTimeMs: number;
  scanTimeMs: number;
}

/** Default backend service instance */
export const backendService = new BackendService();
