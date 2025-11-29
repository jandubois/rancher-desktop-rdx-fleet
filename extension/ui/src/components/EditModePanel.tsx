import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import DownloadIcon from '@mui/icons-material/Download';
import BuildIcon from '@mui/icons-material/Build';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { Manifest, CardDefinition } from '../manifest';
import { downloadExtensionZip, buildExtension, detectCurrentExtensionImageAsync, ExtensionConfig, DetectionResult } from '../utils/extensionBuilder';

interface EditModePanelProps {
  manifest: Manifest;
  cards: CardDefinition[];
  cardOrder: string[];
}

export function EditModePanel({ manifest, cards, cardOrder }: EditModePanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [extensionName, setExtensionName] = useState(manifest.app?.name || 'My Fleet Extension');
  const [imageName, setImageName] = useState('my-fleet-extension:dev');
  const [baseImage, setBaseImage] = useState('');
  const [baseImageStatus, setBaseImageStatus] = useState('Detecting...');
  const [downloading, setDownloading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildOutput, setBuildOutput] = useState<string | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);

  // Try to detect the base image asynchronously (includes rdctl fallback for tag)
  useEffect(() => {
    if (!baseImage) {
      detectCurrentExtensionImageAsync()
        .then((result: DetectionResult) => {
          if (result.image) {
            setBaseImage(result.image);
            const statusParts = [`[${result.source}] ${result.image}`];
            if (result.details) {
              statusParts.push(`(${result.details})`);
            }
            setBaseImageStatus(statusParts.join(' '));
          } else {
            setBaseImageStatus(`Could not detect (${result.details || result.source})`);
          }
        })
        .catch((err) => {
          setBaseImageStatus(`Detection failed: ${err.message || err}`);
        });
    }
  }, [baseImage]);

  const getConfig = (): ExtensionConfig => ({
    name: extensionName,
    manifest,
    cards,
    cardOrder,
    baseImage: baseImage || undefined,
  });

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadExtensionZip(getConfig());
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleBuild = async () => {
    setBuilding(true);
    setBuildOutput(null);
    setBuildError(null);

    try {
      const result = await buildExtension(
        getConfig(),
        imageName,
        (message) => setBuildOutput(message)
      );

      if (result.success) {
        setBuildOutput(
          `Build successful!\n\n` +
          `Image: ${result.imageName}\n\n` +
          `To install the extension, run:\n` +
          `  rdctl extension install ${result.imageName}\n\n` +
          (result.output ? `Build output:\n${result.output}` : '')
        );
      } else {
        setBuildError(result.error || 'Build failed');
        if (result.output) {
          setBuildOutput(result.output);
        }
      }
    } catch (err) {
      setBuildError(err instanceof Error ? err.message : 'Build failed');
    } finally {
      setBuilding(false);
    }
  };

  return (
    <Paper
      sx={{
        mb: 2,
        border: '2px solid',
        borderColor: 'warning.main',
        bgcolor: 'warning.light',
        overflow: 'hidden',
      }}
    >
      {/* Header - always visible */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BuildIcon sx={{ color: 'warning.dark' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'warning.dark' }}>
            Edit Mode - Extension Builder
          </Typography>
        </Box>
        {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </Box>

      {/* Expandable content */}
      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 2, bgcolor: 'background.paper' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Customize the extension layout above, then build or download your custom extension.
          </Typography>

          {/* Extension name input */}
          <TextField
            label="Extension Name"
            value={extensionName}
            onChange={(e) => setExtensionName(e.target.value)}
            size="small"
            fullWidth
            sx={{ mb: 2 }}
            helperText="The name shown in Rancher Desktop"
          />

          {/* Base image input */}
          <TextField
            label="Base Image"
            value={baseImage}
            onChange={(e) => {
              setBaseImage(e.target.value);
              setBaseImageStatus('Manually set');
            }}
            size="small"
            fullWidth
            sx={{ mb: 2 }}
            placeholder="e.g., fleet-gitops-extension:next"
            helperText={baseImageStatus}
          />

          {/* Output image name input */}
          <TextField
            label="Output Image Name"
            value={imageName}
            onChange={(e) => setImageName(e.target.value)}
            size="small"
            fullWidth
            sx={{ mb: 2 }}
            helperText="Tag for the built Docker image"
          />

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={downloading ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? 'Downloading...' : 'Download ZIP'}
            </Button>
            <Button
              variant="outlined"
              color="primary"
              startIcon={building ? <CircularProgress size={16} color="inherit" /> : <BuildIcon />}
              onClick={handleBuild}
              disabled={building || !baseImage}
              title={!baseImage ? 'Base image is required for building' : undefined}
            >
              {building ? 'Building...' : 'Build'}
            </Button>
          </Box>

          {/* Build output */}
          {buildOutput && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 300,
                  overflow: 'auto',
                }}
              >
                {buildOutput}
              </Box>
            </Alert>
          )}

          {/* Build error */}
          {buildError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 200,
                  overflow: 'auto',
                }}
              >
                {buildError}
              </Box>
            </Alert>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}
