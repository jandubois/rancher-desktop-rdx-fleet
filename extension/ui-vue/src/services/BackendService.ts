/**
 * Backend Service - Client for the extension backend API.
 * Communicates via ddClient.extension.vm.service.
 */

import { ddClient } from '../lib/ddClient';

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

export interface ExtensionIdentity {
  containerId: string;
  extensionName: string;
  extensionType: string;
  version: string;
  startedAt: string;
}

export interface InstalledExtension {
  name: string;
  tag: string;
  labels?: Record<string, string>;
}

export interface OwnershipStatus {
  isOwner: boolean;
  currentOwner?: string;
  ownContainerId: string;
  ownExtensionName: string;
  status: 'claimed' | 'reclaimed' | 'yielded' | 'waiting' | 'taken-over' | 'error' | 'pending';
  message: string;
  debugLog?: string[];
}

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

export interface BackendStatus {
  connected: boolean;
  health?: BackendHealth;
  identity?: ExtensionIdentity;
  initStatus?: InitStatus;
  ownership?: OwnershipStatus;
  error?: string;
  lastChecked: string;
}

export interface GitRepoDisplay {
  state?: string;
  message?: string;
  error?: boolean;
}

export interface GitRepoResource {
  kind: string;
  name: string;
  state: string;
}

export interface GitRepoCondition {
  type: string;
  status: string;
  message?: string;
}

export interface GitRepoStatus {
  ready: boolean;
  display?: GitRepoDisplay;
  desiredReadyClusters: number;
  readyClusters: number;
  resources?: GitRepoResource[];
  conditions?: GitRepoCondition[];
}

export interface GitRepo {
  name: string;
  repo: string;
  branch?: string;
  paths?: string[];
  paused?: boolean;
  status?: GitRepoStatus;
}

export interface GitRepoRequest {
  name: string;
  repo: string;
  branch?: string;
  paths?: string[];
  paused?: boolean;
}

export interface SecretInfo {
  name: string;
  namespace: string;
  type: string;
  createdAt?: string;
  labels?: Record<string, string>;
}

export interface RegistrySecretRequest {
  name: string;
  registry: string;
  username: string;
  password: string;
}

export interface BuildRequest {
  imageName: string;
  baseImage: string;
  title: string;
  manifest: string;
  metadata: string;
  iconPath?: string;
  icon?: {
    filename: string;
    data: string;
  };
  bundledImages?: Array<{
    path: string;
    data: string;
  }>;
}

export interface BuildResult {
  success: boolean;
  imageName: string;
  output: string;
  error?: string;
}

export interface PushResult {
  success: boolean;
  imageName: string;
  output: string;
  error?: string;
}

export interface PushableCheckResult {
  pushable: boolean;
  reason?: string;
}

export interface IconResult {
  data: string;
  mimeType: string;
}

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

export interface FleetIconsResponse {
  images: FleetImageWithIcon[];
}

export interface PathInfo {
  path: string;
  dependsOn?: string[];
}

export interface GitCredentials {
  username: string;
  password: string;
}

export interface DiscoverPathsRequest {
  repo: string;
  branch?: string;
  credentials?: GitCredentials;
  secretName?: string;
}

export interface DiscoverPathsResult {
  paths: PathInfo[];
  branch: string;
  cloneTimeMs: number;
  scanTimeMs: number;
}

interface VmService {
  get(url: string): Promise<unknown>;
  post(url: string, data: unknown): Promise<unknown>;
}

export class BackendService {
  private vmService: VmService | undefined;

  constructor() {
    this.vmService = ddClient.extension.vm?.service as VmService | undefined;
  }

  private ensureVmService(): VmService {
    if (!this.vmService) {
      throw new Error('vm.service not available');
    }
    return this.vmService;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.vmService) return false;
    try {
      await this.vmService.get('/health/live');
      return true;
    } catch {
      return false;
    }
  }

  async getHealth(): Promise<BackendHealth> {
    return await this.ensureVmService().get('/health') as BackendHealth;
  }

  async getIdentity(): Promise<ExtensionIdentity> {
    return await this.ensureVmService().get('/identity') as ExtensionIdentity;
  }

  async initialize(data: {
    installedExtensions: InstalledExtension[];
    kubeconfig?: string;
    debugInfo?: string[];
    ownExtensionImage?: string;
  }): Promise<OwnershipStatus> {
    return await this.ensureVmService().post('/api/init', data) as OwnershipStatus;
  }

  async getInitStatus(): Promise<InitStatus> {
    return await this.ensureVmService().get('/api/init') as InitStatus;
  }

  async getStatus(): Promise<BackendStatus> {
    const lastChecked = new Date().toISOString();

    try {
      const [health, identity] = await Promise.all([
        this.getHealth(),
        this.getIdentity(),
      ]);

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

  async getFleetState(): Promise<{
    status: 'checking' | 'not-installed' | 'installing' | 'running' | 'error';
    version?: string;
    error?: string;
    message?: string;
  }> {
    return await this.ensureVmService().get('/api/fleet/state') as {
      status: 'checking' | 'not-installed' | 'installing' | 'running' | 'error';
      version?: string;
      error?: string;
      message?: string;
    };
  }

  async listGitRepos(): Promise<GitRepo[]> {
    const response = await this.ensureVmService().get('/api/gitrepos') as { items: GitRepo[] };
    return response.items;
  }

  async getGitRepo(name: string): Promise<GitRepo | null> {
    try {
      return await this.ensureVmService().get(`/api/gitrepos/${encodeURIComponent(name)}`) as GitRepo;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async applyGitRepo(request: GitRepoRequest): Promise<GitRepo> {
    return await this.ensureVmService().post('/api/gitrepos', request) as GitRepo;
  }

  async deleteGitRepo(name: string): Promise<void> {
    await this.ensureVmService().post(`/api/gitrepos/${encodeURIComponent(name)}/delete`, {});
  }

  async syncGitRepoDefaults(defaults: Array<{
    name: string;
    repo: string;
    branch?: string;
    paths: string[];
  }>): Promise<{
    success: boolean;
    created: string[];
    failed: Array<{ name: string; error: string }>;
    message: string;
  }> {
    return await this.ensureVmService().post('/api/gitrepos/sync-defaults', { defaults }) as {
      success: boolean;
      created: string[];
      failed: Array<{ name: string; error: string }>;
      message: string;
    };
  }

  async discoverPaths(request: DiscoverPathsRequest): Promise<DiscoverPathsResult> {
    return await this.ensureVmService().post('/api/git/discover', request) as DiscoverPathsResult;
  }

  async buildImage(request: BuildRequest): Promise<BuildResult> {
    return await this.ensureVmService().post('/api/build', request) as BuildResult;
  }

  async checkPushable(imageName: string): Promise<PushableCheckResult> {
    return await this.ensureVmService().post('/api/build/push/check', { imageName }) as PushableCheckResult;
  }

  async pushImage(imageName: string, auth?: { username: string; password: string }): Promise<PushResult> {
    return await this.ensureVmService().post('/api/build/push', { imageName, auth }) as PushResult;
  }

  async getFleetIcons(): Promise<FleetIconsResponse> {
    return await this.ensureVmService().get('/api/icons') as FleetIconsResponse;
  }

  async getLocalIcon(): Promise<{ iconPath: string | null; data: string | null; mimeType: string | null; isDefault?: boolean }> {
    return await this.ensureVmService().get('/api/icons/local') as { iconPath: string | null; data: string | null; mimeType: string | null; isDefault?: boolean };
  }
}

export const backendService = new BackendService();
