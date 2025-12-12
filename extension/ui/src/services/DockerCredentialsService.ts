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
import { backendService } from './BackendService';

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

/** Debug logging helper */
async function debugLog(message: string, data?: unknown): Promise<void> {
  try {
    await backendService.debugLog('DockerCredentials', message, data);
  } catch {
    // Ignore logging errors
  }
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
  await debugLog('Reading Docker config from ~/.docker/config.json');

  try {
    // Read ~/.docker/config.json via host CLI
    // Use shell to expand ~ to the user's home directory
    const result = await ddClient.extension.host?.cli.exec('sh', [
      '-c',
      'cat ~/.docker/config.json',
    ]);

    await debugLog('Docker config read result', {
      hasStdout: !!result?.stdout,
      stdoutLength: result?.stdout?.length,
      stderr: result?.stderr,
    });

    if (result?.stdout) {
      const config = JSON.parse(result.stdout) as DockerConfig;
      await debugLog('Docker config parsed', {
        hasAuths: !!config.auths,
        authKeys: config.auths ? Object.keys(config.auths) : [],
        credsStore: config.credsStore,
        credHelpers: config.credHelpers ? Object.keys(config.credHelpers) : [],
      });
      return config;
    }
  } catch (error) {
    await debugLog('Failed to read Docker config', {
      error: error instanceof Error ? error.message : String(error),
    });
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

  await debugLog('Invoking credential helper', { helper, helperName, registry });

  try {
    // The credential helper protocol: send registry URL on stdin, get JSON on stdout
    // Use shell to pipe the registry to the helper
    // Add ~/.rd/bin to PATH since credential helpers may be installed there
    const cmd = `export PATH="$HOME/.rd/bin:$PATH" && echo "${registry}" | ${helperName} get`;
    await debugLog('Executing command', { cmd });

    const result = await ddClient.extension.host?.cli.exec('sh', ['-c', cmd]);

    await debugLog('Credential helper result', {
      hasStdout: !!result?.stdout,
      stdoutLength: result?.stdout?.length,
      stderr: result?.stderr,
    });

    if (result?.stdout) {
      const creds = JSON.parse(result.stdout) as CredentialHelperResult;
      await debugLog('Credential helper returned credentials', {
        hasUsername: !!creds.Username,
        hasSecret: !!creds.Secret,
        serverURL: creds.ServerURL,
      });
      if (creds.Username && creds.Secret) {
        return creds;
      }
    }
  } catch (error) {
    await debugLog('Credential helper failed', {
      helper,
      registry,
      error: error instanceof Error ? error.message : String(error),
    });
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

  await debugLog('Getting credentials for image', { imageName, registryHost, registryUrl });

  // Read Docker config
  const config = await readDockerConfig();
  if (!config) {
    await debugLog('No Docker config found');
    return undefined;
  }

  // First, check for registry-specific credential helper
  if (config.credHelpers) {
    await debugLog('Checking credHelpers for registry', {
      registryHost,
      registryUrl,
      availableHelpers: Object.keys(config.credHelpers),
    });

    const helper =
      config.credHelpers[registryHost] ||
      config.credHelpers[registryUrl] ||
      config.credHelpers[registryUrl.replace(/^https?:\/\//, '')];

    if (helper) {
      await debugLog('Found registry-specific credential helper', { helper });
      const creds = await invokeCredentialHelper(helper, registryUrl);
      if (creds) {
        await debugLog('Got credentials from registry-specific helper', { username: creds.Username });
        return {
          username: creds.Username,
          password: creds.Secret,
        };
      }
    } else {
      await debugLog('No registry-specific credential helper found');
    }
  }

  // Second, check for default credential store
  if (config.credsStore) {
    await debugLog('Using default credential store', { credsStore: config.credsStore });
    const creds = await invokeCredentialHelper(config.credsStore, registryUrl);
    if (creds) {
      await debugLog('Got credentials from default store', { username: creds.Username });
      return {
        username: creds.Username,
        password: creds.Secret,
      };
    }
    await debugLog('No credentials in default store');
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

    await debugLog('Checking direct auths', { keysToTry, availableAuths: Object.keys(config.auths) });

    for (const key of keysToTry) {
      const authEntry = config.auths[key];
      if (authEntry?.auth) {
        // auth is base64 encoded "username:password"
        try {
          const decoded = atob(authEntry.auth);
          const colonIndex = decoded.indexOf(':');
          if (colonIndex > 0) {
            const username = decoded.substring(0, colonIndex);
            await debugLog('Found direct auth credentials', { key, username });
            return {
              username,
              password: decoded.substring(colonIndex + 1),
            };
          }
        } catch {
          await debugLog('Invalid base64 in auth entry', { key });
        }
      }
    }
  }

  await debugLog('No credentials found for registry');
  return undefined;
}
