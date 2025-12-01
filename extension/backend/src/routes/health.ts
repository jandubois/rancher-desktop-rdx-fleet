import { Router } from 'express';
import os from 'os';

export const healthRouter = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: string;
  containerId: string;
  checks: {
    name: string;
    status: 'pass' | 'fail';
    message?: string;
  }[];
}

const startTime = Date.now();

healthRouter.get('/', (req, res) => {
  const health: HealthStatus = {
    status: 'healthy',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    containerId: os.hostname(),
    checks: [
      {
        name: 'server',
        status: 'pass',
      },
    ],
  };

  res.json(health);
});

// Liveness probe - simple check that server is running
healthRouter.get('/live', (req, res) => {
  res.status(200).json({ status: 'live' });
});

// Readiness probe - check that server is ready to accept requests
healthRouter.get('/ready', (req, res) => {
  // For now, always ready. Later we can add checks for:
  // - Kubernetes connectivity
  // - Docker socket availability
  res.status(200).json({ status: 'ready' });
});
