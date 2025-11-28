// GitHub API utilities for path discovery

// Path info with dependency data
export interface PathInfo {
  path: string;
  dependsOn?: string[];  // Bundle names this path depends on
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
      // Simple YAML parsing for dependsOn - look for "dependsOn:" section
      // Match all lines that are indented list items after "dependsOn:"
      const dependsOnMatch = content.match(/dependsOn:\s*\n((?:[ \t]+-[^\n]*\n)+)/);
      if (!dependsOnMatch) return undefined;

      // Extract bundle names from dependsOn list
      const deps: string[] = [];
      const lines = dependsOnMatch[1].split('\n');
      for (const line of lines) {
        // Match "- name: bundlename" or "- bundlename"
        const nameMatch = line.match(/^\s*-\s*(?:name:\s*)?(\S+)/);
        if (nameMatch) {
          deps.push(nameMatch[1]);
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
