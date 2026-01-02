/**
 * Docker Credentials Service - Get registry credentials via Docker credential helpers.
 *
 * This service runs on the frontend and uses the Docker Desktop Extension SDK
 * to invoke host CLI commands (like credential helpers) that have access to
 * the host's credential stores (macOS Keychain, Windows Credential Manager, etc.).
 */

import { ddClient } from '../lib/ddClient';

/** Docker config.json structure */
interface DockerConfig {
  auths?: {
    [registry: string]: {
      auth?: string;
    };
  };
  credsStore?: string;
  credHelpers?: {
    [registry: string]: string;
  };
}

/** Credentials returned by credential helpers */
interface CredentialHelperResult {
  Username: string;
  Secret: string;
  ServerURL?: string;
}

/** Docker auth credentials for pushing */
export interface DockerAuth {
  username: string;
  password: string;
}

/**
 * Extract the registry hostname from an image name.
 * Returns 'docker.io' for Docker Hub images.
 */
export function getRegistryHost(imageName: string): string {
  const [nameWithoutTag] = imageName.split(':');
  const parts = nameWithoutTag.split('/');

  if (parts.length > 1) {
    const firstPart = parts[0];
    if (firstPart.includes('.') || firstPart.includes(':') || firstPart === 'localhost') {
      return firstPart;
    }
  }

  // Docker Hub
  return 'docker.io';
}

/**
 * Get the registry URL for credential helper lookup.
 * Returns the full URL format used by credential helpers.
 */
function getRegistryUrl(imageName: string): string {
  const host = getRegistryHost(imageName);

  // Docker Hub uses a special URL
  if (host === 'docker.io') {
    return 'https://index.docker.io/v1/';
  }

  return `https://${host}`;
}

/**
 * Run a command on the host using rd-exec.
 * rd-exec runs commands on the host with ~/.rd/bin in PATH.
 */
async function rdExec(command: string): Promise<{ stdout: string; stderr: string } | null> {
  try {
    // Use rd-exec to run commands on the host
    const result = await ddClient.extension.host?.cli.exec('rd-exec', ['/bin/sh', '-c', command]);
    return { stdout: result?.stdout || '', stderr: result?.stderr || '' };
  } catch {
    return null;
  }
}

/**
 * Read Docker config from the host machine.
 * Uses rd-exec to read ~/.docker/config.json
 */
async function readDockerConfig(): Promise<DockerConfig | null> {
  const result = await rdExec('cat ~/.docker/config.json');

  if (result?.stdout) {
    try {
      return JSON.parse(result.stdout) as DockerConfig;
    } catch {
      // Failed to parse
    }
  }

  return null;
}

/**
 * Invoke a Docker credential helper on the host.
 *
 * Credential helpers are executables named docker-credential-<helper>.
 * Protocol: write registry URL to stdin, read JSON from stdout.
 */
async function invokeCredentialHelper(
  helper: string,
  registry: string
): Promise<CredentialHelperResult | null> {
  const helperName = `docker-credential-${helper}`;

  // Use rdExec to run the credential helper with ~/.rd/bin in PATH
  const result = await rdExec(`echo "${registry}" | ${helperName} get 2>/dev/null || echo "{}"`);

  if (result?.stdout) {
    const trimmed = result.stdout.trim();
    if (trimmed && trimmed !== '{}') {
      try {
        const creds = JSON.parse(trimmed) as CredentialHelperResult;
        if (creds.Username && creds.Secret) {
          return creds;
        }
      } catch {
        // Failed to parse
      }
    }
  }

  return null;
}

/**
 * Get Docker credentials for pushing an image.
 *
 * This reads the Docker config from the host, determines which credential
 * helper to use, and invokes it to get the actual credentials.
 *
 * @param imageName - The image name to get credentials for
 * @returns Credentials if found, undefined otherwise
 */
export async function getDockerCredentials(imageName: string): Promise<DockerAuth | undefined> {
  const registryHost = getRegistryHost(imageName);
  const registryUrl = getRegistryUrl(imageName);

  // Read Docker config
  const config = await readDockerConfig();
  if (!config) {
    return undefined;
  }

  // First, check for registry-specific credential helper
  if (config.credHelpers) {
    const helper =
      config.credHelpers[registryHost] ||
      config.credHelpers[registryUrl] ||
      config.credHelpers[registryUrl.replace(/^https?:\/\//, '')];

    if (helper) {
      const creds = await invokeCredentialHelper(helper, registryUrl);
      if (creds) {
        return {
          username: creds.Username,
          password: creds.Secret,
        };
      }
    }
  }

  // Second, check for default credential store
  if (config.credsStore) {
    const creds = await invokeCredentialHelper(config.credsStore, registryUrl);
    if (creds) {
      return {
        username: creds.Username,
        password: creds.Secret,
      };
    }
  }

  // Finally, fall back to direct auth in config (legacy)
  if (config.auths) {
    // Try various registry formats
    const keysToTry = [
      registryUrl,
      registryUrl.replace(/^https?:\/\//, ''),
      registryHost,
    ];

    // For Docker Hub, also try these formats
    if (registryHost === 'docker.io') {
      keysToTry.push('docker.io', 'https://docker.io', 'index.docker.io/v1/');
    }

    for (const key of keysToTry) {
      const authEntry = config.auths[key];
      if (authEntry?.auth) {
        // auth is base64 encoded "username:password"
        try {
          const decoded = atob(authEntry.auth);
          const colonIndex = decoded.indexOf(':');
          if (colonIndex > 0) {
            return {
              username: decoded.substring(0, colonIndex),
              password: decoded.substring(colonIndex + 1),
            };
          }
        } catch {
          // Invalid base64
        }
      }
    }
  }

  return undefined;
}
