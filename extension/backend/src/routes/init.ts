/**
 * Initialization Routes - Backend initialization with extension context.
 *
 * Handles:
 * - POST /api/init - Initialize backend with extensions list and kubeconfig
 * - GET /api/init - Get current initialization status
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

  // Enrich extensions with labels from Docker containers
  // rdctl extension ls doesn't include image labels, so we get them from running containers
  const dockerContainers = await dockerService.listContainers();
  log(`Found ${dockerContainers.length} Docker containers for label enrichment`);

  // Log container info for debugging
  dockerContainers.forEach(c => {
    const hasFleetLabel = c.labels['io.rancher-desktop.fleet.type'] ? 'YES' : 'no';
    log(`  Container: ${c.name} | Image: ${c.image} | Fleet label: ${hasFleetLabel}`);
  });

  // First, enrich extensions from rdctl with Docker labels
  installedFleetExtensions = installedExtensions.map((ext: InstalledExtension) => {
    const extNameNormalized = ext.name.replace(/[/:]/g, '-').toLowerCase();

    const matchingContainer = dockerContainers.find(c => {
      const containerNameNormalized = c.name.toLowerCase();
      const imageNameNormalized = c.image.toLowerCase();

      return (
        imageNameNormalized.includes(ext.name.toLowerCase()) ||
        containerNameNormalized.includes(extNameNormalized) ||
        imageNameNormalized.startsWith(ext.name.split(':')[0].toLowerCase())
      );
    });

    if (matchingContainer) {
      const fleetLabels = Object.entries(matchingContainer.labels)
        .filter(([k]) => k.startsWith('io.rancher-desktop.fleet'))
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');

      log(`  - ${ext.name}: matched container ${matchingContainer.name} (fleet labels: ${fleetLabels || 'none'})`);

      if (Object.keys(matchingContainer.labels).length > 0) {
        return {
          ...ext,
          labels: { ...ext.labels, ...matchingContainer.labels },
        };
      }
    } else {
      log(`  - ${ext.name}: no matching container found`);
    }

    const fleetType = ext.labels?.['io.rancher-desktop.fleet.type'] || 'none';
    log(`  - ${ext.name} (fleet.type: ${fleetType})`);
    return ext;
  });

  // Second, add Fleet extensions detected from Docker that weren't in the rdctl list
  // This handles the case when rdctl extension ls returns empty or fails
  const fleetContainersFromDocker = dockerContainers.filter(c =>
    c.labels['io.rancher-desktop.fleet.type']
  );

  log(`Found ${fleetContainersFromDocker.length} Fleet containers from Docker`);

  for (const container of fleetContainersFromDocker) {
    // Extract extension name from image
    const imageName = container.image.split(':')[0]; // Remove tag

    // Check if this extension is already in the list
    const alreadyExists = installedFleetExtensions.some(ext =>
      ext.name.includes(imageName) || imageName.includes(ext.name.split(':')[0])
    );

    if (!alreadyExists) {
      log(`  + Adding Fleet extension from Docker: ${imageName} (image: ${container.image})`);
      installedFleetExtensions.push({
        name: imageName,
        tag: container.image.split(':')[1] || 'latest',
        labels: container.labels,
      });
    }
  }

  log(`Total Fleet extensions after enrichment: ${installedFleetExtensions.length}`);

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

      // Initialize ownership service
      await ownershipService.initialize(kubeconfig);
      log('Ownership service initialized');

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
