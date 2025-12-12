/**
 * Unit tests for Fleet Service utilities
 *
 * Tests the exported utility functions from the Fleet service.
 * These tests import and test the actual exported functions from fleet.ts.
 */

import { describe, it, expect } from '@jest/globals';
import {
  isNotFoundError,
  isConflictError,
  extractVersionFromImage,
  determineFleetStatus,
  FleetStatus,
} from './fleet.js';

describe('isNotFoundError', () => {
  it('should detect 404 errors', () => {
    const error = { response: { statusCode: 404 } };
    expect(isNotFoundError(error)).toBe(true);
  });

  it('should not match other status codes', () => {
    expect(isNotFoundError({ response: { statusCode: 500 } })).toBe(false);
    expect(isNotFoundError({ response: { statusCode: 403 } })).toBe(false);
    expect(isNotFoundError({ response: { statusCode: 409 } })).toBe(false);
  });

  it('should handle errors without response', () => {
    expect(isNotFoundError(new Error('Network error'))).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
    expect(isNotFoundError(undefined)).toBe(false);
  });

  it('should handle errors with empty response', () => {
    expect(isNotFoundError({ response: {} })).toBe(false);
    expect(isNotFoundError({ response: null })).toBe(false);
  });
});

describe('isConflictError', () => {
  it('should detect 409 errors', () => {
    const error = { response: { statusCode: 409 } };
    expect(isConflictError(error)).toBe(true);
  });

  it('should not match other status codes', () => {
    expect(isConflictError({ response: { statusCode: 404 } })).toBe(false);
    expect(isConflictError({ response: { statusCode: 500 } })).toBe(false);
  });

  it('should handle errors without response', () => {
    expect(isConflictError(new Error('Conflict'))).toBe(false);
    expect(isConflictError(null)).toBe(false);
    expect(isConflictError(undefined)).toBe(false);
  });
});

describe('extractVersionFromImage', () => {
  it('should extract version from standard image format', () => {
    expect(extractVersionFromImage('rancher/fleet:v0.9.0')).toBe('v0.9.0');
    expect(extractVersionFromImage('fleet-controller:0.8.1')).toBe('0.8.1');
    expect(extractVersionFromImage('myregistry.io/fleet:latest')).toBe('latest');
  });

  it('should handle image with registry and port', () => {
    expect(extractVersionFromImage('registry.example.com:5000/fleet:v1.0.0')).toBe('v1.0.0');
  });

  it('should return unknown for images without tag', () => {
    expect(extractVersionFromImage('rancher/fleet')).toBe('unknown');
    expect(extractVersionFromImage('fleet')).toBe('unknown');
  });

  it('should handle empty string', () => {
    expect(extractVersionFromImage('')).toBe('unknown');
  });

  it('should handle complex tags', () => {
    expect(extractVersionFromImage('rancher/fleet:v0.10.0-rc1')).toBe('v0.10.0-rc1');
    expect(extractVersionFromImage('rancher/fleet:latest')).toBe('latest');
    expect(extractVersionFromImage('ghcr.io/rancher/fleet:v0.10.0')).toBe('v0.10.0');
  });
});

describe('determineFleetStatus', () => {
  it('should return running when all conditions are met', () => {
    const result = determineFleetStatus({
      clusterAccessible: true,
      crdExists: true,
      podRunning: true,
    });
    expect(result).toBe('running');
  });

  it('should return error when cluster is not accessible', () => {
    const result = determineFleetStatus({
      clusterAccessible: false,
      crdExists: true,
      podRunning: true,
    });
    expect(result).toBe('error');
  });

  it('should return not-installed when CRD does not exist', () => {
    const result = determineFleetStatus({
      clusterAccessible: true,
      crdExists: false,
      podRunning: true,
    });
    expect(result).toBe('not-installed');
  });

  it('should return not-installed when pod is not running', () => {
    const result = determineFleetStatus({
      clusterAccessible: true,
      crdExists: true,
      podRunning: false,
    });
    expect(result).toBe('not-installed');
  });

  it('should return not-installed when both CRD and pod are missing', () => {
    const result = determineFleetStatus({
      clusterAccessible: true,
      crdExists: false,
      podRunning: false,
    });
    expect(result).toBe('not-installed');
  });

  it('should prioritize error over not-installed', () => {
    const result = determineFleetStatus({
      clusterAccessible: false,
      crdExists: false,
      podRunning: false,
    });
    expect(result).toBe('error');
  });
});

describe('FleetStatus type', () => {
  it('should accept valid status values', () => {
    const validStatuses: FleetStatus[] = [
      'checking',
      'not-installed',
      'installing',
      'running',
      'error',
    ];

    // This test verifies the type system at compile time
    // and documents all valid status values
    expect(validStatuses).toHaveLength(5);
  });
});
