/**
 * Build Routes - Build and push custom extension images via Docker API.
 *
 * Handles:
 * - POST /api/build - Build a custom extension image
 * - POST /api/build/stream - Build with Server-Sent Events for progress
 * - GET /api/build/logs - Get build service debug logs
 * - POST /api/build/push/check - Check if an image name is pushable
 * - POST /api/build/push - Push an image to a registry
 * - POST /api/build/push/stream - Push with Server-Sent Events for progress
 */

import { Router, Request, Response } from 'express';
import { buildService, BuildRequest, BuildProgress, PushProgress, isPushableImageName } from '../services/build.js';

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

/**
 * Check if an image name is pushable to a registry.
 *
 * POST /api/build/push/check
 *
 * Request body: { imageName: string }
 * Response: { pushable: boolean, reason?: string }
 */
buildRouter.post('/push/check', (req: Request, res: Response) => {
  const { imageName } = req.body as { imageName?: string };

  if (!imageName) {
    return res.status(400).json({ error: 'imageName is required' });
  }

  const pushable = isPushableImageName(imageName);
  const response: { pushable: boolean; reason?: string } = { pushable };

  if (!pushable) {
    response.reason = 'Image name must include an org/repo format (e.g., "myorg/my-extension") or a registry (e.g., "ghcr.io/myorg/my-extension"). Simple names like "my-extension" map to "library/my-extension" which cannot be pushed.';
  }

  res.json(response);
});

/**
 * Push an image to a registry.
 *
 * POST /api/build/push
 *
 * Request body: { imageName: string }
 * Response: PushResult (always 200, check success field for result)
 */
buildRouter.post('/push', async (req: Request, res: Response) => {
  const { imageName } = req.body as { imageName?: string };

  if (!imageName) {
    return res.status(400).json({ error: 'imageName is required' });
  }

  try {
    const result = await buildService.pushImage(imageName);
    // Always return 200 so the frontend can read the error details
    // The success field indicates whether the push succeeded
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Return 200 with success=false so error details are preserved
    res.json({
      success: false,
      imageName,
      output: '',
      error: message,
    });
  }
});

/**
 * Push with Server-Sent Events for real-time progress.
 *
 * POST /api/build/push/stream
 *
 * Request body: { imageName: string }
 * Response: Server-Sent Events stream
 */
buildRouter.post('/push/stream', async (req: Request, res: Response) => {
  const { imageName } = req.body as { imageName?: string };

  if (!imageName) {
    return res.status(400).json({ error: 'imageName is required' });
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
    const result = await buildService.pushImage(imageName, (progress: PushProgress) => {
      sendEvent(progress.type, {
        message: progress.message,
      });
    });

    // Send final result
    sendEvent('complete', result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendEvent('error', { message });
    sendEvent('complete', {
      success: false,
      imageName,
      output: '',
      error: message,
    });
  }

  res.end();
});
