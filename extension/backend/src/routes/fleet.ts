/**
 * Fleet Status and Installation Routes
 *
 * Handles:
 * - GET /api/fleet/status - Get current Fleet installation status
 * - POST /api/fleet/install - Manually trigger Fleet installation
 * - GET /api/fleet/logs - Get Fleet service debug logs
 */

import { Router } from 'express';
import { fleetService } from '../services/fleet';

export const fleetRouter = Router();

/**
 * Get current Fleet status
 *
 * GET /api/fleet/status
 */
fleetRouter.get('/status', async (_req, res) => {
  const state = await fleetService.checkStatus();
  res.json(state);
});

/**
 * Get cached Fleet state (no re-check)
 *
 * GET /api/fleet/state
 */
fleetRouter.get('/state', (_req, res) => {
  res.json(fleetService.getState());
});

/**
 * Manually trigger Fleet installation
 *
 * POST /api/fleet/install
 */
fleetRouter.post('/install', async (_req, res) => {
  try {
    await fleetService.ensureFleetInstalled();
    res.json(fleetService.getState());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

/**
 * Get Fleet service debug logs
 *
 * GET /api/fleet/logs
 */
fleetRouter.get('/logs', (_req, res) => {
  res.json({
    logs: fleetService.getDebugLog(),
    currentState: fleetService.getState(),
  });
});
