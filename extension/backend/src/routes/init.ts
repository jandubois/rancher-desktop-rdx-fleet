/**
 * Initialization and Ownership Routes
 *
 * Handles:
 * - POST /api/init - Initialize backend with extensions list and kubeconfig
 * - GET /api/init - Get current initialization status
 * - GET /api/init/ownership - Get detailed ownership status for debugging
 * - POST /api/init/check-ownership - Re-run ownership check
 */

import { Router } from 'express';
import os from 'os';
import { ownershipService, InstalledExtension, OwnershipStatus } from '../services/ownership';
import { dockerService } from '../services/docker';

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
  const { installedExtensions, kubeconfig } = req.body;

  log('=== Initialization request received ===');

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
    c.labels['io.rancher-desktop.fleet.type'] ||
    c.labels['io.rancher-desktop.fleet.name']
  );

  log(`Found ${fleetContainersFromDocker.length} Fleet containers from Docker`);

  for (const container of fleetContainersFromDocker) {
    // Extract extension name from container name or image
    const imageName = container.image.split(':')[0]; // Remove tag
    const fleetName = container.labels['io.rancher-desktop.fleet.name'] || imageName;

    // Check if this extension is already in the list
    const alreadyExists = installedFleetExtensions.some(ext =>
      ext.name.includes(imageName) || imageName.includes(ext.name.split(':')[0])
    );

    if (!alreadyExists) {
      log(`  + Adding Fleet extension from Docker: ${fleetName} (image: ${container.image})`);
      installedFleetExtensions.push({
        name: fleetName,
        tag: container.image.split(':')[1] || 'latest',
        labels: container.labels,
      });
    }
  }

  log(`Total Fleet extensions after enrichment: ${installedFleetExtensions.length}`);

  // Initialize kubernetes client if kubeconfig provided
  if (kubeconfig) {
    log('Kubeconfig provided, initializing Kubernetes client...');
    try {
      await ownershipService.initialize(kubeconfig);
      log('Kubernetes client initialized successfully');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log(`ERROR initializing Kubernetes client: ${msg}`);
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
        ownExtensionName: process.env.EXTENSION_NAME || 'fleet-gitops',
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
      ownExtensionName: process.env.EXTENSION_NAME || 'fleet-gitops',
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
    installedExtensionsCount: installedFleetExtensions.length,
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
      extensionName: process.env.EXTENSION_NAME || 'fleet-gitops',
    },
  });
});

/**
 * Get detailed ownership status for debugging.
 *
 * GET /api/init/ownership
 */
initRouter.get('/ownership', async (req, res) => {
  const dockerInfo = await dockerService.getFleetContainerDebugInfo();

  res.json({
    ownership: lastOwnershipStatus,
    ownIdentity: {
      containerId: os.hostname(),
      extensionName: process.env.EXTENSION_NAME || 'fleet-gitops',
      priority: process.env.EXTENSION_PRIORITY || '100',
    },
    kubernetes: {
      ready: ownershipService.isReady(),
    },
    docker: {
      available: dockerInfo.available,
      fleetContainers: dockerInfo.containers,
      ownContainer: dockerInfo.ownContainer,
    },
    installedExtensions: installedFleetExtensions,
    logs: {
      init: initializationLog,
      ownership: ownershipService.getDebugLog(),
      docker: dockerService.getDebugLog(),
    },
  });
});

/**
 * Re-run ownership check.
 *
 * POST /api/init/check-ownership
 */
initRouter.post('/check-ownership', async (req, res) => {
  log('Manual ownership check requested');

  if (!ownershipService.isReady()) {
    return res.status(503).json({
      error: 'Kubernetes client not ready',
      message: 'Send kubeconfig via POST /api/init first',
    });
  }

  try {
    lastOwnershipStatus = await ownershipService.checkOwnership(
      installedFleetExtensions,
      (extensionName) => dockerService.isExtensionRunning(extensionName)
    );

    res.json({
      ownership: lastOwnershipStatus,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`ERROR during manual ownership check: ${msg}`);
    res.status(500).json({
      error: msg,
    });
  }
});

// Export stored data for use by other modules
export function getInitState() {
  return {
    initialized,
    installedFleetExtensions,
    lastOwnershipStatus,
  };
}
