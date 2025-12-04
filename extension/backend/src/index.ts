import express from 'express';
import fs from 'fs';
import os from 'os';
import { healthRouter } from './routes/health';
import { identityRouter } from './routes/identity';
import { initRouter } from './routes/init';
import { fleetRouter } from './routes/fleet';
import { debugRouter } from './routes/debug';
import { fleetService } from './services/fleet';

const app = express();
// k3s kubeconfig mounted from VM (container runs as root to read it)
const K3S_KUBECONFIG_PATH = '/etc/rancher/k3s/k3s.yaml';

/**
 * Read and patch the k3s kubeconfig for use inside the container.
 * - Replace 127.0.0.1 with host.docker.internal (container can't use localhost)
 * - Add insecure-skip-tls-verify (host.docker.internal not in cert SANs)
 */
function loadAndPatchKubeconfig(): string | null {
  try {
    if (!fs.existsSync(K3S_KUBECONFIG_PATH)) {
      console.log(`Kubeconfig not found at ${K3S_KUBECONFIG_PATH}`);
      return null;
    }

    let kubeconfig = fs.readFileSync(K3S_KUBECONFIG_PATH, 'utf-8');

    // Patch localhost/127.0.0.1 to host.docker.internal
    const originalConfig = kubeconfig;
    kubeconfig = kubeconfig
      .replace(/server:\s*https?:\/\/127\.0\.0\.1:/g, 'server: https://host.docker.internal:')
      .replace(/server:\s*https?:\/\/localhost:/g, 'server: https://host.docker.internal:');

    if (kubeconfig !== originalConfig) {
      console.log('Patched kubeconfig: replaced localhost/127.0.0.1 with host.docker.internal');
      // Add insecure-skip-tls-verify for host.docker.internal
      kubeconfig = kubeconfig.replace(
        /(server: https:\/\/host\.docker\.internal:[0-9]+)/g,
        '$1\n    insecure-skip-tls-verify: true'
      );
      console.log('Added insecure-skip-tls-verify for host.docker.internal');
    }

    return kubeconfig;
  } catch (error) {
    console.error('Failed to load kubeconfig:', error);
    return null;
  }
}
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
app.use('/api/debug', debugRouter);

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

      // Try to load kubeconfig (may not be available immediately on startup)
      const kubeconfig = loadAndPatchKubeconfig();
      if (!kubeconfig) {
        console.log('Kubeconfig not available yet, will retry...');
        const delay = Math.min(baseDelay * Math.pow(1.5, attempt - 1), maxDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Initialize fleet service if not already initialized
      if (!fleetService.isReady()) {
        try {
          fleetService.initialize(kubeconfig);
        } catch (error) {
          console.error('Failed to initialize fleet service:', error);
          const delay = Math.min(baseDelay * Math.pow(1.5, attempt - 1), maxDelay);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      try {
        await fleetService.ensureFleetInstalled();
        const state = fleetService.getState();

        if (state.status === 'running') {
          console.log(`Fleet auto-install complete. Status: ${state.status}`);
          return; // Success!
        }

        if (state.status === 'error' && state.error?.includes('not accessible')) {
          console.log('Cluster not accessible yet, will retry...');
        } else if (state.status === 'error') {
          console.log(`Fleet auto-install error: ${state.error}`);
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
