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
            <Alert severity="warning" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {vmResult && (
            <CodeBlock content={vmResult.stdout || vmResult.stderr || vmResult.error || 'No output'} maxHeight={400} />
          )}

          {!vmResult && !error && (
            <Typography variant="body2" color="text.secondary">
              Click the button to inspect the extension VM environment.
              This uses ddClient.extension.vm.cli.exec() to run commands in the extension backend.
            </Typography>
          )}
        </AccordionDetails>
      </Accordion>
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

  const binaries = ['kubectl', 'helm', 'rdctl', 'docker', 'debug-env'];

  const runStressTest = useCallback(async () => {
    setLoading(true);
    const newResults: Record<string, CommandResult> = {};

    const host = ddClient.extension?.host;
    if (!host) {
      binaries.forEach(bin => {
        newResults[bin] = { stdout: '', stderr: '', error: 'ddClient.extension.host not available' };
      });
      setResults(newResults);
      setLoading(false);
      return;
    }

    for (const binary of binaries) {
      try {
        const args = binary === 'debug-env' ? [] : ['version', '--client'];
        const execResult = await host.cli.exec(binary, args);
        newResults[binary] = {
          stdout: execResult.stdout,
          stderr: execResult.stderr,
        };
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        newResults[binary] = {
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
        Tests all {binaries.length} host binaries defined in metadata.json.
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
        {loading ? 'Testing...' : `Test All ${binaries.length} Binaries`}
      </Button>

      {failedCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {failedCount} of {binaries.length} binaries failed. This may indicate the host binary limit bug.
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
            {binaries.map((binary) => {
              const result = results[binary];
              const hasError = result?.error;

              return (
                <TableRow key={binary}>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{binary}</TableCell>
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

// Main App component
export default function App() {
  const [expanded, setExpanded] = useState<string | false>('ddClient');

  const handleChange = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BugReportIcon fontSize="large" />
          RD Extension Debugger
        </Typography>
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

      <Accordion expanded={expanded === 'hostBinary'} onChange={handleChange('hostBinary')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">3. Host Binary Environment</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <HostBinaryEnvPanel />
        </AccordionDetails>
      </Accordion>

      <Accordion expanded={expanded === 'stressTest'} onChange={handleChange('stressTest')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">4. Host Binary Stress Test (Bug Reproduction)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <HostBinaryStressTestPanel />
        </AccordionDetails>
      </Accordion>

      <Accordion expanded={expanded === 'rdTools'} onChange={handleChange('rdTools')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">5. RD Tools Inventory</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <RdToolsPanel />
        </AccordionDetails>
      </Accordion>

      <Accordion expanded={expanded === 'kubernetes'} onChange={handleChange('kubernetes')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">6. Kubernetes Context</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <KubernetesPanel />
        </AccordionDetails>
      </Accordion>

      <Paper sx={{ p: 2, mt: 4, bgcolor: 'background.paper' }}>
        <Typography variant="subtitle2" gutterBottom>Known Issues Being Investigated:</Typography>
        <Box component="ul" sx={{ m: 0, pl: 2 }}>
          <li>ddClient.extension.image missing tag (returns name without :version)</li>
          <li>Host binaries limited to ~2-3 scripts (4th binary fails with ENOENT)</li>
          <li>Extension sidebar icon caching (requires full RD restart)</li>
          <li>GUI uninstall fails silently (CLI works fine)</li>
        </Box>
      </Paper>
    </Container>
  );
}
