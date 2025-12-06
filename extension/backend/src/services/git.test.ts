/**
 * Unit tests for Git Service
 *
 * Tests the path discovery and git clone utilities.
 * Since the service has private methods, we replicate the logic
 * for testing purposes, following the pattern used in other service tests.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Git Service utilities', () => {
  describe('extractDependsOn', () => {
    // Replicate the private extractDependsOn method logic for testing
    function extractDependsOn(content: string): string[] {
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

    it('should extract inline array dependencies with double quotes', () => {
      const content = `
name: my-bundle
dependsOn: ["bundle1", "bundle2"]
helm:
  chart: nginx
`;
      const deps = extractDependsOn(content);
      expect(deps).toEqual(['bundle1', 'bundle2']);
    });

    it('should extract inline array dependencies with single quotes', () => {
      const content = `
name: my-bundle
dependsOn: ['bundle1', 'bundle2']
`;
      const deps = extractDependsOn(content);
      expect(deps).toEqual(['bundle1', 'bundle2']);
    });

    it('should extract inline array dependencies without quotes', () => {
      const content = `
name: my-bundle
dependsOn: [bundle1, bundle2, bundle3]
`;
      const deps = extractDependsOn(content);
      expect(deps).toEqual(['bundle1', 'bundle2', 'bundle3']);
    });

    it('should extract YAML list with name: format', () => {
      const content = `
name: my-bundle
dependsOn:
  - name: bundle1
  - name: bundle2
helm:
  chart: nginx
`;
      const deps = extractDependsOn(content);
      expect(deps).toEqual(['bundle1', 'bundle2']);
    });

    it('should extract YAML list with quoted name values', () => {
      const content = `
name: my-bundle
dependsOn:
  - name: "bundle1"
  - name: 'bundle2'
`;
      const deps = extractDependsOn(content);
      expect(deps).toEqual(['bundle1', 'bundle2']);
    });

    it('should extract simple YAML list format', () => {
      const content = `
name: my-bundle
dependsOn:
  - bundle1
  - bundle2
`;
      const deps = extractDependsOn(content);
      expect(deps).toEqual(['bundle1', 'bundle2']);
    });

    it('should extract simple YAML list with quoted values', () => {
      const content = `
dependsOn:
  - "bundle1"
  - 'bundle2'
`;
      const deps = extractDependsOn(content);
      expect(deps).toEqual(['bundle1', 'bundle2']);
    });

    it('should return empty array when no dependsOn', () => {
      const content = `
name: my-bundle
helm:
  chart: nginx
`;
      const deps = extractDependsOn(content);
      expect(deps).toEqual([]);
    });

    it('should return empty array for empty dependsOn list', () => {
      const content = `
name: my-bundle
dependsOn: []
`;
      const deps = extractDependsOn(content);
      expect(deps).toEqual([]);
    });

    it('should stop parsing at next top-level key', () => {
      const content = `
dependsOn:
  - bundle1
  - bundle2
helm:
  chart: nginx
`;
      const deps = extractDependsOn(content);
      expect(deps).toEqual(['bundle1', 'bundle2']);
    });

    it('should handle mixed YAML list items', () => {
      const content = `
dependsOn:
  - name: bundle1
  - bundle2
  - name: bundle3
`;
      const deps = extractDependsOn(content);
      expect(deps).toEqual(['bundle1', 'bundle2', 'bundle3']);
    });

    it('should handle single dependency', () => {
      const content = `
dependsOn: ["single-dep"]
`;
      const deps = extractDependsOn(content);
      expect(deps).toEqual(['single-dep']);
    });

    it('should handle whitespace in inline array', () => {
      const content = `
dependsOn: [ "bundle1" ,  "bundle2"  , "bundle3" ]
`;
      const deps = extractDependsOn(content);
      expect(deps).toEqual(['bundle1', 'bundle2', 'bundle3']);
    });
  });

  describe('buildAuthenticatedUrl', () => {
    // Replicate the private buildAuthenticatedUrl method logic for testing
    function buildAuthenticatedUrl(
      repoUrl: string,
      credentials?: { username: string; password: string }
    ): string {
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

    it('should return original URL when no credentials', () => {
      const url = 'https://github.com/user/repo';
      expect(buildAuthenticatedUrl(url)).toBe(url);
    });

    it('should add credentials to URL', () => {
      const url = 'https://github.com/user/repo';
      const credentials = { username: 'myuser', password: 'mypass' };
      const result = buildAuthenticatedUrl(url, credentials);
      expect(result).toBe('https://myuser:mypass@github.com/user/repo');
    });

    it('should encode special characters in username', () => {
      const url = 'https://github.com/user/repo';
      const credentials = { username: 'user@example.com', password: 'pass' };
      const result = buildAuthenticatedUrl(url, credentials);
      expect(result).toBe('https://user%40example.com:pass@github.com/user/repo');
    });

    it('should encode special characters in password', () => {
      const url = 'https://github.com/user/repo';
      const credentials = { username: 'user', password: 'p@ss/word!' };
      const result = buildAuthenticatedUrl(url, credentials);
      expect(result).toContain('user:p%40ss%2Fword!@github.com');
    });

    it('should handle URLs with existing paths', () => {
      const url = 'https://gitlab.com/group/subgroup/repo.git';
      const credentials = { username: 'token', password: 'abc123' };
      const result = buildAuthenticatedUrl(url, credentials);
      expect(result).toBe('https://token:abc123@gitlab.com/group/subgroup/repo.git');
    });

    it('should return original URL for invalid URL format', () => {
      const url = 'not-a-valid-url';
      const credentials = { username: 'user', password: 'pass' };
      const result = buildAuthenticatedUrl(url, credentials);
      expect(result).toBe(url);
    });

    it('should handle GitHub PAT authentication style', () => {
      const url = 'https://github.com/user/repo';
      // GitHub PATs use the token as password with any username (often 'x-access-token')
      const credentials = { username: 'x-access-token', password: 'ghp_xxxxxxxxxxxx' };
      const result = buildAuthenticatedUrl(url, credentials);
      expect(result).toBe('https://x-access-token:ghp_xxxxxxxxxxxx@github.com/user/repo');
    });

    it('should handle empty credentials', () => {
      const url = 'https://github.com/user/repo';
      const credentials = { username: '', password: '' };
      const result = buildAuthenticatedUrl(url, credentials);
      // Empty username/password still get set in URL
      expect(result).toBe('https://github.com/user/repo');
    });
  });

  describe('PathInfo sorting', () => {
    // Test that paths are sorted alphabetically
    interface PathInfo {
      path: string;
      dependsOn?: string[];
    }

    function sortPaths(paths: PathInfo[]): PathInfo[] {
      return [...paths].sort((a, b) => a.path.localeCompare(b.path));
    }

    it('should sort paths alphabetically', () => {
      const paths: PathInfo[] = [
        { path: 'infra/cert-manager' },
        { path: 'apps/nginx' },
        { path: 'apps/redis' },
        { path: 'base/crds' },
      ];

      const sorted = sortPaths(paths);
      expect(sorted.map((p) => p.path)).toEqual([
        'apps/nginx',
        'apps/redis',
        'base/crds',
        'infra/cert-manager',
      ]);
    });

    it('should preserve dependsOn during sort', () => {
      const paths: PathInfo[] = [
        { path: 'apps/nginx', dependsOn: ['base'] },
        { path: 'base' },
      ];

      const sorted = sortPaths(paths);
      expect(sorted[0].path).toBe('apps/nginx');
      expect(sorted[0].dependsOn).toEqual(['base']);
      expect(sorted[1].path).toBe('base');
    });
  });

  describe('Debug log management', () => {
    // Test debug log array management
    function createLogManager(maxSize: number) {
      let log: string[] = [];

      return {
        log: (message: string) => {
          const timestamp = new Date().toISOString();
          const entry = `[${timestamp}] ${message}`;
          log.push(entry);
          if (log.length > maxSize) {
            log = log.slice(-maxSize);
          }
        },
        getLog: () => [...log],
        clear: () => {
          log = [];
        },
      };
    }

    it('should add log entries', () => {
      const manager = createLogManager(100);
      manager.log('Test message 1');
      manager.log('Test message 2');

      const log = manager.getLog();
      expect(log).toHaveLength(2);
      expect(log[0]).toContain('Test message 1');
      expect(log[1]).toContain('Test message 2');
    });

    it('should include timestamps', () => {
      const manager = createLogManager(100);
      manager.log('Test');

      const log = manager.getLog();
      // Check for ISO timestamp format
      expect(log[0]).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should limit log size', () => {
      const manager = createLogManager(3);
      manager.log('Message 1');
      manager.log('Message 2');
      manager.log('Message 3');
      manager.log('Message 4');
      manager.log('Message 5');

      const log = manager.getLog();
      expect(log).toHaveLength(3);
      expect(log[0]).toContain('Message 3');
      expect(log[1]).toContain('Message 4');
      expect(log[2]).toContain('Message 5');
    });

    it('should return a copy of the log', () => {
      const manager = createLogManager(100);
      manager.log('Test');

      const log1 = manager.getLog();
      const log2 = manager.getLog();

      expect(log1).toEqual(log2);
      expect(log1).not.toBe(log2); // Different array instances
    });
  });

  describe('Branch fallback logic', () => {
    // Test the branch fallback logic used in shallowClone
    async function tryBranches(
      branchesToTry: string[],
      cloneFn: (branch: string) => Promise<void>
    ): Promise<{ branch: string } | { error: Error }> {
      let lastError: Error | null = null;

      for (const branch of branchesToTry) {
        try {
          await cloneFn(branch);
          return { branch };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          // Only continue if it's a branch not found error
          if (
            !lastError.message.includes('Remote branch') &&
            !lastError.message.includes('not found') &&
            !lastError.message.includes('could not find remote branch')
          ) {
            // Non-branch error, don't try other branches
            return { error: lastError };
          }
        }
      }

      return {
        error: new Error(
          `Could not clone repository. Tried branches: ${branchesToTry.join(', ')}. ` +
            `Last error: ${lastError?.message || 'Unknown error'}`
        ),
      };
    }

    it('should succeed with first branch', async () => {
      const result = await tryBranches(['main', 'master'], async () => {
        // Success on first try
      });

      expect('branch' in result && result.branch).toBe('main');
    });

    it('should fallback to second branch when first not found', async () => {
      let attempts = 0;
      const result = await tryBranches(['main', 'master'], async (branch) => {
        attempts++;
        if (branch === 'main') {
          throw new Error('Remote branch main not found');
        }
      });

      expect(attempts).toBe(2);
      expect('branch' in result && result.branch).toBe('master');
    });

    it('should stop on non-branch error', async () => {
      let attempts = 0;
      const result = await tryBranches(['main', 'master'], async () => {
        attempts++;
        throw new Error('Authentication failed');
      });

      expect(attempts).toBe(1);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error.message).toBe('Authentication failed');
      }
    });

    it('should return error when all branches fail', async () => {
      const result = await tryBranches(['main', 'master'], async (branch) => {
        throw new Error(`could not find remote branch ${branch}`);
      });

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error.message).toContain('Tried branches: main, master');
      }
    });

    it('should use specified branch without fallback', async () => {
      let triedBranches: string[] = [];
      const result = await tryBranches(['develop'], async (branch) => {
        triedBranches.push(branch);
      });

      expect(triedBranches).toEqual(['develop']);
      expect('branch' in result && result.branch).toBe('develop');
    });
  });

  describe('Temp directory management', () => {
    // Test temp directory tracking and cleanup
    function createTempManager() {
      const tempDirs = new Set<string>();

      return {
        create: () => {
          const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-test-'));
          tempDirs.add(dir);
          return dir;
        },
        cleanup: (dir: string) => {
          if (!tempDirs.has(dir)) return false;
          try {
            fs.rmSync(dir, { recursive: true, force: true });
            tempDirs.delete(dir);
            return true;
          } catch {
            return false;
          }
        },
        cleanupAll: () => {
          for (const dir of tempDirs) {
            try {
              fs.rmSync(dir, { recursive: true, force: true });
            } catch {
              // Ignore cleanup errors
            }
          }
          tempDirs.clear();
        },
        count: () => tempDirs.size,
        has: (dir: string) => tempDirs.has(dir),
      };
    }

    let manager: ReturnType<typeof createTempManager>;

    beforeEach(() => {
      manager = createTempManager();
    });

    afterEach(() => {
      manager.cleanupAll();
    });

    it('should create temp directories', () => {
      const dir = manager.create();
      expect(fs.existsSync(dir)).toBe(true);
      expect(manager.count()).toBe(1);
      expect(manager.has(dir)).toBe(true);
    });

    it('should track multiple directories', () => {
      const dir1 = manager.create();
      const dir2 = manager.create();
      expect(manager.count()).toBe(2);
      expect(manager.has(dir1)).toBe(true);
      expect(manager.has(dir2)).toBe(true);
    });

    it('should cleanup individual directories', () => {
      const dir1 = manager.create();
      const dir2 = manager.create();

      expect(manager.cleanup(dir1)).toBe(true);
      expect(fs.existsSync(dir1)).toBe(false);
      expect(manager.has(dir1)).toBe(false);
      expect(manager.count()).toBe(1);

      // dir2 should still exist
      expect(fs.existsSync(dir2)).toBe(true);
      expect(manager.has(dir2)).toBe(true);
    });

    it('should not cleanup untracked directories', () => {
      const untracked = fs.mkdtempSync(path.join(os.tmpdir(), 'untracked-'));
      try {
        expect(manager.cleanup(untracked)).toBe(false);
        expect(fs.existsSync(untracked)).toBe(true);
      } finally {
        fs.rmSync(untracked, { recursive: true, force: true });
      }
    });

    it('should cleanup all directories', () => {
      const dir1 = manager.create();
      const dir2 = manager.create();
      const dir3 = manager.create();

      manager.cleanupAll();

      expect(fs.existsSync(dir1)).toBe(false);
      expect(fs.existsSync(dir2)).toBe(false);
      expect(fs.existsSync(dir3)).toBe(false);
      expect(manager.count()).toBe(0);
    });
  });

  describe('Fleet file detection', () => {
    // Test the logic for finding fleet.yaml files
    function isFleetFile(filename: string): boolean {
      return filename === 'fleet.yaml' || filename === 'fleet.yml';
    }

    function shouldSkipDirectory(dirname: string): boolean {
      return dirname === '.git';
    }

    it('should detect fleet.yaml', () => {
      expect(isFleetFile('fleet.yaml')).toBe(true);
    });

    it('should detect fleet.yml', () => {
      expect(isFleetFile('fleet.yml')).toBe(true);
    });

    it('should not match other files', () => {
      expect(isFleetFile('fleet.json')).toBe(false);
      expect(isFleetFile('fleet.yaml.bak')).toBe(false);
      expect(isFleetFile('my-fleet.yaml')).toBe(false);
      expect(isFleetFile('fleet')).toBe(false);
    });

    it('should skip .git directory', () => {
      expect(shouldSkipDirectory('.git')).toBe(true);
    });

    it('should not skip other directories', () => {
      expect(shouldSkipDirectory('src')).toBe(false);
      expect(shouldSkipDirectory('apps')).toBe(false);
      expect(shouldSkipDirectory('.github')).toBe(false);
    });
  });

  describe('Credential URL sanitization', () => {
    // Test that credentials are properly sanitized in logs
    function sanitizeUrl(url: string): string {
      return url.replace(/\/\/[^@]+@/, '//***@');
    }

    it('should mask credentials in URLs', () => {
      const url = 'https://user:password@github.com/user/repo';
      expect(sanitizeUrl(url)).toBe('https://***@github.com/user/repo');
    });

    it('should not modify URLs without credentials', () => {
      const url = 'https://github.com/user/repo';
      expect(sanitizeUrl(url)).toBe(url);
    });

    it('should handle complex passwords', () => {
      // Note: In practice, special chars like @ in passwords would be URL-encoded (%40)
      // The regex handles typical GitHub tokens which don't contain @ characters
      const url = 'https://token:ghp_abc123XYZ_1234567890abcdefg@github.com/user/repo';
      expect(sanitizeUrl(url)).toBe('https://***@github.com/user/repo');
    });

    it('should handle encoded characters in credentials', () => {
      const url = 'https://user%40email.com:pass%2Fword@github.com/user/repo';
      expect(sanitizeUrl(url)).toBe('https://***@github.com/user/repo');
    });
  });
});

describe('Fleet YAML file scanning', () => {
  let testDir: string;

  beforeEach(() => {
    // Create a temporary directory structure for testing
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-scan-test-'));
  });

  afterEach(() => {
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  // Replicate the scanning logic for testing
  async function findFleetFiles(
    baseDir: string,
    relativePath: string,
    results: string[]
  ): Promise<void> {
    const currentDir = path.join(baseDir, relativePath);

    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          if (entry.name === '.git') {
            continue;
          }
          await findFleetFiles(baseDir, entryRelativePath, results);
        } else if (entry.isFile()) {
          if (entry.name === 'fleet.yaml' || entry.name === 'fleet.yml') {
            results.push(entryRelativePath);
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }

  async function scanForFleetPaths(
    cloneDir: string
  ): Promise<Array<{ path: string; dependsOn?: string[] }>> {
    const fleetFiles: string[] = [];
    await findFleetFiles(cloneDir, '', fleetFiles);

    const pathInfos: Array<{ path: string; dependsOn?: string[] }> = [];
    for (const relativePath of fleetFiles) {
      const dirPath = path.dirname(relativePath);
      if (dirPath === '.') {
        continue; // Skip root-level fleet.yaml
      }
      pathInfos.push({ path: dirPath });
    }

    return pathInfos.sort((a, b) => a.path.localeCompare(b.path));
  }

  it('should find fleet.yaml files in subdirectories', async () => {
    // Create directory structure
    fs.mkdirSync(path.join(testDir, 'apps/nginx'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'apps/redis'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'apps/nginx/fleet.yaml'), 'name: nginx');
    fs.writeFileSync(path.join(testDir, 'apps/redis/fleet.yaml'), 'name: redis');

    const paths = await scanForFleetPaths(testDir);

    expect(paths).toHaveLength(2);
    expect(paths.map((p) => p.path)).toEqual(['apps/nginx', 'apps/redis']);
  });

  it('should find fleet.yml files', async () => {
    fs.mkdirSync(path.join(testDir, 'bundles'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'bundles/fleet.yml'), 'name: bundle');

    const paths = await scanForFleetPaths(testDir);

    expect(paths).toHaveLength(1);
    expect(paths[0].path).toBe('bundles');
  });

  it('should skip root-level fleet.yaml', async () => {
    fs.writeFileSync(path.join(testDir, 'fleet.yaml'), 'name: root');
    fs.mkdirSync(path.join(testDir, 'apps'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'apps/fleet.yaml'), 'name: app');

    const paths = await scanForFleetPaths(testDir);

    expect(paths).toHaveLength(1);
    expect(paths[0].path).toBe('apps');
  });

  it('should skip .git directory', async () => {
    fs.mkdirSync(path.join(testDir, '.git/hooks'), { recursive: true });
    fs.writeFileSync(path.join(testDir, '.git/hooks/fleet.yaml'), 'should be skipped');
    fs.mkdirSync(path.join(testDir, 'apps'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'apps/fleet.yaml'), 'name: app');

    const paths = await scanForFleetPaths(testDir);

    expect(paths).toHaveLength(1);
    expect(paths[0].path).toBe('apps');
  });

  it('should handle deeply nested directories', async () => {
    fs.mkdirSync(path.join(testDir, 'level1/level2/level3/level4'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'level1/level2/level3/level4/fleet.yaml'), 'name: deep');

    const paths = await scanForFleetPaths(testDir);

    expect(paths).toHaveLength(1);
    expect(paths[0].path).toBe('level1/level2/level3/level4');
  });

  it('should return empty array for empty directory', async () => {
    const paths = await scanForFleetPaths(testDir);
    expect(paths).toEqual([]);
  });

  it('should return sorted paths', async () => {
    fs.mkdirSync(path.join(testDir, 'zebra'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'alpha'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'middle'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'zebra/fleet.yaml'), 'name: z');
    fs.writeFileSync(path.join(testDir, 'alpha/fleet.yaml'), 'name: a');
    fs.writeFileSync(path.join(testDir, 'middle/fleet.yaml'), 'name: m');

    const paths = await scanForFleetPaths(testDir);

    expect(paths.map((p) => p.path)).toEqual(['alpha', 'middle', 'zebra']);
  });
});

describe('Fleet YAML dependency parsing', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-parse-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  // Replicate the parsing logic
  function extractDependsOn(content: string): string[] {
    const deps: string[] = [];

    const dependsOnMatch = content.match(/^dependsOn:\s*$/m);
    if (!dependsOnMatch) {
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

    const startIndex = dependsOnMatch.index! + dependsOnMatch[0].length;
    const restContent = content.slice(startIndex);

    const lines = restContent.split('\n');
    for (const line of lines) {
      if (/^[a-zA-Z]/.test(line)) {
        break;
      }

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

  function parseFleetYamlDeps(filePath: string): string[] | undefined {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const deps = extractDependsOn(content);
      return deps.length > 0 ? deps : undefined;
    } catch {
      return undefined;
    }
  }

  it('should parse dependencies from file', () => {
    const filePath = path.join(testDir, 'fleet.yaml');
    fs.writeFileSync(
      filePath,
      `
name: my-app
dependsOn:
  - name: base
  - name: infra
helm:
  chart: nginx
`
    );

    const deps = parseFleetYamlDeps(filePath);
    expect(deps).toEqual(['base', 'infra']);
  });

  it('should return undefined for file without dependencies', () => {
    const filePath = path.join(testDir, 'fleet.yaml');
    fs.writeFileSync(
      filePath,
      `
name: my-app
helm:
  chart: nginx
`
    );

    const deps = parseFleetYamlDeps(filePath);
    expect(deps).toBeUndefined();
  });

  it('should return undefined for non-existent file', () => {
    const deps = parseFleetYamlDeps(path.join(testDir, 'nonexistent.yaml'));
    expect(deps).toBeUndefined();
  });

  it('should handle file read errors gracefully', () => {
    // Create a directory instead of a file to cause read error
    const dirPath = path.join(testDir, 'fleet.yaml');
    fs.mkdirSync(dirPath);

    const deps = parseFleetYamlDeps(dirPath);
    expect(deps).toBeUndefined();
  });
});
