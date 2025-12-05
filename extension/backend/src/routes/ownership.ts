/**
 * Ownership Routes - Manages Fleet extension ownership.
 *
 * Handles:
 * - GET /api/ownership - Get detailed ownership status
 * - POST /api/ownership/transfer - Transfer ownership to another extension
 * - POST /api/ownership/check - Re-run ownership check
 */

import { Router } from 'express';
import { ownershipService } from '../services/ownership';
import { dockerService } from '../services/docker';
import { getInitState, setOwnershipStatus } from './init';

export const ownershipRouter = Router();

const ownershipLog: string[] = [];

function log(message: string): void {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${message}`;
  console.log(`[OwnershipRoute] ${message}`);
  ownershipLog.push(entry);
  if (ownershipLog.length > 50) {
    ownershipLog.splice(0, ownershipLog.length - 50);
  }
}

/**
 * Get detailed ownership status.
 *
 * GET /api/ownership
 */
ownershipRouter.get('/', async (req, res) => {
  const { installedFleetExtensions, lastOwnershipStatus } = getInitState();
  const dockerInfo = await dockerService.getFleetContainerDebugInfo();

  res.json({
    ownership: lastOwnershipStatus,
    ownIdentity: {
      containerId: process.env.HOSTNAME || '',
      extensionName: process.env.EXTENSION_NAME || 'fleet-gitops-extension',
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
      route: ownershipLog,
      ownership: ownershipService.getDebugLog(),
      docker: dockerService.getDebugLog(),
    },
  });
});

/**
 * Transfer ownership to another extension.
 *
 * POST /api/ownership/transfer
 * Body: { newOwner: string }
 */
ownershipRouter.post('/transfer', async (req, res) => {
  const { newOwner } = req.body;

  log(`Transfer ownership requested to: ${newOwner}`);

  if (!newOwner || typeof newOwner !== 'string') {
    return res.status(400).json({
      error: 'newOwner is required and must be a string',
    });
  }

  if (!ownershipService.isReady()) {
    return res.status(503).json({
      error: 'Kubernetes client not ready',
      message: 'Backend not initialized yet',
    });
  }

  try {
    await ownershipService.transferOwnership(newOwner);

    // Re-run ownership check to update status
    const { installedFleetExtensions } = getInitState();
    const ownershipStatus = await ownershipService.checkOwnership(
      installedFleetExtensions,
      (extensionName) => dockerService.isExtensionRunning(extensionName)
    );
    setOwnershipStatus(ownershipStatus);

    log(`Ownership transferred to ${newOwner}, status: ${ownershipStatus.status}`);

    res.json({
      success: true,
      newOwner,
      ownership: ownershipStatus,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`ERROR during ownership transfer: ${msg}`);
    res.status(500).json({
      error: msg,
    });
  }
});

/**
 * Re-run ownership check.
 *
 * POST /api/ownership/check
 */
ownershipRouter.post('/check', async (req, res) => {
  log('Manual ownership check requested');

  if (!ownershipService.isReady()) {
    return res.status(503).json({
      error: 'Kubernetes client not ready',
      message: 'Backend not initialized yet',
    });
  }

  try {
    const { installedFleetExtensions } = getInitState();
    const ownershipStatus = await ownershipService.checkOwnership(
      installedFleetExtensions,
      (extensionName) => dockerService.isExtensionRunning(extensionName)
    );
    setOwnershipStatus(ownershipStatus);

    res.json({
      ownership: ownershipStatus,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`ERROR during manual ownership check: ${msg}`);
    res.status(500).json({
      error: msg,
    });
  }
});
