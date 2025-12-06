/**
 * GitRepo Routes
 *
 * Handles:
 * - GET /api/gitrepos - List all GitRepos
 * - GET /api/gitrepos/:name - Get a specific GitRepo
 * - POST /api/gitrepos - Create or update a GitRepo
 * - DELETE /api/gitrepos/:name - Delete a GitRepo
 */

import { Router } from 'express';
import { gitRepoService } from '../services/gitrepos.js';

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
    console.error('[GitRepos] Error listing GitRepos:', message);
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
    console.error('[GitRepos] Error getting GitRepo:', message);
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
    console.error('[GitRepos] Error applying GitRepo:', message);
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
    console.error('[GitRepos] Error deleting GitRepo:', message);
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
    console.error('[GitRepos] Error deleting GitRepo:', message);
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
