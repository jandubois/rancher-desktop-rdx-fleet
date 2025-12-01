import { Router } from 'express';
import os from 'os';

export const initRouter = Router();

/** Installed extension info from rdctl extension ls */
interface InstalledExtension {
  name: string;
  tag: string;
  labels?: Record<string, string>;
}

/** Initialization request from frontend */
interface InitRequest {
  installedExtensions: InstalledExtension[];
  kubeconfig?: string;
}

/** Ownership status response */
interface OwnershipStatus {
  isOwner: boolean;
  currentOwner?: string;
  ownContainerId: string;
  status: 'claimed' | 'yielded' | 'waiting' | 'taken-over' | 'pending';
  message: string;
}

// Store initialization state
let initialized = false;
let lastInitTime: string | null = null;
let installedFleetExtensions: InstalledExtension[] = [];
let storedKubeconfig: string | null = null;

/**
 * Initialize the backend with extension context.
 *
 * POST /api/init
 * Body: { installedExtensions: [...], kubeconfig?: string }
 *
 * This is called by the frontend on startup to provide:
 * - List of installed Fleet extensions (from rdctl extension ls)
 * - Kubeconfig for kubectl access (if needed)
 */
initRouter.post('/', (req, res) => {
  const { installedExtensions, kubeconfig } = req.body as InitRequest;

  // Validate input
  if (!installedExtensions || !Array.isArray(installedExtensions)) {
    return res.status(400).json({
      error: 'installedExtensions must be an array',
    });
  }

  // Store the data
  installedFleetExtensions = installedExtensions;
  if (kubeconfig) {
    storedKubeconfig = kubeconfig;
  }
  initialized = true;
  lastInitTime = new Date().toISOString();

  const containerId = os.hostname();
  const extensionName = process.env.EXTENSION_NAME || 'fleet-gitops';

  console.log(`[Init] Received ${installedExtensions.length} installed extensions`);
  console.log(`[Init] Fleet extensions:`, installedExtensions.map(e => e.name).join(', '));
  console.log(`[Init] Own identity: ${extensionName} (${containerId})`);

  // For now, return a simple status - ownership logic will be added later
  const status: OwnershipStatus = {
    isOwner: true, // Placeholder - will implement ownership check
    ownContainerId: containerId,
    status: 'pending',
    message: 'Initialization received, ownership check not yet implemented',
  };

  res.json(status);
});

/**
 * Get current initialization status.
 *
 * GET /api/init
 */
initRouter.get('/', (req, res) => {
  res.json({
    initialized,
    lastInitTime,
    installedExtensionsCount: installedFleetExtensions.length,
    installedExtensions: installedFleetExtensions.map(e => ({
      name: e.name,
      hasFleetLabel: !!e.labels?.['io.rancher-desktop.fleet.type'],
    })),
    hasKubeconfig: !!storedKubeconfig,
    ownContainerId: os.hostname(),
    ownExtensionName: process.env.EXTENSION_NAME || 'fleet-gitops',
  });
});

// Export stored data for use by other modules
export function getInitState() {
  return {
    initialized,
    installedFleetExtensions,
    kubeconfig: storedKubeconfig,
  };
}
