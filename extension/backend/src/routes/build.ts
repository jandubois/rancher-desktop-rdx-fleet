/**
 * Build Routes - Build custom extension images via Docker API.
 *
 * Handles:
 * - POST /api/build - Build a custom extension image
 * - POST /api/build/stream - Build with Server-Sent Events for progress
 * - GET /api/build/logs - Get build service debug logs
 */

import { Router, Request, Response } from 'express';
import { buildService, BuildRequest, BuildProgress } from '../services/build.js';

export const buildRouter = Router();

/**
 * Build a custom extension image.
 *
 * POST /api/build
 *
 * Request body: BuildRequest
 * Response: BuildResult
 */
buildRouter.post('/', async (req: Request, res: Response) => {
  const request = req.body as BuildRequest;

  // Validate required fields
  if (!request.imageName) {
    return res.status(400).json({ error: 'imageName is required' });
  }
  if (!request.baseImage) {
    return res.status(400).json({ error: 'baseImage is required' });
  }
  if (!request.title) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (!request.manifest) {
    return res.status(400).json({ error: 'manifest is required' });
  }
  if (!request.metadata) {
    return res.status(400).json({ error: 'metadata is required' });
  }

  try {
    const result = await buildService.buildImage(request);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      success: false,
      imageName: request.imageName,
      output: '',
      error: message,
    });
  }
});

/**
 * Build with Server-Sent Events for real-time progress.
 *
 * POST /api/build/stream
 *
 * Request body: BuildRequest
 * Response: Server-Sent Events stream
 *
 * Events:
 * - progress: { message: string, stream?: string }
 * - error: { message: string }
 * - complete: { success: boolean, imageName: string, output: string, error?: string }
 */
buildRouter.post('/stream', async (req: Request, res: Response) => {
  const request = req.body as BuildRequest;

  // Validate required fields
  if (!request.imageName || !request.baseImage || !request.title || !request.manifest || !request.metadata) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send progress events
  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const result = await buildService.buildImage(request, (progress: BuildProgress) => {
      sendEvent(progress.type, {
        message: progress.message,
        stream: progress.stream,
      });
    });

    // Send final result
    sendEvent('complete', result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendEvent('error', { message });
    sendEvent('complete', {
      success: false,
      imageName: request.imageName,
      output: '',
      error: message,
    });
  }

  res.end();
});

/**
 * Get build service debug logs.
 *
 * GET /api/build/logs
 */
buildRouter.get('/logs', (_req: Request, res: Response) => {
  res.json({
    logs: buildService.getDebugLog(),
  });
});
