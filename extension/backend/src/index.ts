import express from 'express';
import fs from 'fs';
import os from 'os';
import { healthRouter } from './routes/health';
import { identityRouter } from './routes/identity';
import { initRouter } from './routes/init';
import { fleetRouter } from './routes/fleet';

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
  console.log('Fleet auto-install will be triggered when frontend sends kubeconfig via /api/init');
});
