/**
 * Fleet Installation Service
 *
 * Handles automatic Fleet installation and status checking.
 * Uses kubectl and helm commands to manage Fleet in the cluster.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// Path for patched kubeconfig (container-friendly)
const PATCHED_KUBECONFIG = '/tmp/kubeconfig-patched';

// Constants matching the frontend
const KUBE_CONTEXT = 'rancher-desktop';
const FLEET_NAMESPACE = 'fleet-local';
const FLEET_SYSTEM_NAMESPACE = 'cattle-fleet-system';

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
  private kubeconfigReady = false;

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
   * Ensure kubeconfig is patched for container use.
   * Replaces localhost/127.0.0.1 with host.docker.internal so kubectl
   * can reach the Kubernetes API server from inside the container.
   */
  private async ensureKubeconfigPatched(): Promise<boolean> {
    if (this.kubeconfigReady) {
      return true;
    }

    const originalKubeconfig = process.env.KUBECONFIG || '/root/.kube/config';
    this.log(`Patching kubeconfig from ${originalKubeconfig}`);

    try {
      if (!fs.existsSync(originalKubeconfig)) {
        this.log(`Kubeconfig not found at ${originalKubeconfig}`);
        return false;
      }

      let content = fs.readFileSync(originalKubeconfig, 'utf8');

      // Replace localhost/127.0.0.1 with host.docker.internal
      const originalContent = content;
      content = content.replace(/https:\/\/localhost:/g, 'https://host.docker.internal:');
      content = content.replace(/https:\/\/127\.0\.0\.1:/g, 'https://host.docker.internal:');

      if (content !== originalContent) {
        this.log('Replaced localhost/127.0.0.1 with host.docker.internal');

        // Add insecure-skip-tls-verify for the patched clusters
        // This is needed because the cert is for localhost, not host.docker.internal
        content = content.replace(
          /(server: https:\/\/host\.docker\.internal:[0-9]+)/g,
          '$1\n    insecure-skip-tls-verify: true'
        );
        this.log('Added insecure-skip-tls-verify for host.docker.internal');
      }

      fs.writeFileSync(PATCHED_KUBECONFIG, content);
      this.log(`Wrote patched kubeconfig to ${PATCHED_KUBECONFIG}`);
      this.kubeconfigReady = true;
      return true;
    } catch (err) {
      this.log(`Failed to patch kubeconfig: ${err}`);
      return false;
    }
  }

  private setState(state: FleetState): void {
    this.currentState = state;
    this.log(`State changed to: ${state.status}${state.message ? ` - ${state.message}` : ''}`);
  }

  /**
   * Execute a kubectl command
   */
  private async kubectl(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // Ensure kubeconfig is patched before running kubectl
    await this.ensureKubeconfigPatched();

    const cmd = `kubectl --kubeconfig ${PATCHED_KUBECONFIG} --context ${KUBE_CONTEXT} ${args.join(' ')}`;
    this.log(`Executing: ${cmd}`);
    try {
      const result = await execAsync(cmd, { timeout: 60000 });
      this.log(`  stdout: ${result.stdout.substring(0, 200)}`);
      if (result.stderr) this.log(`  stderr: ${result.stderr.substring(0, 200)}`);
      return { ...result, exitCode: 0 };
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; message?: string; code?: number };
      this.log(`  error: ${err.message || 'Unknown error'}`);
      if (err.stdout) this.log(`  stdout: ${err.stdout.substring(0, 200)}`);
      if (err.stderr) this.log(`  stderr: ${err.stderr.substring(0, 200)}`);
      return {
        stdout: err.stdout || '',
        stderr: err.stderr || err.message || 'Unknown error',
        exitCode: err.code || 1,
      };
    }
  }

  /**
   * Execute a helm command
   */
  private async helm(args: string[]): Promise<{ stdout: string; stderr: string }> {
    // Ensure kubeconfig is patched before running helm
    await this.ensureKubeconfigPatched();

    const cmd = `helm --kubeconfig ${PATCHED_KUBECONFIG} --kube-context ${KUBE_CONTEXT} ${args.join(' ')}`;
    this.log(`Executing: ${cmd}`);
    try {
      const result = await execAsync(cmd, { timeout: 120000 });
      return result;
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      return {
        stdout: err.stdout || '',
        stderr: err.stderr || err.message || 'Unknown error',
      };
    }
  }

  /**
   * Check if the Kubernetes cluster is accessible
   */
  async isClusterAccessible(): Promise<boolean> {
    try {
      // Use 'get nodes' as a simple connectivity check - cleaner than cluster-info
      const result = await this.kubectl(['get', 'nodes', '-o', 'name']);
      // Success if exit code is 0 and we got some output
      return result.exitCode === 0 && result.stdout.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Check if Fleet CRD exists in the cluster
   */
  async checkFleetCrdExists(): Promise<boolean> {
    const result = await this.kubectl([
      'get', 'crd', 'gitrepos.fleet.cattle.io',
      '-o', 'jsonpath={.metadata.name}',
    ]);
    return !result.stderr && result.stdout.includes('gitrepos.fleet.cattle.io');
  }

  /**
   * Check if Fleet controller pod is running
   */
  async checkFleetPodRunning(): Promise<boolean> {
    const result = await this.kubectl([
      'get', 'pods', '-n', FLEET_SYSTEM_NAMESPACE,
      '-l', 'app=fleet-controller',
      '-o', 'jsonpath={.items[0].status.phase}',
    ]);
    return result.stdout === 'Running';
  }

  /**
   * Check if the Fleet namespace exists
   */
  async checkFleetNamespaceExists(): Promise<boolean> {
    const result = await this.kubectl([
      'get', 'namespace', FLEET_NAMESPACE,
      '-o', 'jsonpath={.metadata.name}',
    ]);
    return !result.stderr && result.stdout === FLEET_NAMESPACE;
  }

  /**
   * Create the Fleet namespace
   */
  async createFleetNamespace(): Promise<void> {
    const result = await this.kubectl(['create', 'namespace', FLEET_NAMESPACE]);
    if (result.stderr && !result.stderr.includes('already exists')) {
      throw new Error(result.stderr);
    }
  }

  /**
   * Get Fleet version from Helm release
   */
  async getFleetVersion(): Promise<string> {
    try {
      const result = await this.helm([
        'list', '-n', FLEET_SYSTEM_NAMESPACE,
        '-f', 'fleet',
        '-o', 'json',
      ]);
      const releases = JSON.parse(result.stdout || '[]');
      if (releases.length > 0) {
        return releases[0].app_version || releases[0].chart || 'unknown';
      }
    } catch {
      // Ignore parse errors
    }
    return 'unknown';
  }

  /**
   * Check Fleet status
   */
  async checkStatus(): Promise<FleetState> {
    this.log('Checking Fleet status...');

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
      this.log('Fleet pod not running');
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
   * Install Fleet using Helm
   */
  async installFleet(): Promise<void> {
    this.log('Starting Fleet installation...');

    // Add Helm repo
    this.setState({ status: 'installing', message: 'Adding Fleet Helm repository...' });
    let result = await this.helm([
      'repo', 'add', 'fleet', 'https://rancher.github.io/fleet-helm-charts/',
    ]);
    if (result.stderr && !result.stderr.includes('already exists')) {
      this.log(`Helm repo add output: ${result.stderr}`);
    }

    // Update repos
    this.setState({ status: 'installing', message: 'Updating Helm repositories...' });
    result = await this.helm(['repo', 'update']);
    if (result.stderr) {
      this.log(`Helm repo update output: ${result.stderr}`);
    }

    // Install Fleet CRD
    this.setState({ status: 'installing', message: 'Installing Fleet CRDs...' });
    result = await this.helm([
      'install', '--create-namespace', '-n', FLEET_SYSTEM_NAMESPACE,
      'fleet-crd', 'fleet/fleet-crd',
      '--wait',
    ]);
    if (result.stderr && !result.stderr.includes('already exists') && !result.stderr.includes('cannot re-use')) {
      this.log(`Helm install fleet-crd output: ${result.stderr}`);
    }

    // Install Fleet controller
    this.setState({ status: 'installing', message: 'Installing Fleet controller...' });
    result = await this.helm([
      'install', '--create-namespace', '-n', FLEET_SYSTEM_NAMESPACE,
      'fleet', 'fleet/fleet',
      '--wait',
    ]);
    if (result.stderr && !result.stderr.includes('already exists') && !result.stderr.includes('cannot re-use')) {
      this.log(`Helm install fleet output: ${result.stderr}`);
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
}

export const fleetService = new FleetService();
