import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { ddClient } from './lib/ddClient';

type FleetStatus = 'checking' | 'not-installed' | 'running' | 'error';

interface FleetState {
  status: FleetStatus;
  version?: string;
  error?: string;
}

function App() {
  const [fleetState, setFleetState] = useState<FleetState>({ status: 'checking' });
  const [installing, setInstalling] = useState(false);

  const checkFleetStatus = async () => {
    setFleetState({ status: 'checking' });
    try {
      // Check if Fleet CRDs exist
      const result = await ddClient.extension.host?.cli.exec('kubectl', [
        'get', 'crd', 'gitrepos.fleet.cattle.io',
        '-o', 'jsonpath={.metadata.name}',
      ]);

      if (result?.stderr) {
        setFleetState({ status: 'not-installed' });
        return;
      }

      // Check Fleet controller status
      const podResult = await ddClient.extension.host?.cli.exec('kubectl', [
        'get', 'pods', '-n', 'cattle-fleet-system',
        '-l', 'app=fleet-controller',
        '-o', 'jsonpath={.items[0].status.phase}',
      ]);

      if (podResult?.stdout === 'Running') {
        // Get Fleet version from helm
        const versionResult = await ddClient.extension.host?.cli.exec('helm', [
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
      } else {
        setFleetState({ status: 'not-installed' });
      }
    } catch (err) {
      setFleetState({
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to check Fleet status',
      });
    }
  };

  const installFleet = async () => {
    setInstalling(true);
    try {
      // Add Fleet helm repo
      await ddClient.extension.host?.cli.exec('helm', [
        'repo', 'add', 'fleet', 'https://rancher.github.io/fleet-helm-charts/',
      ]);

      await ddClient.extension.host?.cli.exec('helm', [
        'repo', 'update',
      ]);

      // Install Fleet CRDs
      await ddClient.extension.host?.cli.exec('helm', [
        'install', '--create-namespace', '-n', 'cattle-fleet-system',
        'fleet-crd', 'fleet/fleet-crd',
        '--wait',
      ]);

      // Install Fleet controller
      await ddClient.extension.host?.cli.exec('helm', [
        'install', '--create-namespace', '-n', 'cattle-fleet-system',
        'fleet', 'fleet/fleet',
        '--wait',
      ]);

      await checkFleetStatus();
    } catch (err) {
      setFleetState({
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to install Fleet',
      });
    } finally {
      setInstalling(false);
    }
  };

  useEffect(() => {
    checkFleetStatus();
  }, []);

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

  return (
    <Box sx={{ p: 3, maxWidth: 800, margin: '0 auto' }}>
      <Typography variant="h4" gutterBottom>
        Fleet GitOps
      </Typography>

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
          <Alert severity="error" sx={{ mb: 2 }}>
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
          >
            Refresh Status
          </Button>
        </Box>
      </Paper>

      {fleetState.status === 'running' && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Git Repositories
          </Typography>
          <Typography color="text.secondary">
            No repositories configured yet. GitRepo management coming soon.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

export default App;
