/**
 * Initialization Routes - Backend initialization with extension context.
 *
 * Handles:
 * - POST /api/init - Initialize backend with extensions list (including labels) and kubeconfig
 * - GET /api/init - Get current initialization status
 *
 * The frontend uses `rdctl api /v1/extensions` which provides extension info
 * including OCI labels, so no Docker container enrichment is needed here.
 *
 * Note: Ownership routes are in /api/ownership (see ownership.ts)
 */

import { Router } from 'express';
import os from 'os';
import { ownershipService, InstalledExtension, OwnershipStatus } from '../services/ownership.js';
import { dockerService } from '../services/docker.js';
import { fleetService } from '../services/fleet.js';
import { gitRepoService } from '../services/gitrepos.js';
import { secretsService } from '../services/secrets.js';
import { manifestService } from '../services/manifest.js';

export const initRouter = Router();

// Store initialization state
let initialized = false;
let lastInitTime: string | null = null;
let installedFleetExtensions: InstalledExtension[] = [];
let lastOwnershipStatus: OwnershipStatus | null = null;
let initializationLog: string[] = [];

function log(message: string): void {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${message}`;
  console.log(`[Init] ${message}`);
  initializationLog.push(entry);
  if (initializationLog.length > 100) {
    initializationLog = initializationLog.slice(-100);
  }
}

// Track whether we've synced GitRepos from manifest
let hasSyncedGitReposFromManifest = false;

/**
 * Sync GitRepos from manifest defaults to Kubernetes.
 * Called after this extension claims ownership.
 * Waits for Fleet to be ready before creating GitRepo resources.
 */
export async function syncGitReposFromManifest(): Promise<void> {
  // Only sync once
  if (hasSyncedGitReposFromManifest) {
    log('GitRepos already synced from manifest, skipping');
    return;
  }

  log('Starting GitRepo sync from manifest...');

  // Wait for Fleet to be running (poll with timeout)
  const maxWaitMs = 120000; // 2 minutes
  const pollIntervalMs = 2000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const fleetState = fleetService.getState();
    if (fleetState.status === 'running') {
      log('Fleet is running, proceeding with GitRepo sync...');
      break;
    }

    if (fleetState.status === 'error') {
      log(`Fleet is in error state: ${fleetState.error}, aborting GitRepo sync`);
      return;
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    log(`Waiting for Fleet... (${elapsed}s elapsed, status: ${fleetState.status})`);
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  // Check if we timed out
  const fleetState = fleetService.getState();
  if (fleetState.status !== 'running') {
    log(`Timed out waiting for Fleet (status: ${fleetState.status}), aborting GitRepo sync`);
    return;
  }

  // Check if GitRepo service is ready
  if (!gitRepoService.isReady()) {
    log('GitRepo service not ready, aborting GitRepo sync');
    return;
  }

  // Delete all existing GitRepos first (clean slate for new extension)
  // This ensures old extension's GitRepos are removed when switching
  // This must happen even if we have no defaults to create
  try {
    const existingRepos = await gitRepoService.listGitRepos();
    if (existingRepos.length > 0) {
      log(`Deleting ${existingRepos.length} existing GitRepos before sync...`);
      for (const repo of existingRepos) {
        try {
          await gitRepoService.deleteGitRepo(repo.name);
          log(`Deleted GitRepo: ${repo.name}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log(`Failed to delete GitRepo ${repo.name}: ${msg}`);
          // Continue with other deletions
        }
      }
    }
  } catch (err) {
    log(`Failed to list existing GitRepos: ${err}`);
    // Continue anyway - we'll try to create our repos
  }

  // Check if manifest has any GitRepo defaults to create
  const defaults = manifestService.extractGitRepoDefaults();
  if (defaults.length === 0) {
    log('No GitRepo defaults found in manifest, sync complete (only cleanup was done)');
    hasSyncedGitReposFromManifest = true;
    return;
  }

  log(`Found ${defaults.length} GitRepo defaults in manifest, creating...`);

  // Create GitRepos from manifest defaults
  for (const config of defaults) {
    try {
      log(`Creating GitRepo: ${config.name} -> ${config.repo} (${config.paths.length} paths)`);
      await gitRepoService.applyGitRepo({
        name: config.name,
        repo: config.repo,
        branch: config.branch,
        paths: config.paths,
      });
      log(`Successfully created GitRepo: ${config.name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`Failed to create GitRepo ${config.name}: ${msg}`);
      // Continue with other repos
    }
  }

  hasSyncedGitReposFromManifest = true;
  log('GitRepo sync from manifest complete');
}

/**
 * Reset the sync flag when ownership changes.
 * Called when this extension loses ownership or when explicitly reset.
 */
export function resetGitRepoSyncFlag(): void {
  hasSyncedGitReposFromManifest = false;
}

/**
 * Initialize the backend with extension context.
 *
 * POST /api/init
 * Body: { installedExtensions: [...], kubeconfig?: string }
 */
initRouter.post('/', async (req, res) => {
  const { installedExtensions, kubeconfig, debugInfo, ownExtensionImage } = req.body;

  log('=== Initialization request received ===');

  // Log frontend debug info if provided
  if (debugInfo && Array.isArray(debugInfo) && debugInfo.length > 0) {
    log('Frontend debug info:');
    debugInfo.forEach((info: string) => log(`  ${info}`));
  }

  // Set own extension image name if provided by frontend
  if (ownExtensionImage && typeof ownExtensionImage === 'string') {
    ownershipService.setOwnExtensionName(ownExtensionImage);
    log(`Own extension image set to: ${ownExtensionImage}`);
  }

  // Validate input
  if (!installedExtensions || !Array.isArray(installedExtensions)) {
    log('ERROR: installedExtensions must be an array');
    return res.status(400).json({
      error: 'installedExtensions must be an array',
    });
  }

  // Store the extensions list
  lastInitTime = new Date().toISOString();

  log(`Received ${installedExtensions.length} installed extensions`);

  // Extensions now include labels directly from rdctl api /v1/extensions
  // No Docker container enrichment needed
  installedFleetExtensions = installedExtensions.map((ext: InstalledExtension) => {
    const fleetType = ext.labels?.['io.rancher-desktop.fleet.type'] || 'none';
    log(`  - ${ext.name}:${ext.tag || 'latest'} (fleet.type: ${fleetType})`);
    return ext;
  });

  log(`Total Fleet extensions: ${installedFleetExtensions.length}`);

  // Initialize kubernetes client if kubeconfig provided
  if (kubeconfig) {
    log('Kubeconfig provided, initializing Kubernetes clients...');
    try {
      // Patch kubeconfig for use inside the container
      let patchedKubeconfig = kubeconfig;
      patchedKubeconfig = patchedKubeconfig.replace(/https:\/\/localhost:/g, 'https://host.docker.internal:');
      patchedKubeconfig = patchedKubeconfig.replace(/https:\/\/127\.0\.0\.1:/g, 'https://host.docker.internal:');
      patchedKubeconfig = patchedKubeconfig.replace(
        /(server: https:\/\/host\.docker\.internal:[0-9]+)/g,
        '$1\n    insecure-skip-tls-verify: true'
      );

      // Initialize ownership service (if not already initialized from startup)
      if (!ownershipService.isReady()) {
        await ownershipService.initialize(patchedKubeconfig);
        log('Ownership service initialized');
      } else {
        log('Ownership service already initialized (from backend startup)');
      }

      // Initialize all Kubernetes services (if not already initialized from startup)
      if (!fleetService.isReady()) {
        fleetService.initialize(patchedKubeconfig);
        gitRepoService.initialize(patchedKubeconfig);
        secretsService.initialize(patchedKubeconfig);
        log('All Kubernetes services initialized with frontend kubeconfig');

        // Trigger Fleet auto-install now that kubeconfig is available
        log('Triggering Fleet auto-install...');
        fleetService.ensureFleetInstalled().then(() => {
          const state = fleetService.getState();
          log(`Fleet install result: ${state.status}`);
        }).catch(err => {
          log(`Fleet install error: ${err}`);
        });
      } else {
        // Ensure gitRepo and secrets services are initialized even if fleet was initialized at startup
        if (!gitRepoService.isReady()) {
          gitRepoService.initialize(patchedKubeconfig);
          log('GitRepo service initialized');
        }
        if (!secretsService.isReady()) {
          secretsService.initialize(patchedKubeconfig);
          log('Secrets service initialized');
        }
        log('Fleet service already initialized (from backend startup)');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log(`ERROR initializing Kubernetes clients: ${msg}`);
    }
  } else {
    log('WARNING: No kubeconfig provided, ownership check will fail');
  }

  // Check Docker availability
  const dockerAvailable = await dockerService.isAvailable();
  log(`Docker socket available: ${dockerAvailable}`);

  // Run ownership check
  if (ownershipService.isReady()) {
    log('Running ownership check...');
    try {
      lastOwnershipStatus = await ownershipService.checkOwnership(
        installedFleetExtensions,
        (extensionName) => dockerService.isExtensionRunning(extensionName)
      );
      log(`Ownership check complete: ${lastOwnershipStatus.status} - ${lastOwnershipStatus.message}`);

      // If we claimed ownership, sync GitRepos from manifest defaults
      if (lastOwnershipStatus.isOwner) {
        // Run async - don't block the init response
        syncGitReposFromManifest().catch(err => {
          log(`Error syncing GitRepos from manifest: ${err}`);
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log(`ERROR during ownership check: ${msg}`);
      lastOwnershipStatus = {
        isOwner: false,
        ownContainerId: os.hostname(),
        ownExtensionName: process.env.EXTENSION_NAME || 'fleet-gitops-extension',
        status: 'error',
        message: `Error during ownership check: ${msg}`,
        debugLog: ownershipService.getDebugLog(),
      };
    }
  } else {
    log('Kubernetes client not ready, skipping ownership check');
    lastOwnershipStatus = {
      isOwner: false,
      ownContainerId: os.hostname(),
      ownExtensionName: process.env.EXTENSION_NAME || 'fleet-gitops-extension',
      status: 'pending',
      message: 'Waiting for Kubernetes client initialization',
      debugLog: [],
    };
  }

  initialized = true;

  res.json({
    initialized: true,
    ownership: lastOwnershipStatus,
  });
});

/**
 * Get current initialization status.
 *
 * GET /api/init
 */
initRouter.get('/', async (req, res) => {
  const dockerAvailable = await dockerService.isAvailable();

  res.json({
    initialized,
    lastInitTime,
    installedExtensions: installedFleetExtensions.map(e => ({
      name: e.name,
      tag: e.tag,
      hasFleetLabel: !!e.labels?.['io.rancher-desktop.fleet.type'],
      fleetType: e.labels?.['io.rancher-desktop.fleet.type'] || null,
    })),
    kubernetesReady: ownershipService.isReady(),
    dockerAvailable,
    ownership: lastOwnershipStatus ? {
      isOwner: lastOwnershipStatus.isOwner,
      status: lastOwnershipStatus.status,
      message: lastOwnershipStatus.message,
      currentOwner: lastOwnershipStatus.currentOwner,
    } : null,
    ownIdentity: {
      containerId: os.hostname(),
      extensionName: ownershipService.getOwnExtensionName(),
    },
  });
});

// Export stored data for use by other modules
export function getInitState() {
  return {
    initialized,
    installedFleetExtensions,
    lastOwnershipStatus,
  };
}

// Allow ownership router to update status
export function setOwnershipStatus(status: OwnershipStatus) {
  lastOwnershipStatus = status;
}
