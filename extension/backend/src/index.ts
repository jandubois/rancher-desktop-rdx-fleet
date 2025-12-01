import express from 'express';
import os from 'os';
import { healthRouter } from './routes/health';
import { identityRouter } from './routes/identity';

const app = express();
const PORT = process.env.PORT || 8080;

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

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'fleet-gitops-backend',
    version: '1.0.0',
    containerId: os.hostname(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Fleet GitOps backend listening on port ${PORT}`);
  console.log(`Container ID: ${os.hostname()}`);
  console.log(`Extension name: ${process.env.EXTENSION_NAME || 'fleet-gitops'}`);
});
