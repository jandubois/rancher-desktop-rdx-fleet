import { Router } from 'express';
import os from 'os';

export const identityRouter = Router();

interface ExtensionIdentity {
  containerId: string;
  extensionName: string;
  extensionType: string;
  version: string;
  startedAt: string;
}

const startedAt = new Date().toISOString();

identityRouter.get('/', (req, res) => {
  const identity: ExtensionIdentity = {
    // Container ID is the hostname inside a Docker container
    containerId: os.hostname(),

    // Extension name - can be overridden via environment variable
    // This should match the image name/label used to identify the extension
    extensionName: process.env.EXTENSION_NAME || 'fleet-gitops',

    // Extension type: 'base' or 'custom'
    extensionType: process.env.EXTENSION_TYPE || 'base',

    // Version from environment or default
    version: process.env.EXTENSION_VERSION || '1.0.0',

    // When this backend instance started
    startedAt,
  };

  res.json(identity);
});
