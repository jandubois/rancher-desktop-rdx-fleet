/**
 * Fleet Installation Service
 *
 * Handles automatic Fleet installation and status checking.
 * Uses Kubernetes client library and HelmChart CRDs (via k3s Helm Controller)
 * to manage Fleet in the cluster - no kubectl or helm CLI needed.
 */

import * as k8s from '@kubernetes/client-node';

// Constants
const FLEET_NAMESPACE = 'fleet-local';
const FLEET_SYSTEM_NAMESPACE = 'cattle-fleet-system';
const HELM_CHART_GROUP = 'helm.cattle.io';
const HELM_CHART_VERSION = 'v1';
const HELM_CHART_PLURAL = 'helmcharts';

export type FleetStatus = 'checking' | 'not-installed' | 'installing' | 'running' | 'error';

export interface FleetState {
  status: FleetStatus;
  version?: string;
  error?: string;
  message?: string;
}

class FleetService {
  private currentState: FleetState = { status: 'checking' };
  private installPromise: Promise<void> | null = null;
  private debugLog: string[] = [];
  private k8sApi: k8s.CoreV1Api | null = null;
  private k8sCustomApi: k8s.CustomObjectsApi | null = null;
  private k8sAppsApi: k8s.AppsV1Api | null = null;
  private kubeConfig: k8s.KubeConfig | null = null;
  private initialized = false;

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}`;
    console.log(`[Fleet] ${message}`);
    this.debugLog.push(entry);
    if (this.debugLog.length > 100) {
      this.debugLog = this.debugLog.slice(-100);
    }
  }

  getDebugLog(): string[] {
    return [...this.debugLog];
  }

  getState(): FleetState {
    return { ...this.currentState };
  }

  /**
   * Initialize with kubeconfig (called from init route after patching).
   */
  initialize(patchedKubeconfig: string): void {
    this.log(`Initializing Fleet service with kubeconfig (${patchedKubeconfig.length} bytes)`);

    try {
      const kc = new k8s.KubeConfig();
      kc.loadFromString(patchedKubeconfig);
      this.kubeConfig = kc;
      this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
      this.k8sCustomApi = kc.makeApiClient(k8s.CustomObjectsApi);
      this.k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
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
    return this.initialized && this.k8sApi !== null;
  }

  private setState(state: FleetState): void {
    this.currentState = state;
    this.log(`State changed to: ${state.status}${state.message ? ` - ${state.message}` : ''}`);
  }

  /**
   * Check if the Kubernetes cluster is accessible
   */
  async isClusterAccessible(): Promise<boolean> {
    if (!this.k8sApi) {
      this.log('Kubernetes client not initialized');
      return false;
    }

    try {
      await this.k8sApi.listNode();
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.log(`Cluster not accessible: ${msg}`);
      return false;
    }
  }

  /**
   * Check if Fleet CRD exists in the cluster
   */
  async checkFleetCrdExists(): Promise<boolean> {
    if (!this.k8sCustomApi) return false;

    try {
      // Check for the gitrepos.fleet.cattle.io CRD
      await this.k8sCustomApi.getClusterCustomObject(
        'apiextensions.k8s.io',
        'v1',
        'customresourcedefinitions',
        'gitrepos.fleet.cattle.io'
      );
      return true;
    } catch (error) {
      // 404 means CRD doesn't exist
      if (this.isNotFoundError(error)) {
        return false;
      }
      const msg = error instanceof Error ? error.message : String(error);
      this.log(`Error checking Fleet CRD: ${msg}`);
      return false;
    }
  }

  /**
   * Check if Fleet controller deployment is running
   */
  async checkFleetPodRunning(): Promise<boolean> {
    if (!this.k8sAppsApi) return false;

    try {
      const response = await this.k8sAppsApi.readNamespacedDeployment(
        'fleet-controller',
        FLEET_SYSTEM_NAMESPACE
      );
      const status = response.body.status;
      return (status?.readyReplicas || 0) > 0;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return false;
      }
      const msg = error instanceof Error ? error.message : String(error);
      this.log(`Error checking Fleet deployment: ${msg}`);
      return false;
    }
  }

  /**
   * Check if the Fleet namespace exists
   */
  async checkFleetNamespaceExists(): Promise<boolean> {
    if (!this.k8sApi) return false;

    try {
      await this.k8sApi.readNamespace(FLEET_NAMESPACE);
      return true;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Create the Fleet namespace
   */
  async createFleetNamespace(): Promise<void> {
    if (!this.k8sApi) {
      throw new Error('Kubernetes client not initialized');
    }

    try {
      await this.k8sApi.createNamespace({
        metadata: { name: FLEET_NAMESPACE },
      });
      this.log(`Created namespace ${FLEET_NAMESPACE}`);
    } catch (error) {
      if (this.isConflictError(error)) {
        this.log(`Namespace ${FLEET_NAMESPACE} already exists`);
        return;
      }
      throw error;
    }
  }

  /**
   * Get Fleet version from HelmChart status or deployment
   */
  async getFleetVersion(): Promise<string> {
    if (!this.k8sAppsApi) return 'unknown';

    try {
      const response = await this.k8sAppsApi.readNamespacedDeployment(
        'fleet-controller',
        FLEET_SYSTEM_NAMESPACE
      );
      // Try to get version from image tag
      const containers = response.body.spec?.template?.spec?.containers || [];
      for (const container of containers) {
        if (container.name === 'fleet-controller' && container.image) {
          const parts = container.image.split(':');
          if (parts.length > 1) {
            return parts[1];
          }
        }
      }
    } catch {
      // Ignore errors
    }
    return 'unknown';
  }

  /**
   * Check Fleet status
   */
  async checkStatus(): Promise<FleetState> {
    this.log('Checking Fleet status...');

    if (!this.isReady()) {
      this.log('Kubernetes client not ready');
      return { status: 'error', error: 'Kubernetes client not initialized' };
    }

    // First check if cluster is accessible
    const clusterAccessible = await this.isClusterAccessible();
    if (!clusterAccessible) {
      this.log('Cluster not accessible');
      return { status: 'error', error: 'Kubernetes cluster not accessible' };
    }

    // Check if CRD exists
    const crdExists = await this.checkFleetCrdExists();
    if (!crdExists) {
      this.log('Fleet CRD not found - Fleet is not installed');
      return { status: 'not-installed' };
    }

    // Check if pod is running
    const podRunning = await this.checkFleetPodRunning();
    if (!podRunning) {
      this.log('Fleet deployment not ready');
      return { status: 'not-installed' };
    }

    // Check if namespace exists
    const namespaceExists = await this.checkFleetNamespaceExists();
    if (!namespaceExists) {
      this.log('Fleet namespace not found, creating...');
      try {
        await this.createFleetNamespace();
      } catch (err) {
        this.log(`Failed to create namespace: ${err}`);
      }
    }

    // Get version
    const version = await this.getFleetVersion();
    this.log(`Fleet is running, version: ${version}`);
    return { status: 'running', version };
  }

  /**
   * Check if a HelmChart resource exists
   */
  private async helmChartExists(name: string): Promise<boolean> {
    if (!this.k8sCustomApi) return false;

    try {
      await this.k8sCustomApi.getNamespacedCustomObject(
        HELM_CHART_GROUP,
        HELM_CHART_VERSION,
        'kube-system',
        HELM_CHART_PLURAL,
        name
      );
      return true;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Create a HelmChart resource for the Helm Controller to process
   */
  private async createHelmChart(
    name: string,
    chart: string,
    repo: string,
    targetNamespace: string,
    options: { createNamespace?: boolean; wait?: boolean } = {}
  ): Promise<void> {
    if (!this.k8sCustomApi) {
      throw new Error('Kubernetes client not initialized');
    }

    // Check if already exists
    if (await this.helmChartExists(name)) {
      this.log(`HelmChart ${name} already exists`);
      return;
    }

    const helmChart = {
      apiVersion: `${HELM_CHART_GROUP}/${HELM_CHART_VERSION}`,
      kind: 'HelmChart',
      metadata: {
        name,
        namespace: 'kube-system',
      },
      spec: {
        repo,
        chart,
        targetNamespace,
        createNamespace: options.createNamespace ?? true,
        // Empty valuesContent to use chart defaults (required by Helm Controller)
        valuesContent: '',
      },
    };

    this.log(`Creating HelmChart ${name} for chart ${chart} from ${repo}`);
    await this.k8sCustomApi.createNamespacedCustomObject(
      HELM_CHART_GROUP,
      HELM_CHART_VERSION,
      'kube-system',
      HELM_CHART_PLURAL,
      helmChart
    );
    this.log(`HelmChart ${name} created successfully`);
  }

  /**
   * Wait for a HelmChart to be deployed (job completed)
   */
  private async waitForHelmChart(name: string, timeoutMs: number = 120000): Promise<boolean> {
    if (!this.k8sCustomApi) return false;

    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await this.k8sCustomApi.getNamespacedCustomObject(
          HELM_CHART_GROUP,
          HELM_CHART_VERSION,
          'kube-system',
          HELM_CHART_PLURAL,
          name
        );

        const helmChart = response.body as { status?: { jobName?: string } };
        if (helmChart.status?.jobName) {
          // Job was created, check if it completed
          // The Helm Controller creates a job and removes it on success
          // If status.jobName exists and the deployment exists, it's likely done
          this.log(`HelmChart ${name} has job: ${helmChart.status.jobName}`);
        }

        // For Fleet, check if the actual resources are ready
        if (name === 'fleet-crd') {
          if (await this.checkFleetCrdExists()) {
            this.log(`HelmChart ${name} deployment verified (CRD exists)`);
            return true;
          }
        } else if (name === 'fleet') {
          if (await this.checkFleetPodRunning()) {
            this.log(`HelmChart ${name} deployment verified (controller running)`);
            return true;
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.log(`Error checking HelmChart ${name}: ${msg}`);
      }

      await this.sleep(5000);
    }

    this.log(`Timeout waiting for HelmChart ${name}`);
    return false;
  }

  /**
   * Install Fleet using HelmChart CRDs (processed by k3s Helm Controller)
   */
  async installFleet(): Promise<void> {
    this.log('Starting Fleet installation via HelmChart CRDs...');

    const FLEET_REPO = 'https://rancher.github.io/fleet-helm-charts/';

    // Install Fleet CRD chart
    this.setState({ status: 'installing', message: 'Installing Fleet CRDs...' });
    await this.createHelmChart(
      'fleet-crd',
      'fleet-crd',
      FLEET_REPO,
      FLEET_SYSTEM_NAMESPACE,
      { createNamespace: true }
    );

    // Wait for CRDs to be available
    this.setState({ status: 'installing', message: 'Waiting for Fleet CRDs...' });
    const crdReady = await this.waitForHelmChart('fleet-crd', 120000);
    if (!crdReady) {
      this.log('Warning: Fleet CRD installation may still be in progress');
    }

    // Install Fleet controller chart
    this.setState({ status: 'installing', message: 'Installing Fleet controller...' });
    await this.createHelmChart(
      'fleet',
      'fleet',
      FLEET_REPO,
      FLEET_SYSTEM_NAMESPACE,
      { createNamespace: true }
    );

    // Wait for controller to be ready
    this.setState({ status: 'installing', message: 'Waiting for Fleet controller...' });
    const controllerReady = await this.waitForHelmChart('fleet', 180000);
    if (!controllerReady) {
      this.log('Warning: Fleet controller installation may still be in progress');
    }

    // Create Fleet namespace
    this.setState({ status: 'installing', message: 'Creating Fleet namespace...' });
    await this.createFleetNamespace();

    this.log('Fleet installation completed');
  }

  /**
   * Ensure Fleet is installed - auto-install if not present
   * Returns immediately if already installing
   */
  async ensureFleetInstalled(): Promise<void> {
    // If already installing, wait for that to complete
    if (this.installPromise) {
      this.log('Installation already in progress, waiting...');
      return this.installPromise;
    }

    // Check current status
    const state = await this.checkStatus();
    this.setState(state);

    if (state.status === 'running') {
      this.log('Fleet is already running');
      return;
    }

    if (state.status === 'error') {
      this.log(`Cannot install Fleet: ${state.error}`);
      return;
    }

    if (state.status === 'not-installed') {
      this.log('Fleet not installed, starting auto-installation...');
      this.installPromise = this.doInstall();
      try {
        await this.installPromise;
      } finally {
        this.installPromise = null;
      }
    }
  }

  private async doInstall(): Promise<void> {
    try {
      await this.installFleet();
      // Verify installation
      const state = await this.checkStatus();
      this.setState(state);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.log(`Installation failed: ${errorMessage}`);
      this.setState({ status: 'error', error: errorMessage });
    }
  }

  private isNotFoundError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'response' in error) {
      const httpError = error as { response?: { statusCode?: number } };
      return httpError.response?.statusCode === 404;
    }
    return false;
  }

  private isConflictError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'response' in error) {
      const httpError = error as { response?: { statusCode?: number } };
      return httpError.response?.statusCode === 409;
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const fleetService = new FleetService();
