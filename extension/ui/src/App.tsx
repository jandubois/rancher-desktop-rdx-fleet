import { useState, useEffect, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import FormGroup from '@mui/material/FormGroup';
import Divider from '@mui/material/Divider';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import SyncIcon from '@mui/icons-material/Sync';
import { ddClient } from './lib/ddClient';

type FleetStatus = 'checking' | 'not-installed' | 'running' | 'error';

interface FleetState {
  status: FleetStatus;
  version?: string;
  error?: string;
}

interface GitRepo {
  name: string;
  repo: string;
  branch?: string;
  paths?: string[];
  paused?: boolean;  // When true, Fleet clones repo but doesn't deploy bundles
  status?: {
    ready: boolean;
    display?: {
      state?: string;
      message?: string;
      error?: boolean;
    };
    desiredReadyClusters: number;
    readyClusters: number;
    resources?: Array<{
      kind: string;
      name: string;
      state: string;
    }>;
    conditions?: Array<{
      type: string;
      status: string;
      message?: string;
    }>;
  };
}

// Always target the Rancher Desktop cluster, regardless of user's current context
const KUBE_CONTEXT = 'rancher-desktop';
const FLEET_NAMESPACE = 'fleet-local';

// =============================================================================
// PATH DISCOVERY DESIGN NOTES
// =============================================================================
//
// We use the GitHub API to discover available paths (directories containing
// fleet.yaml or fleet.yml files) in a repository. This approach was chosen
// after exploring Fleet-based alternatives that didn't work reliably.
//
// WHAT WE TRIED (Fleet-based discovery):
// 1. Create a paused GitRepo and wait for Fleet to create Bundle resources
// 2. Query Bundles to extract path information
// 3. Also tried: temporary pods to clone repos, separate discovery namespaces
//
// WHY FLEET-BASED DISCOVERY DOESN'T WORK:
// - Bundle names are hashed via names.HelmReleaseName() - the original path
//   is transformed into a hash that can't be reversed
// - Fleet does NOT set a 'fleet.cattle.io/bundle-path' label on Bundles
// - The only way to get paths from Fleet would be to parse the Bundle's
//   helm.chart field or inspect the actual cloned repo on disk
// - Paused GitRepos still create Bundles, but we can't extract the original
//   paths from them
//
// WHY GITHUB API WORKS WELL:
// - Direct access to repository structure via git trees API
// - Can find all fleet.yaml/fleet.yml files in a single API call
// - Works for public repos without authentication
// - Rate limits are generous (60 req/hour unauthenticated)
// - Can also fetch fleet.yaml content to parse dependsOn relationships
//
// FLEET BUNDLE DETECTION LOGIC (for reference):
// Fleet looks for these files to identify bundle boundaries:
// - fleet.yaml / fleet.yml (primary - defines Fleet bundle)
// - Chart.yaml (Helm chart - becomes a bundle if no fleet.yaml above it)
// - kustomization.yaml (Kustomize - becomes a bundle if no fleet.yaml above it)
// We only look for fleet.yaml/fleet.yml since those are explicit Fleet bundles.
// =============================================================================

// Helper to extract error message from various error types
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'object' && err !== null) {
    const errObj = err as Record<string, unknown>;
    if (errObj.stderr) return String(errObj.stderr);
    if (errObj.message) return String(errObj.message);
    return JSON.stringify(err);
  }
  return String(err);
}

// Path info with dependency data
interface PathInfo {
  path: string;
  dependsOn?: string[];  // Bundle names this path depends on
}

// Parse GitHub URL to get owner/repo
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

// Fetch fleet.yaml (or fleet.yml) content and parse dependsOn
async function fetchFleetYamlDeps(owner: string, repo: string, branch: string, path: string): Promise<string[] | undefined> {
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
      const dependsOnMatch = content.match(/dependsOn:\s*\n((?:\s+-\s*(?:name:\s*)?\S+\s*\n?)+)/);
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

// Fetch available paths from GitHub repo with dependency info
async function fetchGitHubPaths(repoUrl: string, branch?: string): Promise<PathInfo[]> {
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

function App() {
  const [fleetState, setFleetState] = useState<FleetState>({ status: 'checking' });
  const [installing, setInstalling] = useState(false);
  const [gitRepos, setGitRepos] = useState<GitRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);

  // Add repo dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newRepoName, setNewRepoName] = useState('fleet-examples');
  const [newRepoUrl, setNewRepoUrl] = useState('https://github.com/rancher/fleet-examples');
  const [newRepoBranch, setNewRepoBranch] = useState('');
  const [addingRepo, setAddingRepo] = useState(false);
  const [addRepoError, setAddRepoError] = useState<string | null>(null);

  // Cache of available paths per repo URL (use state for re-render, ref for stable access)
  const [repoPathsCache, setRepoPathsCache] = useState<Record<string, PathInfo[]>>({});
  const repoPathsCacheRef = useRef<Record<string, PathInfo[]>>({});
  const loadingRepoPathsRef = useRef<Set<string>>(new Set());
  const [updatingRepo, setUpdatingRepo] = useState<string | null>(null);

  // Track discovery start time for timeout handling (30s)
  const [discoveryStartTimes, setDiscoveryStartTimes] = useState<Record<string, number>>({});
  const [discoveryErrors, setDiscoveryErrors] = useState<Record<string, string>>({});

  // Keep ref in sync with state
  useEffect(() => {
    repoPathsCacheRef.current = repoPathsCache;
  }, [repoPathsCache]);

  const fetchGitRepos = useCallback(async () => {
    setLoadingRepos(true);
    setRepoError(null);
    try {
      const result = await ddClient.extension.host?.cli.exec('kubectl', [
        '--context', KUBE_CONTEXT,
        'get', 'gitrepos', '-n', FLEET_NAMESPACE,
        '-o', 'json',
      ]);

      if (result?.stderr) {
        throw new Error(result.stderr);
      }

      const data = JSON.parse(result?.stdout || '{"items":[]}');
      const repos: GitRepo[] = data.items.map((item: Record<string, unknown>) => {
        const spec = item.spec as Record<string, unknown> || {};
        const status = item.status as Record<string, unknown> || {};
        const metadata = item.metadata as Record<string, unknown> || {};
        const conditions = (status.conditions as Array<Record<string, unknown>>) || [];
        const display = status.display as Record<string, unknown> | undefined;
        const resources = (status.resources as Array<Record<string, unknown>>) || [];

        return {
          name: metadata.name as string,
          repo: spec.repo as string,
          branch: spec.branch as string | undefined,
          paths: spec.paths as string[] | undefined,
          status: {
            ready: conditions.some((c) => c.type === 'Ready' && c.status === 'True'),
            display: display ? {
              state: display.state as string | undefined,
              message: display.message as string | undefined,
              error: display.error as boolean | undefined,
            } : undefined,
            desiredReadyClusters: (status.desiredReadyClusters as number) || 0,
            readyClusters: (status.readyClusters as number) || 0,
            resources: resources.map((r) => ({
              kind: r.kind as string,
              name: r.name as string,
              state: r.state as string,
            })),
            conditions: conditions.map((c) => ({
              type: c.type as string,
              status: c.status as string,
              message: c.message as string | undefined,
            })),
          },
        };
      });

      // Only update state if data actually changed (prevents scroll reset)
      setGitRepos((prevRepos) => {
        const prevJson = JSON.stringify(prevRepos);
        const newJson = JSON.stringify(repos);
        return prevJson === newJson ? prevRepos : repos;
      });

      // Auto-discover paths for new repos (using refs to avoid dependency issues)
      repos.forEach((repo) => {
        if (repoPathsCacheRef.current[repo.repo] === undefined && !loadingRepoPathsRef.current.has(repo.repo)) {
          discoverPathsForRepo(repo.repo, repo.branch);
        }
      });
    } catch (err) {
      const errMsg = getErrorMessage(err);
      if (errMsg.includes('No resources found')) {
        setGitRepos([]);
      } else {
        console.error('Failed to fetch GitRepos:', err);
        setRepoError(errMsg);
      }
    } finally {
      setLoadingRepos(false);
    }
  }, []); // No dependencies - uses refs for mutable data

  // Discover paths for an existing repo and cache them
  const discoverPathsForRepo = useCallback(async (repoUrl: string, branch?: string, isRetry = false) => {
    // Check ref to prevent duplicate requests (unless retry)
    if (!isRetry && (repoPathsCacheRef.current[repoUrl] !== undefined || loadingRepoPathsRef.current.has(repoUrl))) return;

    loadingRepoPathsRef.current.add(repoUrl);

    // Track start time for timeout display
    setDiscoveryStartTimes((prev) => ({ ...prev, [repoUrl]: Date.now() }));
    // Clear any previous error
    setDiscoveryErrors((prev) => {
      const next = { ...prev };
      delete next[repoUrl];
      return next;
    });

    try {
      const paths = await fetchGitHubPaths(repoUrl, branch);
      // Update both ref and state immediately
      repoPathsCacheRef.current[repoUrl] = paths;
      setRepoPathsCache((prev) => ({ ...prev, [repoUrl]: paths }));
      // Clear start time on success
      setDiscoveryStartTimes((prev) => {
        const next = { ...prev };
        delete next[repoUrl];
        return next;
      });
    } catch (err) {
      console.error(`Failed to discover paths for ${repoUrl}:`, err);
      const errorMsg = getErrorMessage(err);
      setDiscoveryErrors((prev) => ({ ...prev, [repoUrl]: errorMsg }));
      // Don't cache empty array on error - allow retry
    } finally {
      loadingRepoPathsRef.current.delete(repoUrl);
    }
  }, []);

  const checkFleetStatus = useCallback(async () => {
    setFleetState({ status: 'checking' });
    try {
      let crdExists = false;
      try {
        const result = await ddClient.extension.host?.cli.exec('kubectl', [
          '--context', KUBE_CONTEXT,
          'get', 'crd', 'gitrepos.fleet.cattle.io',
          '-o', 'jsonpath={.metadata.name}',
        ]);
        crdExists = !result?.stderr && (result?.stdout?.includes('gitrepos.fleet.cattle.io') ?? false);
      } catch (crdErr) {
        const errMsg = getErrorMessage(crdErr);
        if (errMsg.includes('NotFound') || errMsg.includes('not found')) {
          setFleetState({ status: 'not-installed' });
          return;
        }
        throw crdErr;
      }

      if (!crdExists) {
        setFleetState({ status: 'not-installed' });
        return;
      }

      const podResult = await ddClient.extension.host?.cli.exec('kubectl', [
        '--context', KUBE_CONTEXT,
        'get', 'pods', '-n', 'cattle-fleet-system',
        '-l', 'app=fleet-controller',
        '-o', 'jsonpath={.items[0].status.phase}',
      ]);

      if (podResult?.stdout === 'Running') {
        const versionResult = await ddClient.extension.host?.cli.exec('helm', [
          '--kube-context', KUBE_CONTEXT,
          'list', '-n', 'cattle-fleet-system',
          '-f', 'fleet',
          '-o', 'json',
        ]);
        let version = 'unknown';
        try {
          const releases = JSON.parse(versionResult?.stdout || '[]');
          if (releases.length > 0) {
            version = releases[0].app_version || releases[0].chart;
          }
        } catch {
          // Ignore parse errors
        }
        setFleetState({ status: 'running', version });
        fetchGitRepos();
      } else {
        setFleetState({ status: 'not-installed' });
      }
    } catch (err) {
      console.error('Fleet status check error:', err);
      setFleetState({
        status: 'error',
        error: getErrorMessage(err),
      });
    }
  }, [fetchGitRepos]);

  const installFleet = async () => {
    setInstalling(true);
    try {
      await ddClient.extension.host?.cli.exec('helm', [
        '--kube-context', KUBE_CONTEXT,
        'repo', 'add', 'fleet', 'https://rancher.github.io/fleet-helm-charts/',
      ]);

      await ddClient.extension.host?.cli.exec('helm', [
        '--kube-context', KUBE_CONTEXT,
        'repo', 'update',
      ]);

      await ddClient.extension.host?.cli.exec('helm', [
        '--kube-context', KUBE_CONTEXT,
        'install', '--create-namespace', '-n', 'cattle-fleet-system',
        'fleet-crd', 'fleet/fleet-crd',
        '--wait',
      ]);

      await ddClient.extension.host?.cli.exec('helm', [
        '--kube-context', KUBE_CONTEXT,
        'install', '--create-namespace', '-n', 'cattle-fleet-system',
        'fleet', 'fleet/fleet',
        '--wait',
      ]);

      await checkFleetStatus();
    } catch (err) {
      console.error('Fleet install error:', err);
      setFleetState({
        status: 'error',
        error: getErrorMessage(err),
      });
    } finally {
      setInstalling(false);
    }
  };

  // Update GitRepo paths
  const updateGitRepoPaths = async (repo: GitRepo, newPaths: string[]) => {
    setUpdatingRepo(repo.name);
    try {
      const gitRepoYaml = {
        apiVersion: 'fleet.cattle.io/v1alpha1',
        kind: 'GitRepo',
        metadata: {
          name: repo.name,
          namespace: FLEET_NAMESPACE,
        },
        spec: {
          repo: repo.repo,
          ...(repo.branch && { branch: repo.branch }),
          ...(newPaths.length > 0 && { paths: newPaths }),
        },
      };

      const jsonStr = JSON.stringify(gitRepoYaml);
      await ddClient.extension.host?.cli.exec('kubectl', [
        '--apply-json', jsonStr,
        '--context', KUBE_CONTEXT,
      ]);

      await fetchGitRepos();
    } catch (err) {
      console.error('Failed to update GitRepo:', err);
      setRepoError(getErrorMessage(err));
    } finally {
      setUpdatingRepo(null);
    }
  };

  // Toggle a path for an existing repo
  const toggleRepoPath = (repo: GitRepo, path: string) => {
    const currentPaths = repo.paths || [];
    const newPaths = currentPaths.includes(path)
      ? currentPaths.filter((p) => p !== path)
      : [...currentPaths, path];
    updateGitRepoPaths(repo, newPaths);
  };

  const addGitRepo = async () => {
    if (!newRepoName || !newRepoUrl) return;

    setAddingRepo(true);
    setAddRepoError(null);
    try {
      // Create GitRepo with empty paths - user will select paths on the card
      const gitRepoYaml = {
        apiVersion: 'fleet.cattle.io/v1alpha1',
        kind: 'GitRepo',
        metadata: {
          name: newRepoName,
          namespace: FLEET_NAMESPACE,
        },
        spec: {
          repo: newRepoUrl,
          ...(newRepoBranch && { branch: newRepoBranch }),
          // No paths initially - paths are selected on the card after discovery
        },
      };

      const jsonStr = JSON.stringify(gitRepoYaml);
      await ddClient.extension.host?.cli.exec('kubectl', [
        '--apply-json', jsonStr,
        '--context', KUBE_CONTEXT,
      ]);

      // Close dialog and refresh
      setAddDialogOpen(false);
      setNewRepoName('fleet-examples');
      setNewRepoUrl('https://github.com/rancher/fleet-examples');
      setNewRepoBranch('');
      await fetchGitRepos();
    } catch (err) {
      console.error('Failed to add GitRepo:', err);
      setAddRepoError(getErrorMessage(err));
    } finally {
      setAddingRepo(false);
    }
  };

  const deleteGitRepo = async (name: string) => {
    if (!confirm(`Delete GitRepo "${name}"?`)) return;

    try {
      await ddClient.extension.host?.cli.exec('kubectl', [
        '--context', KUBE_CONTEXT,
        'delete', 'gitrepo', name, '-n', FLEET_NAMESPACE,
      ]);
      await fetchGitRepos();
    } catch (err) {
      console.error('Failed to delete GitRepo:', err);
      setRepoError(getErrorMessage(err));
    }
  };

  useEffect(() => {
    checkFleetStatus();
  }, [checkFleetStatus]);

  // Auto-refresh when there are repos that aren't ready yet
  // Use refs to avoid re-creating interval on every gitRepos change
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldRefreshRef = useRef(false);

  // Update the ref when conditions change
  useEffect(() => {
    const hasUnreadyRepos = gitRepos.some((repo) => !repo.status?.ready);
    shouldRefreshRef.current = hasUnreadyRepos && fleetState.status === 'running';
  }, [gitRepos, fleetState.status]);

  // Set up polling interval once
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      if (shouldRefreshRef.current) {
        fetchGitRepos();
      }
    }, 5000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchGitRepos]);

  // Force re-render every 5s when there are active discovery operations (for timeout check)
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const hasActiveDiscovery = Object.keys(discoveryStartTimes).length > 0;
    if (!hasActiveDiscovery) return;

    const timer = setInterval(() => {
      forceUpdate((n) => n + 1);
    }, 5000);

    return () => clearInterval(timer);
  }, [discoveryStartTimes]);

  const renderStatusIcon = () => {
    switch (fleetState.status) {
      case 'checking':
        return <CircularProgress size={24} />;
      case 'running':
        return <CheckCircleIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return null;
    }
  };

  const getRepoStatusChip = (repo: GitRepo) => {
    if (!repo.status) {
      return <Chip label="Unknown" size="small" />;
    }
    if (repo.status.ready) {
      const resourceCount = repo.status.resources?.length || 0;
      return (
        <Chip
          label={`Ready${resourceCount > 0 ? ` (${resourceCount})` : ''}`}
          color="success"
          size="small"
          icon={<CheckCircleIcon />}
        />
      );
    }

    if (repo.status.display?.error) {
      return (
        <Chip
          label="Error"
          color="error"
          size="small"
          icon={<ErrorIcon />}
        />
      );
    }

    const state = repo.status.display?.state || 'Syncing';
    const stateLabels: Record<string, string> = {
      'GitUpdating': 'Cloning...',
      'WaitApplied': 'Applying...',
      'Active': 'Deploying...',
      'Modified': 'Updating...',
    };

    return (
      <Chip
        label={stateLabels[state] || state}
        color="info"
        size="small"
        icon={<SyncIcon sx={{ animation: 'spin 2s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />}
        title={repo.status.display?.message}
      />
    );
  };

  // Render a single GitRepo card
  const renderRepoCard = (repo: GitRepo) => {
    const availablePaths = repoPathsCache[repo.repo] || [];
    const isLoadingPaths = loadingRepoPathsRef.current.has(repo.repo);
    const hasDiscoveredPaths = repoPathsCache[repo.repo] !== undefined;
    const enabledPaths = repo.paths || [];
    const isUpdating = updatingRepo === repo.name;

    // Check for discovery error or timeout
    const discoveryError = discoveryErrors[repo.repo];
    const discoveryStartTime = discoveryStartTimes[repo.repo];
    const isTimedOut = discoveryStartTime && (Date.now() - discoveryStartTime) > 30000;

    // Retry handler
    const handleRetryDiscovery = () => {
      // Clear previous cache/error state for this repo
      setRepoPathsCache((prev) => {
        const next = { ...prev };
        delete next[repo.repo];
        return next;
      });
      delete repoPathsCacheRef.current[repo.repo];
      discoverPathsForRepo(repo.repo, repo.branch, true);
    };

    return (
      <Paper key={repo.name} sx={{ p: 2, mb: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="h6">{repo.name}</Typography>
              {getRepoStatusChip(repo)}
              {isUpdating && <CircularProgress size={16} />}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {repo.repo}
            </Typography>
            {repo.branch && (
              <Typography variant="caption" color="text.secondary">
                Branch: {repo.branch}
              </Typography>
            )}
          </Box>
          <IconButton
            size="small"
            onClick={() => deleteGitRepo(repo.name)}
            title="Delete repository"
            disabled={isUpdating}
          >
            <DeleteIcon />
          </IconButton>
        </Box>

        {/* Error message if any */}
        {repo.status?.display?.error && repo.status.display.message && (
          <Alert severity="error" sx={{ my: 1, fontSize: '0.85rem' }}>
            {repo.status.display.message}
          </Alert>
        )}

        <Divider sx={{ my: 1.5 }} />

        {/* Paths */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle2">
            Paths
          </Typography>
          {isLoadingPaths && <CircularProgress size={12} />}
        </Box>

        {/* Discovery error with retry */}
        {discoveryError && !isLoadingPaths && (
          <Alert
            severity="warning"
            sx={{ mb: 1 }}
            action={
              <Button color="inherit" size="small" onClick={handleRetryDiscovery}>
                Retry
              </Button>
            }
          >
            {discoveryError}
          </Alert>
        )}

        {/* Timeout warning with retry */}
        {isTimedOut && isLoadingPaths && (
          <Alert
            severity="info"
            sx={{ mb: 1 }}
            action={
              <Button color="inherit" size="small" onClick={handleRetryDiscovery}>
                Retry
              </Button>
            }
          >
            Path discovery is taking longer than expected...
          </Alert>
        )}

        {availablePaths.length > 0 ? (
          <FormGroup sx={{ pl: 1 }}>
            {availablePaths.map((pathInfo) => {
              const hasDeps = pathInfo.dependsOn && pathInfo.dependsOn.length > 0;
              return (
                <FormControlLabel
                  key={pathInfo.path}
                  control={
                    <Checkbox
                      checked={enabledPaths.includes(pathInfo.path)}
                      onChange={() => toggleRepoPath(repo, pathInfo.path)}
                      size="small"
                      disabled={isUpdating || hasDeps}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          color: hasDeps ? 'text.disabled' : 'text.primary',
                        }}
                      >
                        {pathInfo.path}
                      </Typography>
                      {hasDeps && (
                        <Typography variant="caption" color="text.disabled">
                          (depends on: {pathInfo.dependsOn!.join(', ')})
                        </Typography>
                      )}
                    </Box>
                  }
                />
              );
            })}
          </FormGroup>
        ) : isLoadingPaths && !isTimedOut ? (
          <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
            Discovering available paths...
          </Typography>
        ) : !hasDiscoveredPaths && !discoveryError ? (
          <Box sx={{ pl: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Click to discover available paths
            </Typography>
            <Button size="small" onClick={() => discoverPathsForRepo(repo.repo, repo.branch, true)}>
              Discover
            </Button>
          </Box>
        ) : hasDiscoveredPaths && availablePaths.length === 0 && !discoveryError ? (
          enabledPaths.length > 0 ? (
            <Box sx={{ pl: 1 }}>
              {enabledPaths.map((path) => (
                <Chip key={path} label={path} size="small" sx={{ mr: 0.5, mb: 0.5, fontFamily: 'monospace' }} />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
              No fleet.yaml files found. Deploying all paths (root).
            </Typography>
          )
        ) : null}

        {/* Resources summary */}
        {repo.status?.resources && repo.status.resources.length > 0 && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Resources ({repo.status.resources.length})
            </Typography>
            <Box sx={{ pl: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {repo.status.resources.map((resource, idx) => (
                <Chip
                  key={idx}
                  label={`${resource.kind}/${resource.name}`}
                  size="small"
                  color={resource.state === 'Ready' ? 'success' : resource.state === 'WaitApplied' ? 'info' : 'default'}
                  variant="outlined"
                />
              ))}
            </Box>
          </>
        )}
      </Paper>
    );
  };

  return (
    <Box sx={{ p: 3, maxWidth: 900, margin: '0 auto' }}>
      <Typography variant="h4" gutterBottom>
        Fleet GitOps
      </Typography>

      {/* Fleet Status Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          {renderStatusIcon()}
          <Typography variant="h6">
            Fleet Status:{' '}
            {fleetState.status === 'checking' && 'Checking...'}
            {fleetState.status === 'running' && `Running (${fleetState.version})`}
            {fleetState.status === 'not-installed' && 'Not Installed'}
            {fleetState.status === 'error' && 'Error'}
          </Typography>
        </Box>

        {fleetState.status === 'error' && fleetState.error && (
          <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
            {fleetState.error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2 }}>
          {fleetState.status === 'not-installed' && (
            <Button
              variant="contained"
              onClick={installFleet}
              disabled={installing}
            >
              {installing ? 'Installing...' : 'Install Fleet'}
            </Button>
          )}

          <Button
            variant="outlined"
            onClick={checkFleetStatus}
            disabled={fleetState.status === 'checking' || installing}
            startIcon={<RefreshIcon />}
          >
            Refresh
          </Button>
        </Box>
      </Paper>

      {/* GitRepo Management Section */}
      {fleetState.status === 'running' && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5">Git Repositories</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={fetchGitRepos}
                disabled={loadingRepos}
                startIcon={<RefreshIcon />}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={() => setAddDialogOpen(true)}
                startIcon={<AddIcon />}
              >
                Add Repository
              </Button>
            </Box>
          </Box>

          {repoError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRepoError(null)}>
              {repoError}
            </Alert>
          )}

          {loadingRepos ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : gitRepos.length === 0 ? (
            <Paper sx={{ p: 3 }}>
              <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
                No repositories configured. Click "Add Repository" to get started.
              </Typography>
            </Paper>
          ) : (
            gitRepos.map((repo) => renderRepoCard(repo))
          )}
        </>
      )}

      {/* Add Repository Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => { setAddDialogOpen(false); setAddRepoError(null); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Git Repository</DialogTitle>
        <DialogContent>
          {addRepoError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setAddRepoError(null)}>
              {addRepoError}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              value={newRepoName}
              onChange={(e) => setNewRepoName(e.target.value)}
              placeholder="my-app"
              helperText="Unique name for this GitRepo resource"
              required
              fullWidth
            />
            <TextField
              label="Repository URL"
              value={newRepoUrl}
              onChange={(e) => setNewRepoUrl(e.target.value)}
              placeholder="https://github.com/rancher/fleet-examples"
              helperText="Git repository URL (HTTPS)"
              required
              fullWidth
            />
            <TextField
              label="Branch"
              value={newRepoBranch}
              onChange={(e) => setNewRepoBranch(e.target.value)}
              placeholder="main"
              helperText="Branch to track (leave empty for default)"
              fullWidth
            />
            <Typography variant="body2" color="text.secondary">
              After adding the repository, available paths will be discovered automatically.
              You can then select which paths to deploy from the repository card.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAddDialogOpen(false); setAddRepoError(null); }}>
            Cancel
          </Button>
          <Button
            onClick={addGitRepo}
            variant="contained"
            disabled={!newRepoName || !newRepoUrl || addingRepo}
          >
            {addingRepo ? 'Adding...' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default App;
