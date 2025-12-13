/**
 * GitRepo Routes
 *
 * Handles:
 * - GET /api/gitrepos - List all GitRepos
 * - GET /api/gitrepos/:name - Get a specific GitRepo
 * - POST /api/gitrepos - Create or update a GitRepo
 * - POST /api/gitrepos/sync-defaults - Sync GitRepos from frontend-provided defaults
 * - DELETE /api/gitrepos/:name - Delete a GitRepo
 */

import { Router } from 'express';
import { gitRepoService } from '../services/gitrepos.js';
import { ownershipService } from '../services/ownership.js';
import { syncGitRepos, type GitRepoDefault } from './init.js';

export const gitReposRouter = Router();

/**
 * List all GitRepos
 *
 * GET /api/gitrepos
 */
gitReposRouter.get('/', async (_req, res) => {
  try {
    if (!gitRepoService.isReady()) {
      return res.status(503).json({
        error: 'Service not ready',
        message: 'Kubernetes client not initialized. Wait for backend initialization.',
      });
    }

    const gitRepos = await gitRepoService.listGitRepos();
    res.json({ items: gitRepos });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log('[GitRepos] Error listing GitRepos:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * Get a specific GitRepo by name
 *
 * GET /api/gitrepos/:name
 */
gitReposRouter.get('/:name', async (req, res) => {
  try {
    if (!gitRepoService.isReady()) {
      return res.status(503).json({
        error: 'Service not ready',
        message: 'Kubernetes client not initialized. Wait for backend initialization.',
      });
    }

    const { name } = req.params;
    const gitRepo = await gitRepoService.getGitRepo(name);

    if (!gitRepo) {
      return res.status(404).json({ error: `GitRepo '${name}' not found` });
    }

    res.json(gitRepo);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log('[GitRepos] Error getting GitRepo:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * Create or update a GitRepo
 *
 * POST /api/gitrepos
 * Body: { name: string, repo: string, branch?: string, paths?: string[], paused?: boolean }
 */
gitReposRouter.post('/', async (req, res) => {
  try {
    if (!gitRepoService.isReady()) {
      return res.status(503).json({
        error: 'Service not ready',
        message: 'Kubernetes client not initialized. Wait for backend initialization.',
      });
    }

    const { name, repo, branch, paths, paused } = req.body;

    // Log the received request for debugging
    console.log('[GitRepos] POST /api/gitrepos received:', JSON.stringify({
      name,
      repo,
      branch,
      paths,
      paused,
      pathsType: typeof paths,
      pathsIsArray: Array.isArray(paths),
      rawBody: req.body,
    }, null, 2));

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required and must be a string' });
    }

    if (!repo || typeof repo !== 'string') {
      return res.status(400).json({ error: 'repo is required and must be a string' });
    }

    const gitRepo = await gitRepoService.applyGitRepo({
      name,
      repo,
      branch,
      paths,
      paused,
    });

    res.json(gitRepo);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log('[GitRepos] Error applying GitRepo:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * Sync GitRepos from frontend-provided defaults.
 * Used when loading an extension from ZIP/image whose manifest has defaults
 * that need to be synced, even when ownership doesn't change.
 *
 * POST /api/gitrepos/sync-defaults
 * Body: { defaults: GitRepoDefault[] }
 */
gitReposRouter.post('/sync-defaults', async (req, res) => {
  console.log('[GitRepos] POST /api/gitrepos/sync-defaults received');

  try {
    if (!gitRepoService.isReady()) {
      return res.status(503).json({
        error: 'Service not ready',
        message: 'Kubernetes client not initialized. Wait for backend initialization.',
      });
    }

    // Verify we're the owner before allowing sync
    const isOwner = await ownershipService.isCurrentOwner();
    if (!isOwner) {
      console.log('[GitRepos] sync-defaults: Not the owner, rejecting request');
      return res.status(403).json({
        error: 'Not authorized',
        message: 'Only the active extension owner can sync GitRepo defaults',
      });
    }

    const { defaults } = req.body;

    // Validate defaults array
    if (!defaults || !Array.isArray(defaults)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'defaults must be an array of GitRepoDefault objects',
      });
    }

    // Validate each default item
    for (let i = 0; i < defaults.length; i++) {
      const item = defaults[i] as GitRepoDefault;
      if (!item.name || typeof item.name !== 'string') {
        return res.status(400).json({
          error: 'Invalid request',
          message: `defaults[${i}].name is required and must be a string`,
        });
      }
      if (!item.repo || typeof item.repo !== 'string') {
        return res.status(400).json({
          error: 'Invalid request',
          message: `defaults[${i}].repo is required and must be a string`,
        });
      }
      if (!Array.isArray(item.paths)) {
        return res.status(400).json({
          error: 'Invalid request',
          message: `defaults[${i}].paths is required and must be an array`,
        });
      }
    }

    // Use the shared syncGitRepos function with shorter timeout for API calls
    const result = await syncGitRepos(defaults as GitRepoDefault[], { maxWaitMs: 30000 });

    if (!result.success && result.message.includes('Fleet')) {
      return res.status(503).json({
        error: 'Fleet not ready',
        message: result.message,
      });
    }

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log('[GitRepos] Error in sync-defaults:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * Delete a GitRepo by name
 *
 * DELETE /api/gitrepos/:name
 */
gitReposRouter.delete('/:name', async (req, res) => {
  try {
    if (!gitRepoService.isReady()) {
      return res.status(503).json({
        error: 'Service not ready',
        message: 'Kubernetes client not initialized. Wait for backend initialization.',
      });
    }

    const { name } = req.params;
    await gitRepoService.deleteGitRepo(name);
    res.json({ success: true, message: `GitRepo '${name}' deleted` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log('[GitRepos] Error deleting GitRepo:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * Delete a GitRepo by name (POST alternative for clients that don't support DELETE)
 *
 * POST /api/gitrepos/:name/delete
 */
gitReposRouter.post('/:name/delete', async (req, res) => {
  try {
    if (!gitRepoService.isReady()) {
      return res.status(503).json({
        error: 'Service not ready',
        message: 'Kubernetes client not initialized. Wait for backend initialization.',
      });
    }

    const { name } = req.params;
    await gitRepoService.deleteGitRepo(name);
    res.json({ success: true, message: `GitRepo '${name}' deleted` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log('[GitRepos] Error deleting GitRepo:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * Get service debug logs
 *
 * GET /api/gitrepos/debug/logs
 */
gitReposRouter.get('/debug/logs', (_req, res) => {
  res.json({
    ready: gitRepoService.isReady(),
    logs: gitRepoService.getDebugLog(),
  });
});
