/**
 * Git Routes
 *
 * Handles path discovery in Git repositories using shallow clones.
 *
 * Endpoints:
 * - POST /api/git/discover - Discover Fleet bundle paths in a repository
 * - GET /api/git/debug/logs - Get service debug logs
 */

import { Router } from 'express';
import { gitService, DiscoverRequest } from '../services/git.js';

export const gitRouter = Router();

/**
 * Discover Fleet bundle paths in a Git repository.
 *
 * POST /api/git/discover
 * Body: {
 *   repo: string,           // Repository URL (https://...)
 *   branch?: string,        // Optional branch (defaults to main/master)
 *   credentials?: {         // Optional credentials for private repos
 *     username: string,
 *     password: string
 *   },
 *   secretName?: string     // Use credentials from this K8s secret
 * }
 *
 * Response: {
 *   paths: PathInfo[],      // Discovered paths with dependencies
 *   branch: string,         // Actual branch used
 *   cloneTimeMs: number,    // Time taken to clone
 *   scanTimeMs: number      // Time taken to scan
 * }
 */
gitRouter.post('/discover', async (req, res) => {
  try {
    const { repo, branch, credentials, secretName } = req.body;

    // Validate required fields
    if (!repo || typeof repo !== 'string') {
      return res.status(400).json({
        error: 'repo is required and must be a string',
      });
    }

    // Validate repo URL format (must be HTTPS)
    if (!repo.startsWith('https://')) {
      return res.status(400).json({
        error: 'Only HTTPS repository URLs are supported',
      });
    }

    // Validate credentials if provided
    if (credentials) {
      if (!credentials.username || !credentials.password) {
        return res.status(400).json({
          error: 'credentials must include both username and password',
        });
      }
    }

    // Build request
    const request: DiscoverRequest = {
      repo,
      branch: branch || undefined,
      credentials: credentials || undefined,
      secretName: secretName || undefined,
    };

    console.log(`[Git] POST /api/git/discover - repo: ${repo}, branch: ${branch || '(auto)'}`);

    // Perform discovery
    const result = await gitService.discoverPaths(request);

    console.log(`[Git] Discovery complete: ${result.paths.length} paths found in ${result.cloneTimeMs + result.scanTimeMs}ms`);

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Git] Error discovering paths:', message);

    // Determine appropriate status code
    let statusCode = 500;
    if (message.includes('not found') || message.includes('could not find')) {
      statusCode = 404;
    } else if (message.includes('Authentication') || message.includes('auth')) {
      statusCode = 401;
    }

    res.status(statusCode).json({
      error: message,
    });
  }
});

/**
 * Get service debug logs.
 *
 * GET /api/git/debug/logs
 */
gitRouter.get('/debug/logs', (_req, res) => {
  res.json({
    ready: gitService.isReady(),
    logs: gitService.getDebugLog(),
  });
});
