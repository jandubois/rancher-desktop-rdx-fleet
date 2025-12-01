/**
 * GitHub service for path discovery.
 *
 * Provides methods for interacting with the GitHub API to discover
 * Fleet bundle paths in repositories. Uses injectable HttpClient
 * for testability.
 */

import yaml from 'js-yaml';
import { HttpClient, FetchHttpClient } from './HttpClient';
import { BundleInfo } from '../types';

/** Path info with dependency data */
export interface PathInfo {
  path: string;
  dependsOn?: string[];
}

/** Parsed GitHub URL */
export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
}

/**
 * Compute Fleet bundle name from GitRepo name and path.
 * Fleet creates bundle names as: <GitRepo-name>-<path-with-slashes-replaced-by-hyphens>
 */
export function computeBundleName(gitRepoName: string, path: string): string {
  const normalizedPath = path
    .replace(/^\/+|\/+$/g, '')
    .replace(/\//g, '-');

  if (!normalizedPath || normalizedPath === '.') {
    return gitRepoName;
  }

  return `${gitRepoName}-${normalizedPath}`;
}

/**
 * Build BundleInfo from GitRepo name and PathInfo
 */
export function buildBundleInfo(gitRepoName: string, pathInfo: PathInfo): BundleInfo {
  return {
    bundleName: computeBundleName(gitRepoName, pathInfo.path),
    gitRepoName,
    path: pathInfo.path,
    dependsOn: pathInfo.dependsOn || [],
  };
}

/**
 * Parse GitHub URL to get owner/repo
 */
export function parseGitHubUrl(url: string): ParsedGitHubUrl | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

/**
 * Service for GitHub API operations.
 *
 * Uses injectable HttpClient for testability. All network operations
 * go through the httpClient, making it easy to mock for tests.
 */
export class GitHubService {
  private httpClient: HttpClient;

  constructor(httpClient?: HttpClient) {
    this.httpClient = httpClient ?? new FetchHttpClient();
  }

  /**
   * Fetch fleet.yaml dependencies for a specific path
   */
  async fetchFleetYamlDeps(
    owner: string,
    repo: string,
    branch: string,
    path: string
  ): Promise<string[] | undefined> {
    const filenames = ['fleet.yaml', 'fleet.yml'];

    for (const filename of filenames) {
      try {
        const fleetYamlPath = path ? `${path}/${filename}` : filename;
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${fleetYamlPath}`;
        const response = await this.httpClient.get(rawUrl);

        if (!response.ok) continue;

        const content = await response.text();
        const parsed = yaml.load(content) as Record<string, unknown> | null;

        if (!parsed || typeof parsed !== 'object') return undefined;

        const dependsOn = parsed.dependsOn;
        if (!Array.isArray(dependsOn)) return undefined;

        const deps: string[] = [];
        for (const item of dependsOn) {
          if (typeof item === 'string') {
            deps.push(item);
          } else if (typeof item === 'object' && item !== null && 'name' in item) {
            const name = (item as { name: unknown }).name;
            if (typeof name === 'string') {
              deps.push(name);
            }
          }
        }
        return deps.length > 0 ? deps : undefined;
      } catch {
        continue;
      }
    }
    return undefined;
  }

  /**
   * Fetch available paths from GitHub repo with dependency info
   */
  async fetchGitHubPaths(repoUrl: string, branch?: string): Promise<PathInfo[]> {
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      throw new Error(`Only GitHub repositories are supported for path discovery. URL: ${repoUrl}`);
    }

    const branches = branch ? [branch] : ['master', 'main'];
    let lastError = '';

    for (const b of branches) {
      const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${b}?recursive=1`;
      console.log(`[Path Discovery] Fetching: ${apiUrl}`);

      try {
        const response = await this.httpClient.get(apiUrl);
        console.log(`[Path Discovery] Response status: ${response.status}`);

        const remaining = response.headers.get('X-RateLimit-Remaining');
        const limit = response.headers.get('X-RateLimit-Limit');
        console.log(`[Path Discovery] Rate limit: ${remaining}/${limit}`);

        if (response.status === 403) {
          const resetHeader = response.headers.get('X-RateLimit-Reset');
          const resetTime = resetHeader
            ? new Date(parseInt(resetHeader) * 1000).toLocaleTimeString()
            : 'unknown';
          throw new Error(
            `GitHub API rate limit exceeded. Resets at ${resetTime}. Try again later or use a different network.`
          );
        }

        if (response.status === 404) {
          lastError = `Branch '${b}' not found in ${parsed.owner}/${parsed.repo}`;
          console.log(`[Path Discovery] ${lastError}`);
          continue;
        }

        if (!response.ok) {
          const text = await response.text();
          lastError = `GitHub API error: ${response.status} ${response.statusText}. ${text}`;
          console.error(`[Path Discovery] ${lastError}`);
          continue;
        }

        const data = (await response.json()) as { tree?: Array<{ path: string; type: string }> };

        if (!data.tree || !Array.isArray(data.tree)) {
          lastError = 'Invalid response from GitHub API (no tree data)';
          console.error(`[Path Discovery] ${lastError}`, data);
          continue;
        }

        const paths = data.tree
          .filter(
            (item) =>
              item.type === 'blob' &&
              (item.path.endsWith('fleet.yaml') || item.path.endsWith('fleet.yml'))
          )
          .map((item) => {
            const parts = item.path.split('/');
            parts.pop();
            return parts.join('/') || '.';
          })
          .filter((path) => path !== '.')
          .sort();

        console.log(`[Path Discovery] Found ${paths.length} paths with fleet.yaml/fleet.yml`);

        const pathInfos: PathInfo[] = await Promise.all(
          paths.map(async (path: string) => {
            const deps = await this.fetchFleetYamlDeps(parsed.owner, parsed.repo, b, path);
            return { path, dependsOn: deps };
          })
        );

        return pathInfos;
      } catch (err) {
        if (err instanceof Error && err.message.includes('rate limit')) {
          throw err;
        }
        if (err instanceof TypeError && err.message.includes('fetch')) {
          lastError = `Network error: Unable to reach GitHub API. Check your internet connection.`;
        } else {
          lastError = err instanceof Error ? err.message : String(err);
        }
        console.error(`[Path Discovery] Error fetching branch ${b}:`, lastError, err);
      }
    }

    const triedBranches = branches.join(', ');
    throw new Error(lastError || `Could not access repository. Tried branches: ${triedBranches}`);
  }
}

// Re-export types for backward compatibility
export type { PathInfo as GitHubPathInfo };
