/**
 * Icons Routes - Extract icons from Docker extension images.
 *
 * Handles:
 * - GET /api/icons - Get all Fleet extension images with their icons
 * - POST /api/icons/extract - Extract icon from a specific image
 * - GET /api/icons/logs - Get debug logs
 */

import { Router, Request, Response } from 'express';
import { iconsService } from '../services/icons.js';

export const iconsRouter = Router();

/**
 * Get all Fleet extension images with their icons.
 * This is the recommended endpoint - it returns complete image info
 * including extracted icons, all from the backend.
 *
 * GET /api/icons
 *
 * Response: {
 *   images: FleetImageWithIcon[]
 * }
 */
iconsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const images = await iconsService.listFleetImagesWithIcons();
    res.json({ images });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

/**
 * Extract icon from a specific image.
 *
 * POST /api/icons/extract
 *
 * Request body: { imageName: string, iconPath: string }
 * Response: { data: string, mimeType: string } or { error: string }
 */
iconsRouter.post('/extract', async (req: Request, res: Response) => {
  const { imageName, iconPath } = req.body as { imageName?: string; iconPath?: string };

  if (!imageName) {
    return res.status(400).json({ error: 'imageName is required' });
  }
  if (!iconPath) {
    return res.status(400).json({ error: 'iconPath is required' });
  }

  try {
    const result = await iconsService.extractIcon(imageName, iconPath);

    if (result) {
      res.json(result);
    } else {
      res.status(404).json({ error: 'Icon not found' });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

/**
 * Get debug logs for icon extraction.
 *
 * GET /api/icons/logs
 */
iconsRouter.get('/logs', (_req: Request, res: Response) => {
  res.json({
    logs: iconsService.getDebugLog(),
  });
});

/**
 * Get raw Docker labels for all Fleet images.
 * This helps debug icon path mismatches.
 *
 * GET /api/icons/labels
 */
iconsRouter.get('/labels', async (_req: Request, res: Response) => {
  try {
    const labels = await iconsService.getFleetImageLabels();
    res.json({ images: labels });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});
