// GitHub API utilities for path discovery
import yaml from 'js-yaml';
import { BundleInfo } from '../types';

// Path info with dependency data
export interface PathInfo {
  path: string;
  dependsOn?: string[];  // Bundle names this path depends on
}

/**
 * Compute Fleet bundle name from GitRepo name and path.
 * Fleet creates bundle names as: <GitRepo-name>-<path-with-slashes-replaced-by-hyphens>
 *
 * IMPORTANT: The bundle name depends on GitRepo.metadata.name, NOT the Git URL.
 */
export function computeBundleName(gitRepoName: string, path: string): string {
  // Normalize path: remove leading/trailing slashes, replace internal slashes with hyphens
  const normalizedPath = path
    .replace(/^\/+|\/+$/g, '')  // Remove leading/trailing slashes
    .replace(/\//g, '-');        // Replace slashes with hyphens

  // If path is empty or root, just return the gitrepo name
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
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

/**
 * Fetch fleet.yaml (or fleet.yml) content and parse dependsOn
 */
export async function fetchFleetYamlDeps(
  owner: string,
  repo: string,
  branch: string,
  path: string
): Promise<string[] | undefined> {
  // Try fleet.yaml first, then fleet.yml
  const filenames = ['fleet.yaml', 'fleet.yml'];

  for (const filename of filenames) {
    try {
      const fleetYamlPath = path ? `${path}/${filename}` : filename;
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${fleetYamlPath}`;
      const response = await fetch(rawUrl);
      if (!response.ok) continue;  // Try next filename

      const content = await response.text();
      // Use js-yaml for proper YAML parsing
      const parsed = yaml.load(content) as Record<string, unknown> | null;
      if (!parsed || typeof parsed !== 'object') return undefined;

      const dependsOn = parsed.dependsOn;
      if (!Array.isArray(dependsOn)) return undefined;

      // Extract bundle names from dependsOn list
      // Supports both "- bundlename" and "- name: bundlename" formats
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
      continue;  // Try next filename
    }
  }
  return undefined;
}

/**
 * Fetch available paths from GitHub repo with dependency info
 */
export async function fetchGitHubPaths(repoUrl: string, branch?: string): Promise<PathInfo[]> {
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
      const response = await fetch(apiUrl);
      console.log(`[Path Discovery] Response status: ${response.status}`);

      // Check rate limit headers
      const remaining = response.headers.get('X-RateLimit-Remaining');
      const limit = response.headers.get('X-RateLimit-Limit');
      console.log(`[Path Discovery] Rate limit: ${remaining}/${limit}`);

      if (response.status === 403) {
        // Rate limited
        const resetHeader = response.headers.get('X-RateLimit-Reset');
        const resetTime = resetHeader ? new Date(parseInt(resetHeader) * 1000).toLocaleTimeString() : 'unknown';
        throw new Error(`GitHub API rate limit exceeded. Resets at ${resetTime}. Try again later or use a different network.`);
      }

      if (response.status === 404) {
        lastError = `Branch '${b}' not found in ${parsed.owner}/${parsed.repo}`;
        console.log(`[Path Discovery] ${lastError}`);
        continue; // Try next branch
      }

      if (!response.ok) {
        const text = await response.text();
        lastError = `GitHub API error: ${response.status} ${response.statusText}. ${text}`;
        console.error(`[Path Discovery] ${lastError}`);
        continue;
      }

      const data = await response.json();

      if (!data.tree || !Array.isArray(data.tree)) {
        lastError = 'Invalid response from GitHub API (no tree data)';
        console.error(`[Path Discovery] ${lastError}`, data);
        continue;
      }

      // Find directories containing fleet.yaml or fleet.yml
      const paths = data.tree
        .filter((item: { path: string; type: string }) =>
          item.type === 'blob' && (item.path.endsWith('fleet.yaml') || item.path.endsWith('fleet.yml')))
        .map((item: { path: string }) => {
          const parts = item.path.split('/');
          parts.pop();
          return parts.join('/') || '.';
        })
        .filter((path: string) => path !== '.')
        .sort();

      console.log(`[Path Discovery] Found ${paths.length} paths with fleet.yaml/fleet.yml`);

      // Fetch dependency info for each path (in parallel)
      const pathInfos: PathInfo[] = await Promise.all(
        paths.map(async (path: string) => {
          const deps = await fetchFleetYamlDeps(parsed.owner, parsed.repo, b, path);
          return { path, dependsOn: deps };
        })
      );

      return pathInfos;
    } catch (err) {
      if (err instanceof Error && err.message.includes('rate limit')) {
        throw err; // Re-throw rate limit errors immediately
      }
      // Check for network errors
      if (err instanceof TypeError && err.message.includes('fetch')) {
        lastError = `Network error: Unable to reach GitHub API. Check your internet connection.`;
      } else {
        lastError = err instanceof Error ? err.message : String(err);
      }
      console.error(`[Path Discovery] Error fetching branch ${b}:`, lastError, err);
    }
  }

  // Provide more helpful error message
  const triedBranches = branches.join(', ');
  throw new Error(lastError || `Could not access repository. Tried branches: ${triedBranches}`);
}
