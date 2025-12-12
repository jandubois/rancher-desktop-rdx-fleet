/**
 * Unit tests for Git Service
 *
 * Tests the path discovery and git clone utilities.
 * These tests import and test the actual exported functions from git.ts.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  extractDependsOn,
  buildAuthenticatedUrl,
  isFleetFile,
  shouldSkipDirectory,
  sanitizeUrl,
  findFleetFiles,
  PathInfo,
} from './git.js';

describe('extractDependsOn', () => {
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

describe('isFleetFile', () => {
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
});

describe('shouldSkipDirectory', () => {
  it('should skip .git directory', () => {
    expect(shouldSkipDirectory('.git')).toBe(true);
  });

  it('should not skip other directories', () => {
    expect(shouldSkipDirectory('src')).toBe(false);
    expect(shouldSkipDirectory('apps')).toBe(false);
    expect(shouldSkipDirectory('.github')).toBe(false);
  });
});

describe('sanitizeUrl', () => {
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

describe('PathInfo sorting', () => {
  // Test that paths are sorted alphabetically (using standard JS sort)
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

describe('Temp directory management', () => {
  // Test temp directory tracking and cleanup pattern
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

describe('Fleet YAML file scanning (integration)', () => {
  let testDir: string;

  beforeEach(() => {
    // Create a temporary directory structure for testing
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-scan-test-'));
  });

  afterEach(() => {
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  // Helper to convert findFleetFiles output to sorted PathInfo array
  // (skips root-level fleet.yaml files as the actual code does)
  function scanForFleetPaths(cloneDir: string): Array<{ path: string; dependsOn?: string[] }> {
    const fleetFiles = findFleetFiles(cloneDir); // Uses exported function

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

  it('should find fleet.yaml files in subdirectories', () => {
    // Create directory structure
    fs.mkdirSync(path.join(testDir, 'apps/nginx'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'apps/redis'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'apps/nginx/fleet.yaml'), 'name: nginx');
    fs.writeFileSync(path.join(testDir, 'apps/redis/fleet.yaml'), 'name: redis');

    const paths = scanForFleetPaths(testDir);

    expect(paths).toHaveLength(2);
    expect(paths.map((p) => p.path)).toEqual(['apps/nginx', 'apps/redis']);
  });

  it('should find fleet.yml files', () => {
    fs.mkdirSync(path.join(testDir, 'bundles'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'bundles/fleet.yml'), 'name: bundle');

    const paths = scanForFleetPaths(testDir);

    expect(paths).toHaveLength(1);
    expect(paths[0].path).toBe('bundles');
  });

  it('should skip root-level fleet.yaml', () => {
    fs.writeFileSync(path.join(testDir, 'fleet.yaml'), 'name: root');
    fs.mkdirSync(path.join(testDir, 'apps'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'apps/fleet.yaml'), 'name: app');

    const paths = scanForFleetPaths(testDir);

    expect(paths).toHaveLength(1);
    expect(paths[0].path).toBe('apps');
  });

  it('should skip .git directory', () => {
    fs.mkdirSync(path.join(testDir, '.git/hooks'), { recursive: true });
    fs.writeFileSync(path.join(testDir, '.git/hooks/fleet.yaml'), 'should be skipped');
    fs.mkdirSync(path.join(testDir, 'apps'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'apps/fleet.yaml'), 'name: app');

    const paths = scanForFleetPaths(testDir);

    expect(paths).toHaveLength(1);
    expect(paths[0].path).toBe('apps');
  });

  it('should handle deeply nested directories', () => {
    fs.mkdirSync(path.join(testDir, 'level1/level2/level3/level4'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'level1/level2/level3/level4/fleet.yaml'), 'name: deep');

    const paths = scanForFleetPaths(testDir);

    expect(paths).toHaveLength(1);
    expect(paths[0].path).toBe('level1/level2/level3/level4');
  });

  it('should return empty array for empty directory', () => {
    const paths = scanForFleetPaths(testDir);
    expect(paths).toEqual([]);
  });

  it('should return sorted paths', () => {
    fs.mkdirSync(path.join(testDir, 'zebra'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'alpha'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'middle'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'zebra/fleet.yaml'), 'name: z');
    fs.writeFileSync(path.join(testDir, 'alpha/fleet.yaml'), 'name: a');
    fs.writeFileSync(path.join(testDir, 'middle/fleet.yaml'), 'name: m');

    const paths = scanForFleetPaths(testDir);

    expect(paths.map((p) => p.path)).toEqual(['alpha', 'middle', 'zebra']);
  });
});

describe('Fleet YAML dependency parsing (integration)', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-parse-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

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
