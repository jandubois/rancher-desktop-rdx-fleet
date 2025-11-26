import React, { useState, useEffect, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Collapse from '@mui/material/Collapse';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
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

function App() {
  const [fleetState, setFleetState] = useState<FleetState>({ status: 'checking' });
  const [installing, setInstalling] = useState(false);
  const [gitRepos, setGitRepos] = useState<GitRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);

  // Add repo dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newRepoName, setNewRepoName] = useState('sample');
  const [newRepoUrl, setNewRepoUrl] = useState('https://github.com/rancher/fleet-examples');
  const [newRepoBranch, setNewRepoBranch] = useState('');
  const [newRepoPaths, setNewRepoPaths] = useState('simple');
  const [addingRepo, setAddingRepo] = useState(false);
  const [addRepoError, setAddRepoError] = useState<string | null>(null);
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set());

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

      setGitRepos(repos);
    } catch (err) {
      const errMsg = getErrorMessage(err);
      // No GitRepos found is not an error
      if (errMsg.includes('No resources found')) {
        setGitRepos([]);
      } else {
        console.error('Failed to fetch GitRepos:', err);
        setRepoError(errMsg);
      }
    } finally {
      setLoadingRepos(false);
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
        console.log('kubectl get crd result:', result);
        crdExists = !result?.stderr && (result?.stdout?.includes('gitrepos.fleet.cattle.io') ?? false);
      } catch (crdErr) {
        const errMsg = getErrorMessage(crdErr);
        console.log('CRD check error (expected if not installed):', errMsg);
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

      console.log('kubectl get pods result:', podResult);

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
        // Fetch GitRepos when Fleet is running
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

  const addGitRepo = async () => {
    if (!newRepoName || !newRepoUrl) return;

    setAddingRepo(true);
    setAddRepoError(null);
    try {
      // Build the GitRepo YAML
      const paths = newRepoPaths
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

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

      // Apply using kubectl with --apply-json flag (handled by our wrapper)
      const jsonStr = JSON.stringify(gitRepoYaml);
      await ddClient.extension.host?.cli.exec('kubectl', [
        '--apply-json', jsonStr,
        '--context', KUBE_CONTEXT,
      ]);

      // Close dialog and refresh
      setAddDialogOpen(false);
      setNewRepoName('');
      setNewRepoUrl('');
      setNewRepoBranch('');
      setNewRepoPaths('');
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
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const hasUnreadyRepos = gitRepos.some((repo) => !repo.status?.ready);

    if (hasUnreadyRepos && fleetState.status === 'running') {
      // Poll every 3 seconds while syncing
      refreshIntervalRef.current = setInterval(() => {
        fetchGitRepos();
      }, 3000);
    } else if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [gitRepos, fleetState.status, fetchGitRepos]);

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

  const toggleRepoExpanded = (name: string) => {
    setExpandedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const getRepoStatusChip = (repo: GitRepo) => {
    if (!repo.status) {
      return <Chip label="Unknown" size="small" />;
    }
    if (repo.status.ready) {
      const resourceCount = repo.status.resources?.length || 0;
      return (
        <Chip
          label={`Ready${resourceCount > 0 ? ` (${resourceCount} resources)` : ''}`}
          color="success"
          size="small"
          icon={<CheckCircleIcon />}
        />
      );
    }

    // Check for error state
    if (repo.status.display?.error) {
      return (
        <Chip
          label={repo.status.display.message?.substring(0, 30) || 'Error'}
          color="error"
          size="small"
          icon={<ErrorIcon />}
          title={repo.status.display.message}
        />
      );
    }

    // Show syncing state with spinner
    const state = repo.status.display?.state || 'Syncing';
    const stateLabels: Record<string, string> = {
      'GitUpdating': 'Cloning repo...',
      'WaitApplied': 'Applying resources...',
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
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Git Repositories
            </Typography>
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
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              No repositories configured. Click "Add Repository" to get started.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={40} />
                    <TableCell>Name</TableCell>
                    <TableCell>Repository</TableCell>
                    <TableCell>Branch</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {gitRepos.map((repo) => {
                    const isExpanded = expandedRepos.has(repo.name);
                    const hasResources = (repo.status?.resources?.length || 0) > 0;
                    return (
                      <React.Fragment key={repo.name}>
                        <TableRow>
                          <TableCell>
                            {hasResources && (
                              <IconButton
                                size="small"
                                onClick={() => toggleRepoExpanded(repo.name)}
                              >
                                {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                              </IconButton>
                            )}
                          </TableCell>
                          <TableCell>{repo.name}</TableCell>
                          <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {repo.repo}
                          </TableCell>
                          <TableCell>{repo.branch || 'default'}</TableCell>
                          <TableCell>{getRepoStatusChip(repo)}</TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={() => deleteGitRepo(repo.name)}
                              title="Delete"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                        {hasResources && (
                          <TableRow>
                            <TableCell colSpan={6} sx={{ py: 0, borderBottom: isExpanded ? undefined : 'none' }}>
                              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                <Box sx={{ py: 2, pl: 6 }}>
                                  <Typography variant="subtitle2" gutterBottom>
                                    Deployed Resources
                                  </Typography>
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell>Kind</TableCell>
                                        <TableCell>Name</TableCell>
                                        <TableCell>State</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {repo.status?.resources?.map((resource, idx) => (
                                        <TableRow key={idx}>
                                          <TableCell>{resource.kind}</TableCell>
                                          <TableCell>{resource.name}</TableCell>
                                          <TableCell>
                                            <Chip
                                              label={resource.state}
                                              size="small"
                                              color={resource.state === 'Ready' ? 'success' : resource.state === 'WaitApplied' ? 'info' : 'default'}
                                            />
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Add Repository Dialog */}
      <Dialog open={addDialogOpen} onClose={() => { setAddDialogOpen(false); setAddRepoError(null); }} maxWidth="sm" fullWidth>
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
            <TextField
              label="Paths"
              value={newRepoPaths}
              onChange={(e) => setNewRepoPaths(e.target.value)}
              placeholder="simple, helm/nginx"
              helperText="Comma-separated paths within the repo to deploy"
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
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
