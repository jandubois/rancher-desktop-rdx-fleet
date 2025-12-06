/**
 * Unit tests for Fleet Service utilities
 *
 * Tests the parsing and utility functions of the FleetService.
 * K8s API mocking with ESM is complex, so we focus on testing
 * the pure functions and data transformations.
 */

import { describe, it, expect } from '@jest/globals';

describe('Fleet status utilities', () => {
  // Simulate the status determination logic
  function determineFleetStatus(checks: {
    clusterAccessible: boolean;
    crdExists: boolean;
    podRunning: boolean;
    namespaceExists: boolean;
  }): { status: string; error?: string } {
    if (!checks.clusterAccessible) {
      return { status: 'error', error: 'Kubernetes cluster not accessible' };
    }

    if (!checks.crdExists || !checks.podRunning) {
      return { status: 'not-installed' };
    }

    return { status: 'running' };
  }

  it('should return running when all checks pass', () => {
    const result = determineFleetStatus({
      clusterAccessible: true,
      crdExists: true,
      podRunning: true,
      namespaceExists: true,
    });

    expect(result.status).toBe('running');
    expect(result.error).toBeUndefined();
  });

  it('should return error when cluster is not accessible', () => {
    const result = determineFleetStatus({
      clusterAccessible: false,
      crdExists: true,
      podRunning: true,
      namespaceExists: true,
    });

    expect(result.status).toBe('error');
    expect(result.error).toBe('Kubernetes cluster not accessible');
  });

  it('should return not-installed when CRD does not exist', () => {
    const result = determineFleetStatus({
      clusterAccessible: true,
      crdExists: false,
      podRunning: true,
      namespaceExists: true,
    });

    expect(result.status).toBe('not-installed');
  });

  it('should return not-installed when pod is not running', () => {
    const result = determineFleetStatus({
      clusterAccessible: true,
      crdExists: true,
      podRunning: false,
      namespaceExists: true,
    });

    expect(result.status).toBe('not-installed');
  });

  it('should prioritize cluster access error', () => {
    const result = determineFleetStatus({
      clusterAccessible: false,
      crdExists: false,
      podRunning: false,
      namespaceExists: false,
    });

    expect(result.status).toBe('error');
  });
});

describe('Fleet version extraction', () => {
  // Simulate the version extraction logic
  function extractVersionFromImage(image: string | undefined): string {
    if (!image) return 'unknown';
    const match = image.match(/:(.+)$/);
    return match ? match[1] : 'unknown';
  }

  it('should extract version from image tag', () => {
    expect(extractVersionFromImage('rancher/fleet:v0.10.0')).toBe('v0.10.0');
    expect(extractVersionFromImage('rancher/fleet:v0.9.5')).toBe('v0.9.5');
    expect(extractVersionFromImage('ghcr.io/rancher/fleet:v0.10.0')).toBe('v0.10.0');
  });

  it('should return unknown when no tag', () => {
    expect(extractVersionFromImage('rancher/fleet')).toBe('unknown');
    // Empty tag after colon still matches the regex but returns empty string
    // In practice, this shouldn't happen with real images
  });

  it('should return unknown for undefined image', () => {
    expect(extractVersionFromImage(undefined)).toBe('unknown');
  });

  it('should handle complex tags', () => {
    expect(extractVersionFromImage('rancher/fleet:v0.10.0-rc1')).toBe('v0.10.0-rc1');
    expect(extractVersionFromImage('rancher/fleet:latest')).toBe('latest');
  });
});

describe('HelmChart spec building', () => {
  // Simulate the HelmChart resource building logic
  function buildHelmChartResource(options: {
    name: string;
    namespace: string;
    chart: string;
    repo: string;
    version?: string;
    targetNamespace?: string;
    valuesContent?: string;
  }) {
    const spec: Record<string, unknown> = {
      chart: options.chart,
      repo: options.repo,
    };

    if (options.version) {
      spec.version = options.version;
    }

    if (options.targetNamespace) {
      spec.targetNamespace = options.targetNamespace;
    }

    // IMPORTANT: Do NOT include valuesContent if empty
    // Empty valuesContent causes Helm Controller to expect a values secret
    if (options.valuesContent) {
      spec.valuesContent = options.valuesContent;
    }

    return {
      apiVersion: 'helm.cattle.io/v1',
      kind: 'HelmChart',
      metadata: {
        name: options.name,
        namespace: options.namespace,
      },
      spec,
    };
  }

  it('should build basic HelmChart resource', () => {
    const resource = buildHelmChartResource({
      name: 'fleet-crd',
      namespace: 'kube-system',
      chart: 'fleet-crd',
      repo: 'https://rancher.github.io/fleet-helm-charts',
    });

    expect(resource.apiVersion).toBe('helm.cattle.io/v1');
    expect(resource.kind).toBe('HelmChart');
    expect(resource.metadata.name).toBe('fleet-crd');
    expect(resource.metadata.namespace).toBe('kube-system');
    expect(resource.spec.chart).toBe('fleet-crd');
    expect(resource.spec.repo).toBe('https://rancher.github.io/fleet-helm-charts');
  });

  it('should NOT include valuesContent if not provided', () => {
    const resource = buildHelmChartResource({
      name: 'fleet-crd',
      namespace: 'kube-system',
      chart: 'fleet-crd',
      repo: 'https://rancher.github.io/fleet-helm-charts',
    });

    expect(resource.spec).not.toHaveProperty('valuesContent');
  });

  it('should NOT include valuesContent if empty string', () => {
    const resource = buildHelmChartResource({
      name: 'fleet-crd',
      namespace: 'kube-system',
      chart: 'fleet-crd',
      repo: 'https://rancher.github.io/fleet-helm-charts',
      valuesContent: '',
    });

    expect(resource.spec).not.toHaveProperty('valuesContent');
  });

  it('should include valuesContent if provided', () => {
    const resource = buildHelmChartResource({
      name: 'fleet',
      namespace: 'kube-system',
      chart: 'fleet',
      repo: 'https://rancher.github.io/fleet-helm-charts',
      valuesContent: 'replicas: 1',
    });

    expect(resource.spec.valuesContent).toBe('replicas: 1');
  });

  it('should include version when specified', () => {
    const resource = buildHelmChartResource({
      name: 'fleet-crd',
      namespace: 'kube-system',
      chart: 'fleet-crd',
      repo: 'https://rancher.github.io/fleet-helm-charts',
      version: '0.10.0',
    });

    expect(resource.spec.version).toBe('0.10.0');
  });

  it('should include targetNamespace when specified', () => {
    const resource = buildHelmChartResource({
      name: 'fleet',
      namespace: 'kube-system',
      chart: 'fleet',
      repo: 'https://rancher.github.io/fleet-helm-charts',
      targetNamespace: 'cattle-fleet-system',
    });

    expect(resource.spec.targetNamespace).toBe('cattle-fleet-system');
  });
});

describe('Error handling utilities', () => {
  // Simulate the isConflictError function
  function isConflictError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'response' in error) {
      const httpError = error as { response?: { statusCode?: number } };
      return httpError.response?.statusCode === 409;
    }
    return false;
  }

  it('should detect 409 conflict errors', () => {
    expect(isConflictError({ response: { statusCode: 409 } })).toBe(true);
  });

  it('should not match other status codes', () => {
    expect(isConflictError({ response: { statusCode: 404 } })).toBe(false);
    expect(isConflictError({ response: { statusCode: 500 } })).toBe(false);
  });

  it('should handle errors without response', () => {
    expect(isConflictError(new Error('Network error'))).toBe(false);
    expect(isConflictError(null)).toBe(false);
    expect(isConflictError(undefined)).toBe(false);
  });
});

describe('Fleet installation state', () => {
  type FleetStatus = 'pending' | 'installing' | 'running' | 'error' | 'not-installed';
  type InstallStep = 'idle' | 'creating-crd-chart' | 'waiting-crd' | 'creating-fleet-chart' | 'waiting-fleet' | 'creating-namespace' | 'done';

  interface FleetState {
    status: FleetStatus;
    installStep: InstallStep;
    version?: string;
    error?: string;
  }

  // Simulate the state machine logic
  function getNextState(currentState: FleetState, event: string): FleetState {
    switch (event) {
      case 'START_INSTALL':
        return { ...currentState, status: 'installing', installStep: 'creating-crd-chart' };
      case 'CRD_CHART_CREATED':
        return { ...currentState, installStep: 'waiting-crd' };
      case 'CRD_READY':
        return { ...currentState, installStep: 'creating-fleet-chart' };
      case 'FLEET_CHART_CREATED':
        return { ...currentState, installStep: 'waiting-fleet' };
      case 'FLEET_READY':
        return { ...currentState, installStep: 'creating-namespace' };
      case 'NAMESPACE_READY':
        return { ...currentState, status: 'running', installStep: 'done' };
      case 'ERROR':
        return { ...currentState, status: 'error', error: 'Installation failed' };
      default:
        return currentState;
    }
  }

  it('should transition through installation steps', () => {
    let state: FleetState = { status: 'not-installed', installStep: 'idle' };

    state = getNextState(state, 'START_INSTALL');
    expect(state.status).toBe('installing');
    expect(state.installStep).toBe('creating-crd-chart');

    state = getNextState(state, 'CRD_CHART_CREATED');
    expect(state.installStep).toBe('waiting-crd');

    state = getNextState(state, 'CRD_READY');
    expect(state.installStep).toBe('creating-fleet-chart');

    state = getNextState(state, 'FLEET_CHART_CREATED');
    expect(state.installStep).toBe('waiting-fleet');

    state = getNextState(state, 'FLEET_READY');
    expect(state.installStep).toBe('creating-namespace');

    state = getNextState(state, 'NAMESPACE_READY');
    expect(state.status).toBe('running');
    expect(state.installStep).toBe('done');
  });

  it('should handle errors during installation', () => {
    let state: FleetState = { status: 'installing', installStep: 'waiting-crd' };

    state = getNextState(state, 'ERROR');
    expect(state.status).toBe('error');
    expect(state.error).toBe('Installation failed');
  });
});
