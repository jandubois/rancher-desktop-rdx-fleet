/**
 * Secrets Routes
 *
 * Handles:
 * - GET /api/secrets/registry/:name - Check if registry secret exists
 * - POST /api/secrets/registry - Create or update registry secret
 * - DELETE /api/secrets/registry/:name - Delete registry secret
 * - POST /api/secrets/appco - Create AppCo registry secret (convenience)
 * - DELETE /api/secrets/appco - Delete AppCo registry secret (convenience)
 * - GET /api/secrets/appco - Check AppCo registry secret exists
 */

import { Router } from 'express';
import { secretsService, APPCO_SECRET_NAME } from '../services/secrets';

export const secretsRouter = Router();

/**
 * Check if a registry secret exists
 *
 * GET /api/secrets/registry/:name
 */
secretsRouter.get('/registry/:name', async (req, res) => {
  try {
    if (!secretsService.isReady()) {
      return res.status(503).json({
        error: 'Service not ready',
        message: 'Kubernetes client not initialized. Wait for backend initialization.',
      });
    }

    const { name } = req.params;
    const info = await secretsService.getSecretInfo(name);

    if (!info) {
      return res.status(404).json({ exists: false, error: `Secret '${name}' not found` });
    }

    res.json({ exists: true, ...info });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Secrets] Error checking secret:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * Create or update a registry secret
 *
 * POST /api/secrets/registry
 * Body: { name: string, registry: string, username: string, password: string }
 */
secretsRouter.post('/registry', async (req, res) => {
  try {
    if (!secretsService.isReady()) {
      return res.status(503).json({
        error: 'Service not ready',
        message: 'Kubernetes client not initialized. Wait for backend initialization.',
      });
    }

    const { name, registry, username, password } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required and must be a string' });
    }

    if (!registry || typeof registry !== 'string') {
      return res.status(400).json({ error: 'registry is required and must be a string' });
    }

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'username is required and must be a string' });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'password is required and must be a string' });
    }

    const info = await secretsService.createRegistrySecret({
      name,
      registry,
      username,
      password,
    });

    res.json({ success: true, ...info });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Secrets] Error creating registry secret:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * Delete a registry secret
 *
 * DELETE /api/secrets/registry/:name
 */
secretsRouter.delete('/registry/:name', async (req, res) => {
  try {
    if (!secretsService.isReady()) {
      return res.status(503).json({
        error: 'Service not ready',
        message: 'Kubernetes client not initialized. Wait for backend initialization.',
      });
    }

    const { name } = req.params;
    await secretsService.deleteSecret(name);
    res.json({ success: true, message: `Secret '${name}' deleted` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Secrets] Error deleting secret:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * Delete a registry secret (POST alternative for clients that don't support DELETE)
 *
 * POST /api/secrets/registry/:name/delete
 */
secretsRouter.post('/registry/:name/delete', async (req, res) => {
  try {
    if (!secretsService.isReady()) {
      return res.status(503).json({
        error: 'Service not ready',
        message: 'Kubernetes client not initialized. Wait for backend initialization.',
      });
    }

    const { name } = req.params;
    await secretsService.deleteSecret(name);
    res.json({ success: true, message: `Secret '${name}' deleted` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Secrets] Error deleting secret:', message);
    res.status(500).json({ error: message });
  }
});

// ============================================
// AppCo Convenience Routes
// ============================================

/**
 * Check if AppCo registry secret exists
 *
 * GET /api/secrets/appco
 */
secretsRouter.get('/appco', async (_req, res) => {
  try {
    if (!secretsService.isReady()) {
      return res.status(503).json({
        error: 'Service not ready',
        message: 'Kubernetes client not initialized. Wait for backend initialization.',
      });
    }

    const exists = await secretsService.appCoSecretExists();

    if (!exists) {
      return res.json({ exists: false });
    }

    const info = await secretsService.getSecretInfo(APPCO_SECRET_NAME);
    res.json({ exists: true, ...info });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Secrets] Error checking AppCo secret:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * Create or update AppCo registry secret
 *
 * POST /api/secrets/appco
 * Body: { username: string, password: string }
 */
secretsRouter.post('/appco', async (req, res) => {
  try {
    if (!secretsService.isReady()) {
      return res.status(503).json({
        error: 'Service not ready',
        message: 'Kubernetes client not initialized. Wait for backend initialization.',
      });
    }

    const { username, password } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'username is required and must be a string' });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'password is required and must be a string' });
    }

    const info = await secretsService.createAppCoRegistrySecret(username, password);
    res.json({ success: true, ...info });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Secrets] Error creating AppCo secret:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * Delete AppCo registry secret
 *
 * DELETE /api/secrets/appco
 */
secretsRouter.delete('/appco', async (_req, res) => {
  try {
    if (!secretsService.isReady()) {
      return res.status(503).json({
        error: 'Service not ready',
        message: 'Kubernetes client not initialized. Wait for backend initialization.',
      });
    }

    await secretsService.deleteAppCoRegistrySecret();
    res.json({ success: true, message: 'AppCo registry secret deleted' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Secrets] Error deleting AppCo secret:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * Delete AppCo registry secret (POST alternative for clients that don't support DELETE)
 *
 * POST /api/secrets/appco/delete
 */
secretsRouter.post('/appco/delete', async (_req, res) => {
  try {
    if (!secretsService.isReady()) {
      return res.status(503).json({
        error: 'Service not ready',
        message: 'Kubernetes client not initialized. Wait for backend initialization.',
      });
    }

    await secretsService.deleteAppCoRegistrySecret();
    res.json({ success: true, message: 'AppCo registry secret deleted' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Secrets] Error deleting AppCo secret:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * Get service debug logs
 *
 * GET /api/secrets/debug/logs
 */
secretsRouter.get('/debug/logs', (_req, res) => {
  res.json({
    ready: secretsService.isReady(),
    logs: secretsService.getDebugLog(),
  });
});
