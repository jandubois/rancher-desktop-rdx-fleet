import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import BugReportIcon from '@mui/icons-material/BugReport';
import DownloadIcon from '@mui/icons-material/Download';
import { createDockerDesktopClient } from '@docker/extension-api-client';

// Initialize the Docker Desktop client
const ddClient = createDockerDesktopClient();

interface CommandResult {
  stdout: string;
  stderr: string;
  error?: string;
}

interface PropertyInfo {
  name: string;
  type: string;
  value: string;
  enumerable: boolean;
}

// Helper to safely stringify values
function safeStringify(value: unknown, depth = 0): string {
  if (depth > 3) return '[Max depth reached]';
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return `[Function: ${value.name || 'anonymous'}]`;
  if (typeof value === 'symbol') return value.toString();
  if (typeof value === 'object') {
    try {
      if (Array.isArray(value)) {
        return `[Array(${value.length})]`;
      }
      const keys = Object.keys(value);
      if (keys.length === 0) return '{}';
      return `{${keys.slice(0, 5).join(', ')}${keys.length > 5 ? ', ...' : ''}}`;
    } catch {
      return '[Object]';
    }
  }
  return String(value);
}

// Recursively get all properties including inherited ones
function getAllProperties(obj: unknown, prefix = '', depth = 0): PropertyInfo[] {
  if (depth > 4 || !obj || typeof obj !== 'object') return [];

  const properties: PropertyInfo[] = [];
  const seen = new Set<string>();

  // Get own properties
  const descriptors = Object.getOwnPropertyDescriptors(obj);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (seen.has(key)) continue;
    seen.add(key);

    const fullName = prefix ? `${prefix}.${key}` : key;
    let value: unknown;
    let type: string;

    try {
      value = (obj as Record<string, unknown>)[key];
      type = typeof value;
      if (value === null) type = 'null';
      else if (Array.isArray(value)) type = 'array';
    } catch (e) {
      value = '[Error accessing property]';
      type = 'error';
    }

    properties.push({
      name: fullName,
      type,
      value: safeStringify(value, depth),
      enumerable: descriptor.enumerable ?? false,
    });

    // Recurse into objects (but not functions or arrays)
    if (value && typeof value === 'object' && !Array.isArray(value) && type !== 'null') {
      properties.push(...getAllProperties(value, fullName, depth + 1));
    }
  }

  return properties;
}

// Component to display a collapsible code block
function CodeBlock({ content, maxHeight = 400 }: { content: string; maxHeight?: number }) {
  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: '#1a1a1a',
        maxHeight,
        overflow: 'auto',
        fontFamily: 'monospace',
        fontSize: '0.85rem',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
      {content}
    </Paper>
  );
}

// Panel for ddClient inspection
function DdClientPanel() {
  const [properties, setProperties] = useState<PropertyInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    try {
      const props = getAllProperties(ddClient, 'ddClient');
      setProperties(props);
    } catch (e) {
      console.error('Error inspecting ddClient:', e);
    }
    setLoading(false);
  }, []);

  if (loading) return <CircularProgress />;

  // Group by top-level property
  const grouped = properties.reduce((acc, prop) => {
    const topLevel = prop.name.split('.')[1] || 'root';
    if (!acc[topLevel]) acc[topLevel] = [];
    acc[topLevel].push(prop);
    return acc;
  }, {} as Record<string, PropertyInfo[]>);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        All properties and methods available on the ddClient object.
        This helps identify what APIs are actually exposed by Rancher Desktop.
      </Typography>

      {Object.entries(grouped).map(([group, props]) => (
        <Accordion key={group} defaultExpanded={group === 'extension'}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight="bold">ddClient.{group}</Typography>
            <Chip label={props.length} size="small" sx={{ ml: 1 }} />
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Property</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {props.map((prop) => (
                    <TableRow key={prop.name}>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {prop.name}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={prop.type}
                          size="small"
                          color={prop.type === 'function' ? 'primary' : 'default'}
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {prop.value}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      ))}

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" gutterBottom>Raw ddClient inspection:</Typography>
      <CodeBlock content={JSON.stringify(
        {
          'ddClient.extension.image': (ddClient.extension as { image?: string })?.image,
          'typeof ddClient.extension': typeof ddClient.extension,
          'typeof ddClient.docker': typeof ddClient.docker,
          'typeof ddClient.desktopUI': typeof ddClient.desktopUI,
          'typeof ddClient.extension.host': typeof ddClient.extension?.host,
          'typeof ddClient.extension.vm': typeof ddClient.extension?.vm,
        },
        null,
        2
      )} />
    </Box>
  );
}

// Panel for container/webview environment
function ContainerEnvPanel() {
  const [vmResult, setVmResult] = useState<CommandResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collect browser/webview environment info (available immediately)
  const webviewInfo = {
    'window.location.href': window.location.href,
    'window.location.origin': window.location.origin,
    'window.location.protocol': window.location.protocol,
    'window.location.hostname': window.location.hostname,
    'window.location.port': window.location.port,
    'window.location.pathname': window.location.pathname,
    'navigator.userAgent': navigator.userAgent,
    'navigator.platform': navigator.platform,
    'navigator.language': navigator.language,
    'navigator.languages': navigator.languages?.join(', '),
    'navigator.onLine': navigator.onLine,
    'navigator.hardwareConcurrency': navigator.hardwareConcurrency,
    'screen.width': screen.width,
    'screen.height': screen.height,
    'screen.colorDepth': screen.colorDepth,
    'window.devicePixelRatio': window.devicePixelRatio,
    'document.referrer': document.referrer || '(empty)',
    'document.title': document.title,
  };

  const runVmInspection = useCallback(async () => {
    setLoading(true);
    setError(null);

    const vm = ddClient.extension?.vm;
    if (!vm) {
      setError('ddClient.extension.vm is not available - cannot exec into extension backend');
      setLoading(false);
      return;
    }

    try {
      const inspectScript = `
echo "=== EXTENSION VM/CONTAINER ENVIRONMENT ==="
echo ""
echo "--- Basic Info ---"
echo "Hostname: $(hostname)"
echo "Username: $(whoami 2>/dev/null || echo unknown)"
echo "User ID: $(id 2>/dev/null || echo unknown)"
echo "PWD: $(pwd)"
echo ""
echo "--- System Info ---"
echo "Uname: $(uname -a 2>/dev/null || echo unknown)"
cat /etc/os-release 2>/dev/null || echo "No /etc/os-release"
echo ""
echo "--- Filesystem Structure ---"
echo "Root directory:"
ls -la / 2>/dev/null || echo "Cannot list /"
echo ""
echo "UI directory:"
ls -la /ui 2>/dev/null || echo "/ui not found"
echo ""
echo "Host binaries directory:"
ls -la /host 2>/dev/null || echo "/host not found"
ls -la /host/linux 2>/dev/null || ls -la /host/darwin 2>/dev/null || echo "No host binaries found"
echo ""
echo "--- Environment Variables ---"
env | sort
echo ""
echo "=== END VM DEBUG ==="
`;

      // Try using vm.cli.exec if available
      if (vm.cli?.exec) {
        const execResult = await vm.cli.exec('/bin/sh', ['-c', inspectScript]);
        setVmResult({
          stdout: execResult.stdout,
          stderr: execResult.stderr,
        });
      } else {
        setError('ddClient.extension.vm.cli.exec is not available');
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      setVmResult({ stdout: '', stderr: '', error: errorMsg });
    }

    setLoading(false);
  }, []);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Environment of the running extension. The webview info is from JavaScript,
        while the VM info comes from ddClient.extension.vm.cli.exec().
      </Typography>

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">Webview Environment (JavaScript)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer component={Paper} sx={{ bgcolor: '#1a1a1a' }}>
            <Table size="small">
              <TableBody>
                {Object.entries(webviewInfo).map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#90caf9' }}>
                      {key}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {String(value)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">Extension VM/Backend (ddClient.extension.vm)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
            onClick={runVmInspection}
            disabled={loading}
            sx={{ mb: 2 }}
          >
            {loading ? 'Inspecting...' : 'Run VM Inspection'}
          </Button>

          {error && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {error.includes('does not have containers')
                  ? 'No Backend Container'
                  : 'VM Inspection Result'}
              </Typography>
              <Typography variant="body2">
                {error}
              </Typography>
              {error.includes('does not have containers') && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  This extension does not define a backend service (no compose.yaml).
                  Extensions can optionally include a backend container for server-side logic,
                  but this debug extension only uses the UI (webview) and host binaries.
                  The ddClient.extension.vm API is only available when a backend service is defined.
                </Typography>
              )}
            </Alert>
          )}

          {vmResult && (
            <CodeBlock content={vmResult.stdout || vmResult.stderr || vmResult.error || 'No output'} maxHeight={400} />
          )}

          {!vmResult && !error && (
            <Typography variant="body2" color="text.secondary">
              Click the button to inspect the extension VM environment.
              This uses ddClient.extension.vm.cli.exec() to run commands in the extension backend.
              In Docker Desktop, extensions run in containers. Rancher Desktop may differ.
            </Typography>
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}

// Panel for backend service API
function BackendServicePanel() {
  const [results, setResults] = useState<Record<string, { status: string; data: unknown; error?: string }>>({});
  const [loading, setLoading] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<'unknown' | 'available' | 'unavailable'>('unknown');
  const [vmDiagnostics, setVmDiagnostics] = useState<string>('');
  const [httpStatus, setHttpStatus] = useState<'unknown' | 'available' | 'unavailable'>('unknown');

  const endpoints = [
    { path: '/', name: 'API Discovery', description: 'List all available endpoints' },
    { path: '/health', name: 'Health Check', description: 'Service health and uptime' },
    { path: '/info', name: 'Container Info', description: 'Hostname, PID, user, Go runtime info' },
    { path: '/env', name: 'Environment Variables', description: 'All environment variables in the container' },
    { path: '/system', name: 'System Info', description: 'OS release, kernel, memory, CPU info' },
    { path: '/filesystem?path=/', name: 'Filesystem (root)', description: 'Root directory contents and mounts' },
    { path: '/filesystem?path=/ui', name: 'Filesystem (/ui)', description: 'UI directory contents' },
    { path: '/processes', name: 'Processes', description: 'Running processes in the container' },
    { path: '/network', name: 'Network', description: 'Network interfaces, DNS, hosts' },
  ];

  // Check backend availability on mount
  useEffect(() => {
    const checkBackend = async () => {
      // Diagnostic info about vm object
      const vm = ddClient.extension?.vm;
      const vmInfo: string[] = [];
      vmInfo.push(`ddClient.extension.vm exists: ${!!vm}`);
      if (vm) {
        vmInfo.push(`vm.service exists: ${!!vm.service}`);
        vmInfo.push(`vm.cli exists: ${!!vm.cli}`);
        if (vm.service) {
          vmInfo.push(`vm.service.get exists: ${typeof vm.service.get}`);
          vmInfo.push(`vm.service.post exists: ${typeof vm.service.post}`);
        }
        vmInfo.push(`vm keys: ${Object.keys(vm).join(', ')}`);
      }
      setVmDiagnostics(vmInfo.join('\n'));

      // Try vm.service API
      if (!vm?.service) {
        setBackendStatus('unavailable');
      } else {
        try {
          await vm.service.get('/health');
          setBackendStatus('available');
        } catch {
          setBackendStatus('unavailable');
        }
      }

      // Try direct HTTP fetch to localhost:8080
      try {
        const resp = await fetch('http://localhost:8080/health');
        if (resp.ok) {
          setHttpStatus('available');
        } else {
          setHttpStatus('unavailable');
        }
      } catch {
        setHttpStatus('unavailable');
      }
    };
    checkBackend();
  }, []);

  const queryEndpoint = useCallback(async (path: string) => {
    setLoading(true);
    setSelectedEndpoint(path);

    // Try vm.service first, then fall back to HTTP
    const vm = ddClient.extension?.vm;
    if (vm?.service) {
      try {
        const result = await vm.service.get(path);
        setResults(prev => ({
          ...prev,
          [path]: { status: 'ok', data: result }
        }));
        setBackendStatus('available');
        setLoading(false);
        return;
      } catch (e) {
        // Continue to try HTTP fallback
        console.log('vm.service failed, trying HTTP fallback:', e);
      }
    }

    // Try direct HTTP fetch
    try {
      const resp = await fetch(`http://localhost:8080${path}`);
      const data = await resp.json();
      setResults(prev => ({
        ...prev,
        [path]: { status: 'ok', data, error: 'via HTTP fallback' }
      }));
      setHttpStatus('available');
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : JSON.stringify(e);
      setResults(prev => ({
        ...prev,
        [path]: { status: 'error', data: null, error: `vm.service unavailable, HTTP fallback failed: ${errorMsg}` }
      }));
    }

    setLoading(false);
  }, []);

  const queryAllEndpoints = useCallback(async () => {
    setLoading(true);

    for (const ep of endpoints) {
      // Try vm.service first, then fall back to HTTP
      const vm = ddClient.extension?.vm;
      let success = false;

      if (vm?.service) {
        try {
          const result = await vm.service.get(ep.path);
          setResults(prev => ({
            ...prev,
            [ep.path]: { status: 'ok', data: result }
          }));
          setBackendStatus('available');
          success = true;
        } catch {
          // Continue to HTTP fallback
        }
      }

      if (!success) {
        // Try direct HTTP fetch
        try {
          const resp = await fetch(`http://localhost:8080${ep.path}`);
          const data = await resp.json();
          setResults(prev => ({
            ...prev,
            [ep.path]: { status: 'ok', data, error: 'via HTTP' }
          }));
          setHttpStatus('available');
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : JSON.stringify(e);
          setResults(prev => ({
            ...prev,
            [ep.path]: { status: 'error', data: null, error: errorMsg }
          }));
        }
      }
    }

    // Auto-select /info endpoint to show container details
    setSelectedEndpoint('/info');
    setLoading(false);
  }, []);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Query the backend service running in the extension container via ddClient.extension.vm.service.
        The backend exposes REST API endpoints for inspecting the container runtime environment.
      </Typography>

      {/* VM Diagnostics */}
      <Paper sx={{ p: 1, mb: 2, bgcolor: '#1a1a1a' }}>
        <Typography variant="caption" color="text.secondary">VM Object Diagnostics:</Typography>
        <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', m: 0, whiteSpace: 'pre-wrap' }}>
          {vmDiagnostics || 'Loading...'}
        </Typography>
      </Paper>

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
          onClick={queryAllEndpoints}
          disabled={loading}
        >
          Query All Endpoints
        </Button>
        <Chip
          label={`vm.service: ${backendStatus}`}
          color={backendStatus === 'available' ? 'success' : backendStatus === 'unavailable' ? 'error' : 'default'}
          size="small"
        />
        <Chip
          label={`HTTP :8080: ${httpStatus}`}
          color={httpStatus === 'available' ? 'success' : httpStatus === 'unavailable' ? 'error' : 'default'}
          size="small"
        />
      </Box>

      {backendStatus === 'unavailable' && httpStatus === 'available' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>ddClient.extension.vm.service</strong> is not available, but HTTP fallback on port 8080 works.
            Queries will use direct HTTP fetch to localhost:8080.
          </Typography>
        </Alert>
      )}

      {backendStatus === 'unavailable' && httpStatus === 'unavailable' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Neither <code>vm.service</code> nor HTTP fallback is available.
            The backend container may not be running or port 8080 may not be exposed.
          </Typography>
        </Alert>
      )}

      <TableContainer component={Paper} sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Endpoint</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {endpoints.map((ep) => {
              const result = results[ep.path];
              return (
                <TableRow
                  key={ep.path}
                  selected={selectedEndpoint === ep.path}
                  hover
                  onClick={() => result && setSelectedEndpoint(ep.path)}
                  sx={{ cursor: result ? 'pointer' : 'default' }}
                >
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {ep.path}
                  </TableCell>
                  <TableCell>{ep.description}</TableCell>
                  <TableCell>
                    {!result ? (
                      <Chip label="Not queried" size="small" />
                    ) : result.status === 'ok' ? (
                      <Chip label="OK" color="success" size="small" />
                    ) : (
                      <Chip label="ERROR" color="error" size="small" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      onClick={(e) => { e.stopPropagation(); queryEndpoint(ep.path); }}
                      disabled={loading}
                    >
                      Query
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {selectedEndpoint && results[selectedEndpoint] && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Response from {selectedEndpoint}:
          </Typography>
          {results[selectedEndpoint].status === 'error' ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {results[selectedEndpoint].error}
            </Alert>
          ) : (
            <CodeBlock
              content={JSON.stringify(results[selectedEndpoint].data, null, 2)}
              maxHeight={500}
            />
          )}
        </Box>
      )}
    </Box>
  );
}

// Panel for host binary environment
function HostBinaryEnvPanel() {
  const [result, setResult] = useState<CommandResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runHostInspection = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const host = ddClient.extension?.host;
      if (!host) {
        setError('ddClient.extension.host is not available');
        setLoading(false);
        return;
      }

      // Use our debug-env host binary
      const execResult = await host.cli.exec('debug-env', ['--test-arg', 'hello']);

      setResult({
        stdout: execResult.stdout,
        stderr: execResult.stderr,
      });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      setResult({ stdout: '', stderr: '', error: errorMsg });
    }

    setLoading(false);
  }, []);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Environment as seen by host binary wrappers when called via ddClient.extension.host.cli.exec().
        This reveals what environment variables and context Rancher Desktop provides to host binaries.
      </Typography>

      <Button
        variant="contained"
        startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
        onClick={runHostInspection}
        disabled={loading}
        sx={{ mb: 2 }}
      >
        {loading ? 'Inspecting...' : 'Run Host Binary Inspection'}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {result && (
        <CodeBlock content={result.stdout || result.stderr || result.error || 'No output'} maxHeight={600} />
      )}
    </Box>
  );
}

// Panel for testing all host binaries
function HostBinaryStressTestPanel() {
  const [results, setResults] = useState<Record<string, CommandResult>>({});
  const [loading, setLoading] = useState(false);

  // Binary configs with appropriate version check arguments
  const binaryConfigs: Array<{ name: string; args: string[] }> = [
    { name: 'kubectl', args: ['version', '--client', '-o', 'json'] },
    { name: 'helm', args: ['version', '--short'] },
    { name: 'rdctl', args: ['version'] },
    { name: 'docker', args: ['version', '--format', '{{.Client.Version}}'] },
    { name: 'debug-env', args: [] },
  ];

  const runStressTest = useCallback(async () => {
    setLoading(true);
    const newResults: Record<string, CommandResult> = {};

    const host = ddClient.extension?.host;
    if (!host) {
      binaryConfigs.forEach(({ name }) => {
        newResults[name] = { stdout: '', stderr: '', error: 'ddClient.extension.host not available' };
      });
      setResults(newResults);
      setLoading(false);
      return;
    }

    for (const { name, args } of binaryConfigs) {
      try {
        const execResult = await host.cli.exec(name, args);
        newResults[name] = {
          stdout: execResult.stdout,
          stderr: execResult.stderr,
        };
      } catch (e) {
        // Handle various error formats - RD may throw non-Error objects
        let errorMsg: string;
        if (e instanceof Error) {
          errorMsg = e.message;
        } else if (typeof e === 'object' && e !== null) {
          errorMsg = JSON.stringify(e);
        } else {
          errorMsg = String(e);
        }
        newResults[name] = {
          stdout: '',
          stderr: '',
          error: errorMsg,
        };
      }
    }

    setResults(newResults);
    setLoading(false);
  }, []);

  const failedCount = Object.values(results).filter(r => r.error).length;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Tests all {binaryConfigs.length} host binaries defined in metadata.json.
        This helps identify the binary limit bug (typically fails after 2-3 binaries).
      </Typography>

      <Button
        variant="contained"
        color={failedCount > 0 ? 'error' : 'primary'}
        startIcon={loading ? <CircularProgress size={20} /> : <BugReportIcon />}
        onClick={runStressTest}
        disabled={loading}
        sx={{ mb: 2 }}
      >
        {loading ? 'Testing...' : `Test All ${binaryConfigs.length} Binaries`}
      </Button>

      {failedCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {failedCount} of {binaryConfigs.length} binaries failed. This may indicate the host binary limit bug.
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Binary</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Output / Error</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {binaryConfigs.map(({ name }) => {
              const result = results[name];
              const hasError = result?.error;

              return (
                <TableRow key={name}>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{name}</TableCell>
                  <TableCell>
                    {!result ? (
                      <Chip label="Not tested" size="small" />
                    ) : hasError ? (
                      <Chip label="FAILED" color="error" size="small" />
                    ) : (
                      <Chip label="OK" color="success" size="small" />
                    )}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: 400 }}>
                    {result?.error || result?.stdout?.slice(0, 200) || result?.stderr?.slice(0, 200) || '-'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// Panel for RD tools inventory
function RdToolsPanel() {
  const [result, setResult] = useState<CommandResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runToolsCheck = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const host = ddClient.extension?.host;
      if (!host) {
        setError('ddClient.extension.host is not available');
        setLoading(false);
        return;
      }

      // Use kubectl to run a version command, but we really want the debug-env output
      // which includes the ~/.rd/bin listing
      const execResult = await host.cli.exec('debug-env', []);

      // Parse just the RD bin directory section
      const output = execResult.stdout;
      const rdBinMatch = output.match(/--- RD Bin Directory ---\n([\s\S]*?)(?=\n---|\n===)/);

      setResult({
        stdout: rdBinMatch ? rdBinMatch[1] : output,
        stderr: execResult.stderr,
      });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
    }

    setLoading(false);
  }, []);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Lists all tools available in ~/.rd/bin/ (Rancher Desktop's bundled CLI tools).
      </Typography>

      <Button
        variant="contained"
        startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
        onClick={runToolsCheck}
        disabled={loading}
        sx={{ mb: 2 }}
      >
        {loading ? 'Loading...' : 'List RD Tools'}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {result && (
        <CodeBlock content={result.stdout || result.stderr || 'No output'} />
      )}
    </Box>
  );
}

// Panel for Kubernetes context
function KubernetesPanel() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runK8sCheck = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const host = ddClient.extension?.host;
      if (!host) {
        setError('ddClient.extension.host is not available');
        setLoading(false);
        return;
      }

      const outputs: string[] = [];

      // Current context
      try {
        const ctx = await host.cli.exec('kubectl', ['config', 'current-context']);
        outputs.push(`Current Context: ${ctx.stdout.trim()}`);
      } catch (e) {
        outputs.push(`Current Context: Error - ${e instanceof Error ? e.message : e}`);
      }

      // All contexts
      try {
        const contexts = await host.cli.exec('kubectl', ['config', 'get-contexts']);
        outputs.push(`\nAll Contexts:\n${contexts.stdout}`);
      } catch (e) {
        outputs.push(`\nAll Contexts: Error - ${e instanceof Error ? e.message : e}`);
      }

      // Cluster info
      try {
        const info = await host.cli.exec('kubectl', ['cluster-info']);
        outputs.push(`\nCluster Info:\n${info.stdout}`);
      } catch (e) {
        outputs.push(`\nCluster Info: Error - ${e instanceof Error ? e.message : e}`);
      }

      setResult(outputs.join('\n'));
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
    }

    setLoading(false);
  }, []);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Kubernetes context and cluster information.
      </Typography>

      <Button
        variant="contained"
        startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
        onClick={runK8sCheck}
        disabled={loading}
        sx={{ mb: 2 }}
      >
        {loading ? 'Loading...' : 'Check Kubernetes'}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {result && (
        <CodeBlock content={result} />
      )}
    </Box>
  );
}

// Panel for testing additional SDK methods
function SdkMethodsPanel() {
  const [results, setResults] = useState<Record<string, { status: string; output: string }>>({});
  const [loading, setLoading] = useState(false);

  const runSdkTests = useCallback(async () => {
    setLoading(true);
    const newResults: Record<string, { status: string; output: string }> = {};

    // Test ddClient.docker.listContainers
    try {
      const containers = await ddClient.docker.listContainers() as Array<{ Names?: string[] }>;
      newResults['docker.listContainers()'] = {
        status: 'OK',
        output: `Found ${containers.length} containers: ${containers.slice(0, 3).map((c) => c.Names?.[0] || 'unnamed').join(', ')}${containers.length > 3 ? '...' : ''}`,
      };
    } catch (e) {
      newResults['docker.listContainers()'] = {
        status: 'FAILED',
        output: e instanceof Error ? e.message : JSON.stringify(e),
      };
    }

    // Test ddClient.docker.listImages
    try {
      const images = await ddClient.docker.listImages() as unknown[];
      newResults['docker.listImages()'] = {
        status: 'OK',
        output: `Found ${images.length} images`,
      };
    } catch (e) {
      newResults['docker.listImages()'] = {
        status: 'FAILED',
        output: e instanceof Error ? e.message : JSON.stringify(e),
      };
    }

    // Test ddClient.desktopUI.toast (if available)
    const toastObj = ddClient.desktopUI?.toast;
    try {
      if (typeof toastObj?.success === 'function') {
        await toastObj.success('SDK Test: Toast success works!');
        newResults['desktopUI.toast.success()'] = {
          status: 'OK',
          output: 'Toast shown (check UI)',
        };
      } else {
        newResults['desktopUI.toast.success()'] = {
          status: 'N/A',
          output: 'Method not available',
        };
      }
    } catch (e) {
      newResults['desktopUI.toast.success()'] = {
        status: 'FAILED',
        output: e instanceof Error ? e.message : JSON.stringify(e),
      };
    }

    // Test ddClient.desktopUI.toast.warning
    try {
      if (typeof toastObj?.warning === 'function') {
        await toastObj.warning('SDK Test: Toast warning works!');
        newResults['desktopUI.toast.warning()'] = {
          status: 'OK',
          output: 'Toast shown (check UI)',
        };
      } else {
        newResults['desktopUI.toast.warning()'] = {
          status: 'N/A',
          output: 'Method not available',
        };
      }
    } catch (e) {
      newResults['desktopUI.toast.warning()'] = {
        status: 'FAILED',
        output: e instanceof Error ? e.message : JSON.stringify(e),
      };
    }

    // Check what's available on desktopUI
    try {
      const desktopUI = ddClient.desktopUI;
      const availableMethods: string[] = [];
      if (desktopUI) {
        for (const key of Object.keys(desktopUI)) {
          availableMethods.push(key);
        }
      }
      newResults['desktopUI (available keys)'] = {
        status: 'INFO',
        output: availableMethods.length > 0 ? availableMethods.join(', ') : 'No keys found',
      };
    } catch (e) {
      newResults['desktopUI (available keys)'] = {
        status: 'FAILED',
        output: e instanceof Error ? e.message : JSON.stringify(e),
      };
    }

    // Check extension.id and extension.version
    try {
      const ext = ddClient.extension as unknown as Record<string, unknown>;
      newResults['extension.id'] = {
        status: ext?.id ? 'OK' : 'MISSING',
        output: String(ext?.id ?? 'undefined'),
      };
      newResults['extension.version'] = {
        status: ext?.version ? 'OK' : 'MISSING',
        output: String(ext?.version ?? 'undefined'),
      };
      newResults['extension.image'] = {
        status: ext?.image ? (String(ext.image).includes(':') ? 'OK' : 'BROKEN') : 'MISSING',
        output: String(ext?.image ?? 'undefined') + (ext?.image && !String(ext.image).includes(':') ? ' (missing tag!)' : ''),
      };
    } catch (e) {
      newResults['extension properties'] = {
        status: 'FAILED',
        output: e instanceof Error ? e.message : JSON.stringify(e),
      };
    }

    setResults(newResults);
    setLoading(false);
  }, []);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Tests additional Docker Desktop SDK methods to check compatibility with Rancher Desktop.
      </Typography>

      <Button
        variant="contained"
        startIcon={loading ? <CircularProgress size={20} /> : <BugReportIcon />}
        onClick={runSdkTests}
        disabled={loading}
        sx={{ mb: 2 }}
      >
        {loading ? 'Testing...' : 'Test SDK Methods'}
      </Button>

      {Object.keys(results).length > 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Method</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Output</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(results).map(([method, { status, output }]) => (
                <TableRow key={method}>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {method}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={status}
                      size="small"
                      color={
                        status === 'OK' ? 'success' :
                        status === 'FAILED' ? 'error' :
                        status === 'BROKEN' ? 'warning' :
                        status === 'MISSING' ? 'warning' :
                        'default'
                      }
                    />
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: 400 }}>
                    {output}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

// Main App component
export default function App() {
  const [expanded, setExpanded] = useState<string | false>('ddClient');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');

  const handleChange = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  // Export all diagnostic results to a text file
  const handleExport = useCallback(async () => {
    setExporting(true);
    const lines: string[] = [];
    const timestamp = new Date().toISOString();

    lines.push('='.repeat(80));
    lines.push('RANCHER DESKTOP EXTENSION DEBUGGER - DIAGNOSTIC REPORT');
    lines.push('='.repeat(80));
    lines.push(`Generated: ${timestamp}`);
    lines.push('');

    // 1. ddClient Object Inspection
    setExportProgress('Inspecting ddClient...');
    lines.push('-'.repeat(80));
    lines.push('1. ddClient OBJECT INSPECTION');
    lines.push('-'.repeat(80));
    try {
      const ext = ddClient.extension as unknown as Record<string, unknown>;
      lines.push(`ddClient.extension.image: ${ext?.image ?? 'undefined'}`);
      lines.push(`typeof ddClient.extension: ${typeof ddClient.extension}`);
      lines.push(`typeof ddClient.docker: ${typeof ddClient.docker}`);
      lines.push(`typeof ddClient.desktopUI: ${typeof ddClient.desktopUI}`);
      lines.push(`typeof ddClient.extension.host: ${typeof ddClient.extension?.host}`);
      lines.push(`typeof ddClient.extension.vm: ${typeof ddClient.extension?.vm}`);

      // List available methods on host
      const host = ddClient.extension?.host;
      if (host) {
        lines.push(`ddClient.extension.host available: yes`);
        lines.push(`ddClient.extension.host.cli available: ${host.cli ? 'yes' : 'no'}`);
      } else {
        lines.push(`ddClient.extension.host available: no`);
      }
    } catch (e) {
      lines.push(`Error inspecting ddClient: ${e instanceof Error ? e.message : e}`);
    }
    lines.push('');

    // 2. Webview Environment
    setExportProgress('Collecting webview environment...');
    lines.push('-'.repeat(80));
    lines.push('2. WEBVIEW ENVIRONMENT (JavaScript)');
    lines.push('-'.repeat(80));
    lines.push(`window.location.href: ${window.location.href}`);
    lines.push(`window.location.origin: ${window.location.origin}`);
    lines.push(`window.location.protocol: ${window.location.protocol}`);
    lines.push(`window.location.hostname: ${window.location.hostname}`);
    lines.push(`window.location.port: ${window.location.port}`);
    lines.push(`window.location.pathname: ${window.location.pathname}`);
    lines.push(`navigator.userAgent: ${navigator.userAgent}`);
    lines.push(`navigator.platform: ${navigator.platform}`);
    lines.push(`navigator.language: ${navigator.language}`);
    lines.push(`navigator.languages: ${navigator.languages?.join(', ')}`);
    lines.push(`navigator.onLine: ${navigator.onLine}`);
    lines.push(`navigator.hardwareConcurrency: ${navigator.hardwareConcurrency}`);
    lines.push(`screen.width: ${screen.width}`);
    lines.push(`screen.height: ${screen.height}`);
    lines.push(`screen.colorDepth: ${screen.colorDepth}`);
    lines.push(`window.devicePixelRatio: ${window.devicePixelRatio}`);
    lines.push(`document.referrer: ${document.referrer || '(empty)'}`);
    lines.push(`document.title: ${document.title}`);
    lines.push('');

    // 3. Extension VM
    setExportProgress('Testing extension VM...');
    lines.push('-'.repeat(80));
    lines.push('3. EXTENSION VM/BACKEND');
    lines.push('-'.repeat(80));
    const vm = ddClient.extension?.vm;
    if (!vm) {
      lines.push('ddClient.extension.vm: not available');
    } else if (!vm.cli?.exec) {
      lines.push('ddClient.extension.vm.cli.exec: not available');
    } else {
      try {
        const vmResult = await vm.cli.exec('/bin/sh', ['-c', 'echo "VM exec works"; hostname; whoami; pwd']);
        lines.push('VM exec result:');
        lines.push(vmResult.stdout || '(no stdout)');
        if (vmResult.stderr) lines.push(`stderr: ${vmResult.stderr}`);
      } catch (e) {
        lines.push(`VM exec error: ${e instanceof Error ? e.message : e}`);
      }
    }
    lines.push('');

    // 4. Host Binary Environment
    setExportProgress('Running host binary inspection...');
    lines.push('-'.repeat(80));
    lines.push('4. HOST BINARY ENVIRONMENT');
    lines.push('-'.repeat(80));
    const host = ddClient.extension?.host;
    if (!host) {
      lines.push('ddClient.extension.host: not available');
    } else {
      try {
        const debugResult = await host.cli.exec('debug-env', []);
        lines.push(debugResult.stdout || '(no output)');
        if (debugResult.stderr) lines.push(`stderr: ${debugResult.stderr}`);
      } catch (e) {
        lines.push(`debug-env error: ${e instanceof Error ? e.message : e}`);
      }
    }
    lines.push('');

    // 5. Host Binary Stress Test
    setExportProgress('Running host binary stress test...');
    lines.push('-'.repeat(80));
    lines.push('5. HOST BINARY STRESS TEST');
    lines.push('-'.repeat(80));
    const exportBinaryConfigs = [
      { name: 'kubectl', args: ['version', '--client', '-o', 'json'] },
      { name: 'helm', args: ['version', '--short'] },
      { name: 'rdctl', args: ['version'] },
      { name: 'docker', args: ['version', '--format', '{{.Client.Version}}'] },
      { name: 'debug-env', args: [] },
    ];
    if (!host) {
      lines.push('ddClient.extension.host: not available');
    } else {
      for (const { name, args } of exportBinaryConfigs) {
        try {
          const result = await host.cli.exec(name, args);
          const output = (result.stdout || result.stderr || '').trim().split('\n')[0];
          lines.push(`${name}: OK - ${output.substring(0, 100)}`);
        } catch (e) {
          let errorMsg: string;
          if (e instanceof Error) {
            errorMsg = e.message;
          } else if (typeof e === 'object' && e !== null) {
            errorMsg = JSON.stringify(e);
          } else {
            errorMsg = String(e);
          }
          lines.push(`${name}: FAILED - ${errorMsg}`);
        }
      }
    }
    lines.push('');

    // 6. Kubernetes Context
    setExportProgress('Checking Kubernetes context...');
    lines.push('-'.repeat(80));
    lines.push('6. KUBERNETES CONTEXT');
    lines.push('-'.repeat(80));
    if (!host) {
      lines.push('ddClient.extension.host: not available');
    } else {
      try {
        const ctx = await host.cli.exec('kubectl', ['config', 'current-context']);
        lines.push(`Current Context: ${ctx.stdout.trim()}`);
      } catch (e) {
        lines.push(`Current Context: Error - ${e instanceof Error ? e.message : e}`);
      }

      try {
        const contexts = await host.cli.exec('kubectl', ['config', 'get-contexts']);
        lines.push('');
        lines.push('All Contexts:');
        lines.push(contexts.stdout);
      } catch (e) {
        lines.push(`All Contexts: Error - ${e instanceof Error ? e.message : e}`);
      }
    }
    lines.push('');

    // 7. SDK Method Compatibility
    setExportProgress('Testing SDK methods...');
    lines.push('-'.repeat(80));
    lines.push('7. SDK METHOD COMPATIBILITY');
    lines.push('-'.repeat(80));

    // Test docker.listContainers
    try {
      const containers = await ddClient.docker.listContainers() as unknown[];
      lines.push(`docker.listContainers(): OK - Found ${containers.length} containers`);
    } catch (e) {
      lines.push(`docker.listContainers(): FAILED - ${e instanceof Error ? e.message : JSON.stringify(e)}`);
    }

    // Test docker.listImages
    try {
      const images = await ddClient.docker.listImages() as unknown[];
      lines.push(`docker.listImages(): OK - Found ${images.length} images`);
    } catch (e) {
      lines.push(`docker.listImages(): FAILED - ${e instanceof Error ? e.message : JSON.stringify(e)}`);
    }

    // Test desktopUI.toast
    const toast = ddClient.desktopUI?.toast;
    lines.push(`desktopUI.toast.success: ${typeof toast?.success === 'function' ? 'Available' : 'Not available'}`);
    lines.push(`desktopUI.toast.warning: ${typeof toast?.warning === 'function' ? 'Available' : 'Not available'}`);
    lines.push(`desktopUI.toast.error: ${typeof toast?.error === 'function' ? 'Available' : 'Not available'}`)

    // Check available desktopUI keys
    try {
      const desktopUIKeys = ddClient.desktopUI ? Object.keys(ddClient.desktopUI) : [];
      lines.push(`desktopUI available keys: ${desktopUIKeys.length > 0 ? desktopUIKeys.join(', ') : 'none'}`);
    } catch (e) {
      lines.push(`desktopUI keys: Error - ${e instanceof Error ? e.message : e}`);
    }

    // Check extension properties
    const ext = ddClient.extension as unknown as Record<string, unknown>;
    lines.push(`extension.id: ${ext?.id !== undefined ? String(ext.id) : 'undefined (MISSING)'}`);
    lines.push(`extension.version: ${ext?.version !== undefined ? String(ext.version) : 'undefined (MISSING)'}`);
    const imageValue = ext?.image !== undefined ? String(ext.image) : 'undefined';
    const imageStatus = ext?.image ? (String(ext.image).includes(':') ? 'OK' : 'BROKEN - missing tag') : 'MISSING';
    lines.push(`extension.image: ${imageValue} (${imageStatus})`);
    lines.push('');

    // Footer
    lines.push('='.repeat(80));
    lines.push('END OF DIAGNOSTIC REPORT');
    lines.push('='.repeat(80));

    // Generate and download file
    setExportProgress('Generating file...');
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rd-extension-debug-${timestamp.replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExporting(false);
    setExportProgress('');
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BugReportIcon fontSize="large" />
            RD Extension Debugger
          </Typography>
          <Button
            variant="contained"
            color="secondary"
            startIcon={exporting ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? exportProgress || 'Exporting...' : 'Export All Results'}
          </Button>
        </Box>
        <Typography variant="body1" color="text.secondary">
          A diagnostic tool for investigating Rancher Desktop's extension mechanism.
          Use this to understand the runtime environment and identify bugs.
        </Typography>
      </Box>

      <Accordion expanded={expanded === 'ddClient'} onChange={handleChange('ddClient')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">1. ddClient Object Inspection</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <DdClientPanel />
        </AccordionDetails>
      </Accordion>

      <Accordion expanded={expanded === 'container'} onChange={handleChange('container')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">2. Container Environment</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <ContainerEnvPanel />
        </AccordionDetails>
      </Accordion>

      <Accordion expanded={expanded === 'backend'} onChange={handleChange('backend')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">3. Backend Service API</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <BackendServicePanel />
        </AccordionDetails>
      </Accordion>

      <Accordion expanded={expanded === 'hostBinary'} onChange={handleChange('hostBinary')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">4. Host Binary Environment</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <HostBinaryEnvPanel />
        </AccordionDetails>
      </Accordion>

      <Accordion expanded={expanded === 'stressTest'} onChange={handleChange('stressTest')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">5. Host Binary Stress Test (Bug Reproduction)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <HostBinaryStressTestPanel />
        </AccordionDetails>
      </Accordion>

      <Accordion expanded={expanded === 'rdTools'} onChange={handleChange('rdTools')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">6. RD Tools Inventory</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <RdToolsPanel />
        </AccordionDetails>
      </Accordion>

      <Accordion expanded={expanded === 'kubernetes'} onChange={handleChange('kubernetes')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">7. Kubernetes Context</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <KubernetesPanel />
        </AccordionDetails>
      </Accordion>

      <Accordion expanded={expanded === 'sdkMethods'} onChange={handleChange('sdkMethods')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">8. SDK Method Compatibility</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <SdkMethodsPanel />
        </AccordionDetails>
      </Accordion>

      <Paper sx={{ p: 2, mt: 4, bgcolor: 'background.paper' }}>
        <Typography variant="subtitle2" gutterBottom>Known Issues Being Investigated:</Typography>
        <Box component="ul" sx={{ m: 0, pl: 2 }}>
          <li>ddClient.extension.image missing tag (returns name without :version)</li>
          <li>Host binaries limited to ~2-3 scripts (4th binary fails with ENOENT)</li>
          <li>Extension sidebar icon caching (requires full RD restart)</li>
          <li>GUI uninstall fails silently (CLI works fine)</li>
          <li><strong>vm.image not supported</strong> - RD requires vm.composefile; vm.image is ignored</li>
          <li><strong>vm.service not implemented</strong> - ddClient.extension.vm.service API unavailable; use HTTP fallback via exposed port</li>
        </Box>
      </Paper>
    </Container>
  );
}
