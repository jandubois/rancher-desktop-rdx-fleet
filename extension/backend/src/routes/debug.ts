import { Router } from 'express';

export const debugRouter = Router();

/**
 * POST /api/debug/log
 * Logs debug information from the UI to the backend console.
 * This allows debugging UI issues via `docker logs`.
 */
debugRouter.post('/log', (req, res) => {
  const { source, message, data } = req.body;
  const timestamp = new Date().toISOString();

  console.log(`[DEBUG ${timestamp}] [${source || 'UI'}] ${message || 'No message'}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }

  res.json({ status: 'logged' });
});
