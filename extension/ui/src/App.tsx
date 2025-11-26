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

// Parse GitHub URL to get owner/repo
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

// Fetch available paths from GitHub repo
async function fetchGitHubPaths(repoUrl: string, branch?: string): Promise<string[]> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    throw new Error('Only GitHub repositories are supported for path discovery');
  }

  const branches = branch ? [branch] : ['master', 'main'];

  for (const b of branches) {
    const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${b}?recursive=1`;
    const response = await fetch(apiUrl);

    if (response.ok) {
      const data = await response.json();
      const paths = data.tree
        .filter((item: { path: string; type: string }) =>
          item.type === 'blob' && item.path.endsWith('fleet.yaml'))
        .map((item: { path: string }) => {
          const parts = item.path.split('/');
          parts.pop();
          return parts.join('/') || '.';
        })
        .filter((path: string) => path !== '.')
        .sort();
      return paths;
    }
  }

  throw new Error('Repository not found or not accessible');
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

  // Path discovery state (for add dialog and existing repos)
  const [discoveredPaths, setDiscoveredPaths] = useState<string[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [discoveringPaths, setDiscoveringPaths] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  // Cache of available paths per repo URL
  const [repoPathsCache, setRepoPathsCache] = useState<Record<string, string[]>>({});
  const [loadingRepoPaths, setLoadingRepoPaths] = useState<Set<string>>(new Set());
  const [updatingRepo, setUpdatingRepo] = useState<string | null>(null);

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
        if (prevJson === newJson) {
          return prevRepos;
        }
        // Auto-discover paths for new repos
        repos.forEach((repo) => {
          if (!repoPathsCache[repo.repo] && !loadingRepoPaths.has(repo.repo)) {
            discoverPathsForRepo(repo.repo, repo.branch);
          }
        });
        return repos;
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
  }, [repoPathsCache, loadingRepoPaths]);

  // Discover paths for an existing repo and cache them
  const discoverPathsForRepo = async (repoUrl: string, branch?: string) => {
    if (repoPathsCache[repoUrl] || loadingRepoPaths.has(repoUrl)) return;

    setLoadingRepoPaths((prev) => new Set(prev).add(repoUrl));
    try {
      const paths = await fetchGitHubPaths(repoUrl, branch);
      setRepoPathsCache((prev) => ({ ...prev, [repoUrl]: paths }));
    } catch (err) {
      console.error(`Failed to discover paths for ${repoUrl}:`, err);
      // Cache empty array to prevent retrying
      setRepoPathsCache((prev) => ({ ...prev, [repoUrl]: [] }));
    } finally {
      setLoadingRepoPaths((prev) => {
        const next = new Set(prev);
        next.delete(repoUrl);
        return next;
      });
    }
  };

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
      const paths = Array.from(selectedPaths);

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
          ...(paths.length > 0 && { paths }),
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
      setDiscoveredPaths([]);
      setSelectedPaths(new Set());
      setDiscoveryError(null);
      await fetchGitRepos();
    } catch (err) {
      console.error('Failed to add GitRepo:', err);
      setAddRepoError(getErrorMessage(err));
    } finally {
      setAddingRepo(false);
    }
  };

  // Discover paths for add dialog
  const discoverPaths = async () => {
    if (!newRepoUrl) return;

    setDiscoveringPaths(true);
    setDiscoveryError(null);
    setDiscoveredPaths([]);
    setSelectedPaths(new Set());

    try {
      const paths = await fetchGitHubPaths(newRepoUrl, newRepoBranch || undefined);
      if (paths.length === 0) {
        setDiscoveryError('No fleet.yaml files found in this repository');
      } else {
        setDiscoveredPaths(paths);
      }
    } catch (err) {
      console.error('Path discovery error:', err);
      setDiscoveryError(getErrorMessage(err));
    } finally {
      setDiscoveringPaths(false);
    }
  };

  const togglePathSelection = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
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
    const isLoadingPaths = loadingRepoPaths.has(repo.repo);
    const enabledPaths = repo.paths || [];
    const isUpdating = updatingRepo === repo.name;

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
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Paths {isLoadingPaths && <CircularProgress size={12} sx={{ ml: 1 }} />}
        </Typography>

        {availablePaths.length > 0 ? (
          <FormGroup sx={{ pl: 1 }}>
            {availablePaths.map((path) => (
              <FormControlLabel
                key={path}
                control={
                  <Checkbox
                    checked={enabledPaths.includes(path)}
                    onChange={() => toggleRepoPath(repo, path)}
                    size="small"
                    disabled={isUpdating}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {path}
                  </Typography>
                }
              />
            ))}
          </FormGroup>
        ) : isLoadingPaths ? (
          <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
            Discovering available paths...
          </Typography>
        ) : enabledPaths.length > 0 ? (
          <Box sx={{ pl: 1 }}>
            {enabledPaths.map((path) => (
              <Chip key={path} label={path} size="small" sx={{ mr: 0.5, mb: 0.5, fontFamily: 'monospace' }} />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
            All paths (root)
          </Typography>
        )}

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
        onClose={() => { setAddDialogOpen(false); setAddRepoError(null); setDiscoveredPaths([]); setSelectedPaths(new Set()); }}
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
              onChange={(e) => { setNewRepoUrl(e.target.value); setDiscoveredPaths([]); setSelectedPaths(new Set()); }}
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

            {/* Path Discovery Section */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2">Paths</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={discoverPaths}
                  disabled={!newRepoUrl || discoveringPaths}
                >
                  {discoveringPaths ? 'Discovering...' : 'Discover Paths'}
                </Button>
              </Box>

              {discoveryError && (
                <Alert severity="warning" sx={{ mb: 1 }} onClose={() => setDiscoveryError(null)}>
                  {discoveryError}
                </Alert>
              )}

              {discoveredPaths.length > 0 && (
                <Paper variant="outlined" sx={{ p: 1, maxHeight: 200, overflow: 'auto' }}>
                  <FormGroup>
                    {discoveredPaths.map((path) => (
                      <FormControlLabel
                        key={path}
                        control={
                          <Checkbox
                            checked={selectedPaths.has(path)}
                            onChange={() => togglePathSelection(path)}
                            size="small"
                          />
                        }
                        label={<Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{path}</Typography>}
                      />
                    ))}
                  </FormGroup>
                </Paper>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAddDialogOpen(false); setDiscoveredPaths([]); setSelectedPaths(new Set()); setDiscoveryError(null); }}>
            Cancel
          </Button>
          <Button
            onClick={addGitRepo}
            variant="contained"
            disabled={!newRepoName || !newRepoUrl || addingRepo || selectedPaths.size === 0}
          >
            {addingRepo ? 'Adding...' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default App;
