/**
 * Git Service
 *
 * Provides path discovery for Fleet bundles using shallow git clones.
 * This approach is provider-agnostic (works with GitHub, GitLab, Bitbucket, etc.)
 * and doesn't suffer from API rate limits.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { secretsService } from './secrets.js';

// Types

/** Path info with dependency data */
export interface PathInfo {
  path: string;
  dependsOn?: string[];
}

/** Git credentials for authenticated clones */
export interface GitCredentials {
  username: string;
  password: string;
}

/** Discovery request */
export interface DiscoverRequest {
  repo: string;
  branch?: string;
  credentials?: GitCredentials;
  secretName?: string; // Use credentials from this K8s secret
}

/** Discovery result */
export interface DiscoverResult {
  paths: PathInfo[];
  branch: string;
  cloneTimeMs: number;
  scanTimeMs: number;
}

/** Internal clone result */
interface CloneResult {
  cloneDir: string;
  branch: string;
  timeMs: number;
}

// ============================================================
// Exported utility functions for testing
// ============================================================

/**
 * Extract dependsOn values from fleet.yaml content.
 * Handles both simple string array and object array formats:
 * - dependsOn: ["bundle1", "bundle2"]
 * - dependsOn:
 *   - name: bundle1
 *   - name: bundle2
 */
export function extractDependsOn(content: string): string[] {
  const deps: string[] = [];

  // Find dependsOn section
  const dependsOnMatch = content.match(/^dependsOn:\s*$/m);
  if (!dependsOnMatch) {
    // Try inline array format: dependsOn: ["a", "b"]
    const inlineMatch = content.match(/^dependsOn:\s*\[([^\]]*)\]/m);
    if (inlineMatch) {
      const items = inlineMatch[1].split(',');
      for (const item of items) {
        const trimmed = item.trim().replace(/^["']|["']$/g, '');
        if (trimmed) {
          deps.push(trimmed);
        }
      }
    }
    return deps;
  }

  // Find the position of dependsOn:
  const startIndex = dependsOnMatch.index! + dependsOnMatch[0].length;
  const restContent = content.slice(startIndex);

  // Parse YAML list items under dependsOn
  const lines = restContent.split('\n');
  for (const line of lines) {
    // Stop if we hit a new top-level key
    if (/^[a-zA-Z]/.test(line)) {
      break;
    }

    // Match list item: "  - name: bundleName" or "  - bundleName"
    const nameMatch = line.match(/^\s+-\s+name:\s*["']?([^"'\s]+)["']?\s*$/);
    if (nameMatch) {
      deps.push(nameMatch[1]);
      continue;
    }

    const simpleMatch = line.match(/^\s+-\s+["']?([^"'\s:]+)["']?\s*$/);
    if (simpleMatch) {
      deps.push(simpleMatch[1]);
    }
  }

  return deps;
}

/**
 * Build a URL with embedded credentials for authenticated clones.
 * Converts https://github.com/user/repo to https://username:password@github.com/user/repo
 */
export function buildAuthenticatedUrl(repoUrl: string, credentials?: GitCredentials): string {
  if (!credentials) {
    return repoUrl;
  }

  try {
    const url = new URL(repoUrl);
    url.username = encodeURIComponent(credentials.username);
    url.password = encodeURIComponent(credentials.password);
    return url.toString();
  } catch {
    // If URL parsing fails, return original
    return repoUrl;
  }
}

/**
 * Check if a filename is a Fleet bundle definition file.
 */
export function isFleetFile(filename: string): boolean {
  return filename === 'fleet.yaml' || filename === 'fleet.yml';
}

/**
 * Check if a directory should be skipped during scanning.
 */
export function shouldSkipDirectory(dirname: string): boolean {
  return dirname === '.git';
}

/**
 * Sanitize a URL by removing credentials for safe logging.
 */
export function sanitizeUrl(url: string): string {
  return url.replace(/\/\/[^@]+@/, '//***@');
}

/**
 * Recursively find Fleet bundle files (fleet.yaml/fleet.yml) in a directory.
 * Skips .git directories and returns paths relative to baseDir.
 */
export function findFleetFiles(baseDir: string, relativePath: string = ''): string[] {
  const results: string[] = [];
  const currentDir = path.join(baseDir, relativePath);

  try {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        if (shouldSkipDirectory(entry.name)) {
          continue;
        }
        // Recurse into subdirectory
        results.push(...findFleetFiles(baseDir, entryRelativePath));
      } else if (entry.isFile() && isFleetFile(entry.name)) {
        results.push(entryRelativePath);
      }
    }
  } catch {
    // Silently ignore errors (e.g., permission denied)
  }

  return results;
}

class GitService {
  private debugLog: string[] = [];
  private tempDirs: Set<string> = new Set();

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}`;
    console.log(`[Git] ${message}`);
    this.debugLog.push(entry);
    if (this.debugLog.length > 100) {
      this.debugLog = this.debugLog.slice(-100);
    }
  }

  getDebugLog(): string[] {
    return [...this.debugLog];
  }

  /**
   * Service is always ready (no Kubernetes dependency)
   */
  isReady(): boolean {
    return true;
  }

  /**
   * Discover Fleet bundle paths in a Git repository.
   * Uses shallow clone to minimize data transfer.
   */
  async discoverPaths(request: DiscoverRequest): Promise<DiscoverResult> {
    const { repo, branch, credentials, secretName } = request;
    this.log(`Discovering paths in ${repo}${branch ? ` (branch: ${branch})` : ''}`);

    // Resolve credentials
    let resolvedCredentials = credentials;
    if (secretName && !resolvedCredentials) {
      resolvedCredentials = await this.getCredentialsFromSecret(secretName);
    }

    let cloneResult: CloneResult | null = null;
    try {
      // Clone the repository
      cloneResult = await this.shallowClone(repo, branch, resolvedCredentials);

      // Discover paths
      const scanStart = Date.now();
      const paths = await this.scanForFleetPaths(cloneResult.cloneDir);
      const scanTimeMs = Date.now() - scanStart;

      this.log(`Found ${paths.length} Fleet bundle paths in ${cloneResult.cloneDir}`);

      return {
        paths,
        branch: cloneResult.branch,
        cloneTimeMs: cloneResult.timeMs,
        scanTimeMs,
      };
    } finally {
      // Always cleanup
      if (cloneResult) {
        await this.cleanup(cloneResult.cloneDir);
      }
    }
  }

  /**
   * Perform a shallow git clone to a temporary directory.
   */
  async shallowClone(
    repoUrl: string,
    branch?: string,
    credentials?: GitCredentials
  ): Promise<CloneResult> {
    const startTime = Date.now();

    // Create temp directory
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-git-'));
    this.tempDirs.add(tempDir);
    this.log(`Created temp directory: ${tempDir}`);

    // Build clone URL with credentials if provided
    const cloneUrl = buildAuthenticatedUrl(repoUrl, credentials);

    // Try specified branch first, then fallback to common defaults
    const branchesToTry = branch ? [branch] : ['main', 'master'];
    let lastError: Error | null = null;
    let usedBranch = '';

    for (const b of branchesToTry) {
      try {
        await this.executeGitClone(cloneUrl, tempDir, b);
        usedBranch = b;
        this.log(`Successfully cloned ${repoUrl} (branch: ${b})`);
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.log(`Failed to clone branch ${b}: ${lastError.message}`);
        // Only continue trying if it's a branch not found error
        if (!lastError.message.includes('Remote branch') &&
            !lastError.message.includes('not found') &&
            !lastError.message.includes('could not find remote branch')) {
          // Non-branch error, don't try other branches
          await this.cleanup(tempDir);
          throw lastError;
        }
      }
    }

    if (!usedBranch) {
      await this.cleanup(tempDir);
      const triedBranches = branchesToTry.join(', ');
      throw new Error(
        `Could not clone repository. Tried branches: ${triedBranches}. ` +
        `Last error: ${lastError?.message || 'Unknown error'}`
      );
    }

    const timeMs = Date.now() - startTime;
    return { cloneDir: tempDir, branch: usedBranch, timeMs };
  }

  /**
   * Scan a cloned repository for fleet.yaml files and extract path info.
   */
  async scanForFleetPaths(cloneDir: string): Promise<PathInfo[]> {
    // Recursively find all fleet.yaml and fleet.yml files
    const fleetFiles = findFleetFiles(cloneDir);

    // For each fleet.yaml, extract the path and dependencies
    const pathInfos: PathInfo[] = [];
    for (const relativePath of fleetFiles) {
      const dirPath = path.dirname(relativePath);
      // Skip root-level fleet.yaml (path would be ".")
      if (dirPath === '.') {
        continue;
      }

      const fleetFilePath = path.join(cloneDir, relativePath);
      const deps = await this.parseFleetYamlDeps(fleetFilePath);

      pathInfos.push({
        path: dirPath,
        dependsOn: deps,
      });
    }

    // Sort by path for consistent ordering
    pathInfos.sort((a, b) => a.path.localeCompare(b.path));

    return pathInfos;
  }

  /**
   * Parse fleet.yaml to extract dependsOn values.
   */
  async parseFleetYamlDeps(filePath: string): Promise<string[] | undefined> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Simple YAML parsing for dependsOn field
      // We avoid adding js-yaml dependency by using regex parsing
      const deps = extractDependsOn(content);
      return deps.length > 0 ? deps : undefined;
    } catch (error) {
      this.log(`Error parsing ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }

  /**
   * Clean up a temporary clone directory.
   */
  async cleanup(cloneDir: string): Promise<void> {
    if (!cloneDir || !this.tempDirs.has(cloneDir)) {
      return;
    }

    try {
      this.log(`Cleaning up: ${cloneDir}`);
      fs.rmSync(cloneDir, { recursive: true, force: true });
      this.tempDirs.delete(cloneDir);
    } catch (error) {
      this.log(`Failed to cleanup ${cloneDir}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clean up all temporary directories (called on shutdown).
   */
  async cleanupAll(): Promise<void> {
    for (const dir of this.tempDirs) {
      await this.cleanup(dir);
    }
  }

  // Private helper methods

  /**
   * Execute git clone with depth=1 (shallow clone).
   */
  private executeGitClone(url: string, targetDir: string, branch: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Clone into the target directory directly
      const args = [
        'clone',
        '--depth', '1',
        '--branch', branch,
        '--single-branch',
        url,
        targetDir,
      ];

      // Log command without credentials
      const safeUrl = sanitizeUrl(url);
      this.log(`Executing: git clone --depth 1 --branch ${branch} --single-branch ${safeUrl} ${targetDir}`);

      const proc = spawn('git', args, {
        env: {
          ...process.env,
          // Disable interactive prompts
          GIT_TERMINAL_PROMPT: '0',
          // Disable credential helpers that might prompt
          GIT_ASKPASS: '',
          SSH_ASKPASS: '',
        },
        // Set timeout for the operation
        timeout: 60000, // 60 seconds
      });

      let stderr = '';

      // Consume stdout to prevent buffer overflow (data not needed)
      proc.stdout?.resume();

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          // Clean error message, removing credentials
          const cleanStderr = stderr.replace(/\/\/[^@]+@/g, '//***@');
          reject(new Error(`git clone failed (exit code ${code}): ${cleanStderr.trim()}`));
        }
      });

      proc.on('error', (error) => {
        reject(new Error(`Failed to execute git: ${error.message}`));
      });
    });
  }

  // findFleetFiles is now an exported function at module level

  /**
   * Get Git credentials from a Kubernetes Secret.
   * The secret should have 'username' and 'password' data keys.
   */
  private async getCredentialsFromSecret(secretName: string): Promise<GitCredentials | undefined> {
    if (!secretsService.isReady()) {
      this.log(`Secrets service not ready, cannot get credentials from ${secretName}`);
      return undefined;
    }

    try {
      // Note: This would require extending secretsService to read secret data
      // For now, we log that this feature needs implementation
      this.log(`Getting credentials from secret ${secretName} (not yet implemented)`);
      return undefined;
    } catch (error) {
      this.log(`Error getting credentials from secret: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }
}

export const gitService = new GitService();
