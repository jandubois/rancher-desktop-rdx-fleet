import express from 'express';
import fs from 'fs';
import os from 'os';
import { healthRouter } from './routes/health';
import { identityRouter } from './routes/identity';
import { initRouter } from './routes/init';
import { fleetRouter } from './routes/fleet';
import { fleetService } from './services/fleet';

const app = express();
const SOCKET_PATH = process.env.SOCKET_PATH || '/run/guest-services/fleet-gitops.sock';

// Middleware
app.use(express.json());

// CORS for frontend access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/health', healthRouter);
app.use('/identity', identityRouter);
app.use('/api/init', initRouter);
app.use('/api/fleet', fleetRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'fleet-gitops-backend',
    version: '1.0.0',
    containerId: os.hostname(),
  });
});

// Ensure socket directory exists and remove stale socket
const socketDir = SOCKET_PATH.substring(0, SOCKET_PATH.lastIndexOf('/'));
if (!fs.existsSync(socketDir)) {
  fs.mkdirSync(socketDir, { recursive: true });
}
if (fs.existsSync(SOCKET_PATH)) {
  fs.unlinkSync(SOCKET_PATH);
}

// Start server on Unix socket
app.listen(SOCKET_PATH, () => {
  // Make socket accessible
  fs.chmodSync(SOCKET_PATH, 0o666);
  console.log(`Fleet GitOps backend listening on socket ${SOCKET_PATH}`);
  console.log(`Container ID: ${os.hostname()}`);
  console.log(`Extension name: ${process.env.EXTENSION_NAME || 'fleet-gitops'}`);

  // Auto-install Fleet on startup with retry logic
  const startAutoInstall = async () => {
    const maxRetries = 30; // Try for up to ~5 minutes
    const baseDelay = 5000; // Start with 5 seconds
    const maxDelay = 30000; // Max 30 seconds between retries

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`Fleet auto-install attempt ${attempt}/${maxRetries}...`);
      try {
        await fleetService.ensureFleetInstalled();
        const state = fleetService.getState();

        if (state.status === 'running') {
          console.log(`Fleet auto-install complete. Status: ${state.status}`);
          return; // Success!
        }

        if (state.status === 'error' && state.error?.includes('not accessible')) {
          // Cluster not ready yet, will retry
          console.log('Cluster not accessible yet, will retry...');
        } else if (state.status === 'error') {
          console.log(`Fleet auto-install error: ${state.error}`);
          // For other errors, still retry but log it
        }
      } catch (error) {
        console.error('Fleet auto-install exception:', error);
      }

      // Calculate delay with exponential backoff (capped at maxDelay)
      const delay = Math.min(baseDelay * Math.pow(1.5, attempt - 1), maxDelay);
      console.log(`Waiting ${Math.round(delay / 1000)}s before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    console.log('Fleet auto-install: max retries exceeded, giving up');
  };

  // Start auto-install after a brief initial delay
  setTimeout(startAutoInstall, 2000);
});
