/**
 * Docker Credentials Service - Get registry credentials via Docker credential helpers.
 *
 * This service runs on the frontend and uses the Docker Desktop Extension SDK
 * to invoke host CLI commands (like credential helpers) that have access to
 * the host's credential stores (macOS Keychain, Windows Credential Manager, etc.).
 *
 * The backend cannot access credential helpers because it runs in a container.
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
 * Read Docker config from the host machine.
 * Uses shell expansion to resolve ~ to the user's home directory.
 */
async function readDockerConfig(): Promise<DockerConfig | null> {
  try {
    // Read ~/.docker/config.json via host CLI
    // Use shell to expand ~ to the user's home directory
    const result = await ddClient.extension.host?.cli.exec('sh', [
      '-c',
      'cat ~/.docker/config.json',
    ]);

    if (result?.stdout) {
      return JSON.parse(result.stdout) as DockerConfig;
    }
  } catch {
    // Config file doesn't exist or can't be read
  }

  return null;
}

/**
 * Invoke a Docker credential helper on the host.
 *
 * Credential helpers are executables named docker-credential-<helper>.
 * Protocol: write registry URL to stdin, read JSON from stdout.
 *
 * Searches for the helper in:
 * - Standard PATH locations
 * - ~/.rd/bin (where Rancher Desktop installs tools)
 */
async function invokeCredentialHelper(
  helper: string,
  registry: string
): Promise<CredentialHelperResult | null> {
  const helperName = `docker-credential-${helper}`;

  try {
    // The credential helper protocol: send registry URL on stdin, get JSON on stdout
    // Use shell to pipe the registry to the helper
    // Add ~/.rd/bin to PATH since credential helpers may be installed there
    const result = await ddClient.extension.host?.cli.exec('sh', [
      '-c',
      `export PATH="$HOME/.rd/bin:$PATH" && echo "${registry}" | ${helperName} get`,
    ]);

    if (result?.stdout) {
      const creds = JSON.parse(result.stdout) as CredentialHelperResult;
      if (creds.Username && creds.Secret) {
        return creds;
      }
    }
  } catch {
    // Helper not found or failed - this is normal if not logged in
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
