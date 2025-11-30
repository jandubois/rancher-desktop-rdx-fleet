import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { parseGitHubUrl, fetchFleetYamlDeps, fetchGitHubPaths, computeBundleName, buildBundleInfo } from './github';

// Mock console.log/error to reduce noise in tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('parseGitHubUrl', () => {
  it('parses https://github.com/owner/repo', () => {
    const result = parseGitHubUrl('https://github.com/rancher/fleet-examples');
    expect(result).toEqual({ owner: 'rancher', repo: 'fleet-examples' });
  });

  it('parses https://github.com/owner/repo.git', () => {
    const result = parseGitHubUrl('https://github.com/rancher/fleet-examples.git');
    expect(result).toEqual({ owner: 'rancher', repo: 'fleet-examples' });
  });

  it('parses URL with extra path segments', () => {
    const result = parseGitHubUrl('https://github.com/rancher/fleet-examples/tree/main/simple');
    expect(result).toEqual({ owner: 'rancher', repo: 'fleet-examples' });
  });

  it('returns null for non-GitHub URLs', () => {
    expect(parseGitHubUrl('https://gitlab.com/owner/repo')).toBeNull();
    expect(parseGitHubUrl('https://bitbucket.org/owner/repo')).toBeNull();
    expect(parseGitHubUrl('not a url')).toBeNull();
  });

  it('handles github.com without https prefix', () => {
    const result = parseGitHubUrl('github.com/owner/repo');
    expect(result).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('handles SSH-style URLs', () => {
    // The current regex doesn't handle git@ prefix, so this returns null
    const result = parseGitHubUrl('git@github.com:owner/repo.git');
    // Note: Current implementation doesn't support SSH URLs
    expect(result).toBeNull();
  });
});

// Set up MSW server for mocking fetch calls
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('fetchFleetYamlDeps', () => {
  it('parses dependsOn with "- name: bundlename" format', async () => {
    server.use(
      http.get('https://raw.githubusercontent.com/owner/repo/main/app/fleet.yaml', () => {
        return new HttpResponse(
`name: my-app
dependsOn:
  - name: monitoring-crds
  - name: cert-manager
`, { status: 200 });
      })
    );

    const deps = await fetchFleetYamlDeps('owner', 'repo', 'main', 'app');
    expect(deps).toEqual(['monitoring-crds', 'cert-manager']);
  });

  it('parses dependsOn with "- bundlename" format', async () => {
    server.use(
      http.get('https://raw.githubusercontent.com/owner/repo/main/app/fleet.yaml', () => {
        return new HttpResponse(
`dependsOn:
  - dep1
  - dep2
`, { status: 200 });
      })
    );

    const deps = await fetchFleetYamlDeps('owner', 'repo', 'main', 'app');
    expect(deps).toEqual(['dep1', 'dep2']);
  });

  it('returns undefined when no dependsOn section', async () => {
    server.use(
      http.get('https://raw.githubusercontent.com/owner/repo/main/app/fleet.yaml', () => {
        return new HttpResponse(`
name: my-app
helm:
  chart: ./chart
`, { status: 200 });
      })
    );

    const deps = await fetchFleetYamlDeps('owner', 'repo', 'main', 'app');
    expect(deps).toBeUndefined();
  });

  it('tries fleet.yml when fleet.yaml not found', async () => {
    server.use(
      http.get('https://raw.githubusercontent.com/owner/repo/main/app/fleet.yaml', () => {
        return new HttpResponse(null, { status: 404 });
      }),
      http.get('https://raw.githubusercontent.com/owner/repo/main/app/fleet.yml', () => {
        return new HttpResponse(`
dependsOn:
  - name: from-yml-file
`, { status: 200 });
      })
    );

    const deps = await fetchFleetYamlDeps('owner', 'repo', 'main', 'app');
    expect(deps).toEqual(['from-yml-file']);
  });

  it('returns undefined when both files not found', async () => {
    server.use(
      http.get('https://raw.githubusercontent.com/owner/repo/main/app/fleet.yaml', () => {
        return new HttpResponse(null, { status: 404 });
      }),
      http.get('https://raw.githubusercontent.com/owner/repo/main/app/fleet.yml', () => {
        return new HttpResponse(null, { status: 404 });
      })
    );

    const deps = await fetchFleetYamlDeps('owner', 'repo', 'main', 'app');
    expect(deps).toBeUndefined();
  });

  it('handles empty path (root directory)', async () => {
    server.use(
      http.get('https://raw.githubusercontent.com/owner/repo/main/fleet.yaml', () => {
        return new HttpResponse(`
dependsOn:
  - root-dep
`, { status: 200 });
      })
    );

    const deps = await fetchFleetYamlDeps('owner', 'repo', 'main', '');
    expect(deps).toEqual(['root-dep']);
  });
});

describe('fetchGitHubPaths', () => {
  it('finds paths containing fleet.yaml files', async () => {
    server.use(
      http.get('https://api.github.com/repos/rancher/fleet-examples/git/trees/master', () => {
        return HttpResponse.json({
          tree: [
            { path: 'simple/fleet.yaml', type: 'blob' },
            { path: 'multi-cluster/fleet.yaml', type: 'blob' },
            { path: 'README.md', type: 'blob' },
          ],
        });
      }),
      // Mock the dependency fetches (return no deps)
      http.get('https://raw.githubusercontent.com/*', () => {
        return new HttpResponse(null, { status: 404 });
      })
    );

    const paths = await fetchGitHubPaths('https://github.com/rancher/fleet-examples');
    expect(paths).toHaveLength(2);
    expect(paths.map(p => p.path)).toEqual(['multi-cluster', 'simple']);
  });

  it('also finds fleet.yml files', async () => {
    server.use(
      http.get('https://api.github.com/repos/owner/repo/git/trees/main', () => {
        return HttpResponse.json({
          tree: [
            { path: 'app1/fleet.yaml', type: 'blob' },
            { path: 'app2/fleet.yml', type: 'blob' },
          ],
        });
      }),
      http.get('https://raw.githubusercontent.com/*', () => {
        return new HttpResponse(null, { status: 404 });
      })
    );

    const paths = await fetchGitHubPaths('https://github.com/owner/repo', 'main');
    expect(paths.map(p => p.path)).toEqual(['app1', 'app2']);
  });

  it('tries master then main branch when no branch specified', async () => {
    const branchesRequested: string[] = [];

    server.use(
      http.get('https://api.github.com/repos/owner/repo/git/trees/:branch', ({ params }) => {
        branchesRequested.push(params.branch as string);
        if (params.branch === 'master') {
          return new HttpResponse(null, { status: 404 });
        }
        return HttpResponse.json({
          tree: [{ path: 'app/fleet.yaml', type: 'blob' }],
        });
      }),
      http.get('https://raw.githubusercontent.com/*', () => {
        return new HttpResponse(null, { status: 404 });
      })
    );

    await fetchGitHubPaths('https://github.com/owner/repo');
    expect(branchesRequested).toContain('master');
    expect(branchesRequested).toContain('main');
  });

  it('uses specified branch only', async () => {
    let branchRequested = '';

    server.use(
      http.get('https://api.github.com/repos/owner/repo/git/trees/:branch', ({ params }) => {
        branchRequested = params.branch as string;
        return HttpResponse.json({
          tree: [{ path: 'app/fleet.yaml', type: 'blob' }],
        });
      }),
      http.get('https://raw.githubusercontent.com/*', () => {
        return new HttpResponse(null, { status: 404 });
      })
    );

    await fetchGitHubPaths('https://github.com/owner/repo', 'develop');
    expect(branchRequested).toBe('develop');
  });

  it('throws error for rate limiting (403)', async () => {
    server.use(
      http.get('https://api.github.com/repos/owner/repo/git/trees/main', () => {
        return new HttpResponse(null, {
          status: 403,
          headers: {
            'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600),
          },
        });
      })
    );

    await expect(fetchGitHubPaths('https://github.com/owner/repo', 'main'))
      .rejects.toThrow('rate limit');
  });

  it('throws error for non-GitHub URLs', async () => {
    await expect(fetchGitHubPaths('https://gitlab.com/owner/repo'))
      .rejects.toThrow('Only GitHub repositories are supported');
  });

  it('throws error when all branches return 404', async () => {
    server.use(
      http.get('https://api.github.com/repos/owner/repo/git/trees/:branch', () => {
        return new HttpResponse(null, { status: 404 });
      })
    );

    await expect(fetchGitHubPaths('https://github.com/owner/repo'))
      .rejects.toThrow("Branch 'main' not found");
  });

  it('fetches dependencies for each path', async () => {
    server.use(
      http.get('https://api.github.com/repos/owner/repo/git/trees/main', () => {
        return HttpResponse.json({
          tree: [
            { path: 'app/fleet.yaml', type: 'blob' },
          ],
        });
      }),
      http.get('https://raw.githubusercontent.com/owner/repo/main/app/fleet.yaml', () => {
        return new HttpResponse(`
dependsOn:
  - name: my-dependency
`, { status: 200 });
      })
    );

    const paths = await fetchGitHubPaths('https://github.com/owner/repo', 'main');
    expect(paths).toHaveLength(1);
    expect(paths[0]).toEqual({
      path: 'app',
      dependsOn: ['my-dependency'],
    });
  });

  it('excludes root-level fleet.yaml (path = ".")', async () => {
    server.use(
      http.get('https://api.github.com/repos/owner/repo/git/trees/main', () => {
        return HttpResponse.json({
          tree: [
            { path: 'fleet.yaml', type: 'blob' },  // Root level
            { path: 'subdir/fleet.yaml', type: 'blob' },
          ],
        });
      }),
      http.get('https://raw.githubusercontent.com/*', () => {
        return new HttpResponse(null, { status: 404 });
      })
    );

    const paths = await fetchGitHubPaths('https://github.com/owner/repo', 'main');
    expect(paths.map(p => p.path)).toEqual(['subdir']);
  });

  it('handles invalid API response (no tree)', async () => {
    server.use(
      http.get('https://api.github.com/repos/owner/repo/git/trees/master', () => {
        return HttpResponse.json({ message: 'Not found' });
      }),
      http.get('https://api.github.com/repos/owner/repo/git/trees/main', () => {
        return HttpResponse.json({ message: 'Not found' });
      })
    );

    await expect(fetchGitHubPaths('https://github.com/owner/repo'))
      .rejects.toThrow('Invalid response from GitHub API');
  });
});

describe('computeBundleName', () => {
  it('combines gitrepo name and path with hyphens', () => {
    expect(computeBundleName('my-repo', 'apps/frontend')).toBe('my-repo-apps-frontend');
  });

  it('handles nested paths', () => {
    expect(computeBundleName('fleet-examples', 'single-cluster/helm-multi-chart/rancher-monitoring'))
      .toBe('fleet-examples-single-cluster-helm-multi-chart-rancher-monitoring');
  });

  it('removes leading slashes from path', () => {
    expect(computeBundleName('my-repo', '/apps/frontend')).toBe('my-repo-apps-frontend');
  });

  it('removes trailing slashes from path', () => {
    expect(computeBundleName('my-repo', 'apps/frontend/')).toBe('my-repo-apps-frontend');
  });

  it('handles empty path', () => {
    expect(computeBundleName('my-repo', '')).toBe('my-repo');
  });

  it('handles root path (dot)', () => {
    expect(computeBundleName('my-repo', '.')).toBe('my-repo');
  });

  it('handles single directory path', () => {
    expect(computeBundleName('my-repo', 'simple')).toBe('my-repo-simple');
  });
});

describe('buildBundleInfo', () => {
  it('creates BundleInfo from gitrepo name and PathInfo', () => {
    const pathInfo = { path: 'apps/frontend', dependsOn: ['dep1', 'dep2'] };
    const result = buildBundleInfo('my-repo', pathInfo);

    expect(result).toEqual({
      bundleName: 'my-repo-apps-frontend',
      gitRepoName: 'my-repo',
      path: 'apps/frontend',
      dependsOn: ['dep1', 'dep2'],
    });
  });

  it('handles PathInfo without dependsOn', () => {
    const pathInfo = { path: 'infra/database' };
    const result = buildBundleInfo('my-repo', pathInfo);

    expect(result).toEqual({
      bundleName: 'my-repo-infra-database',
      gitRepoName: 'my-repo',
      path: 'infra/database',
      dependsOn: [],
    });
  });

  it('handles empty dependsOn array', () => {
    const pathInfo = { path: 'simple', dependsOn: [] };
    const result = buildBundleInfo('test', pathInfo);

    expect(result.dependsOn).toEqual([]);
  });
});
