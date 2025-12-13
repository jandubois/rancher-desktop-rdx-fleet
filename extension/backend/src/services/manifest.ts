/**
 * Manifest Service
 *
 * Reads and parses the manifest.yaml file from the extension's UI directory.
 * Extracts GitRepo defaults for automatic deployment when the extension claims ownership.
 */

import * as fs from 'fs';
import * as yaml from 'js-yaml';

// Path to the manifest file inside the extension container
const MANIFEST_PATH = '/ui/manifest.yaml';

/** GitRepo default configuration extracted from manifest */
export interface GitRepoDefault {
  name: string;
  repo: string;
  branch?: string;
  paths: string[];
}

/** Manifest card definition (simplified for our needs) */
interface ManifestCard {
  id?: string;
  type: string;
  settings?: {
    repo_url?: {
      default?: string;
    };
    branch?: {
      default?: string;
    };
    paths?: {
      default?: string[];
    };
  };
}

/** Manifest structure (simplified for our needs) */
interface Manifest {
  cards?: ManifestCard[];
}

class ManifestService {
  private debugLog: string[] = [];

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}`;
    console.log(`[Manifest] ${message}`);
    this.debugLog.push(entry);
    if (this.debugLog.length > 100) {
      this.debugLog = this.debugLog.slice(-100);
    }
  }

  getDebugLog(): string[] {
    return [...this.debugLog];
  }

  /**
   * Check if the manifest file exists.
   */
  manifestExists(): boolean {
    return fs.existsSync(MANIFEST_PATH);
  }

  /**
   * Read and parse the manifest file.
   * Returns null if the file doesn't exist or can't be parsed.
   */
  readManifest(): Manifest | null {
    if (!this.manifestExists()) {
      this.log(`Manifest file not found at ${MANIFEST_PATH}`);
      return null;
    }

    try {
      const content = fs.readFileSync(MANIFEST_PATH, 'utf-8');
      const manifest = yaml.load(content) as Manifest;
      this.log(`Successfully loaded manifest from ${MANIFEST_PATH}`);
      return manifest;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.log(`Failed to parse manifest: ${msg}`);
      return null;
    }
  }

  /**
   * Extract GitRepo defaults from the manifest.
   * Returns an array of GitRepo configurations with pre-selected paths.
   */
  extractGitRepoDefaults(): GitRepoDefault[] {
    const manifest = this.readManifest();
    if (!manifest?.cards) {
      this.log('No cards found in manifest');
      return [];
    }

    const defaults: GitRepoDefault[] = [];
    let configIndex = 0;

    for (const card of manifest.cards) {
      if (card.type === 'gitrepo' && card.settings) {
        const repoUrl = card.settings.repo_url?.default;
        const branch = card.settings.branch?.default;
        const paths = card.settings.paths?.default;

        // Only include repos that have both a URL and pre-selected paths
        if (typeof repoUrl === 'string' && repoUrl && Array.isArray(paths) && paths.length > 0) {
          const config: GitRepoDefault = {
            name: card.id || `gitrepo-${configIndex++}`,
            repo: repoUrl,
            branch: typeof branch === 'string' ? branch : undefined,
            paths,
          };
          defaults.push(config);
          this.log(`Found GitRepo default: ${config.name} -> ${config.repo} (${config.paths.length} paths)`);
        }
      }
    }

    this.log(`Extracted ${defaults.length} GitRepo defaults from manifest`);
    return defaults;
  }
}

export const manifestService = new ManifestService();
