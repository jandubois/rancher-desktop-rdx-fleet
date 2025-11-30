import { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import DownloadIcon from '@mui/icons-material/Download';
import BuildIcon from '@mui/icons-material/Build';
import UploadIcon from '@mui/icons-material/Upload';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RestoreIcon from '@mui/icons-material/Restore';
import { Manifest, CardDefinition, DEFAULT_MANIFEST } from '../manifest';
import {
  downloadExtensionZip,
  buildExtension,
  detectCurrentExtensionImageAsync,
  listFleetExtensionImages,
  importConfigFromImage,
  importConfigFromZip,
  ExtensionConfig,
  DetectionResult,
  FleetExtensionImage,
  ImportResult,
} from '../utils/extensionBuilder';
import type { CustomIcon } from './IconUpload';

interface EditModePanelProps {
  manifest: Manifest;
  cards: CardDefinition[];
  cardOrder: string[];
  customIcon: CustomIcon | null;
  onConfigLoaded?: (manifest: Manifest, sourceName: string) => void;
}

export function EditModePanel({ manifest, cards, cardOrder, customIcon, onConfigLoaded }: EditModePanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [extensionName, setExtensionName] = useState(manifest.app?.name || 'My Fleet Extension');
  const [imageName, setImageName] = useState('my-fleet-extension:dev');
  const [baseImage, setBaseImage] = useState('');
  const [baseImageStatus, setBaseImageStatus] = useState('Detecting...');
  const [downloading, setDownloading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildOutput, setBuildOutput] = useState<string | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);

  // Load config state
  const [fleetImages, setFleetImages] = useState<FleetExtensionImage[]>([]);
  const [selectedImage, setSelectedImage] = useState('');
  const [loadingImages, setLoadingImages] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Load Fleet extension images on mount
  useEffect(() => {
    refreshFleetImages();
  }, []);

  const refreshFleetImages = async () => {
    setLoadingImages(true);
    try {
      const images = await listFleetExtensionImages();
      setFleetImages(images);
    } catch (err) {
      console.error('Failed to load Fleet images:', err);
    } finally {
      setLoadingImages(false);
    }
  };

  const getConfig = (): ExtensionConfig => ({
    name: extensionName,
    manifest,
    cards,
    cardOrder,
    baseImage: baseImage || undefined,
    customIcon,
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

  const handleImportResult = (result: ImportResult, sourceName: string) => {
    if (result.success && result.manifest) {
      setImportError(null);
      setImportSuccess(`Configuration loaded from ${sourceName}`);
      // Update extension name from loaded manifest
      if (result.manifest.app?.name) {
        setExtensionName(result.manifest.app.name);
      }
      // Notify parent of loaded config
      if (onConfigLoaded) {
        onConfigLoaded(result.manifest, sourceName);
      }
    } else {
      setImportSuccess(null);
      setImportError(result.error || 'Failed to load configuration');
    }
  };

  const handleLoadFromImage = async () => {
    if (!selectedImage) return;

    setImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const result = await importConfigFromImage(selectedImage);
      handleImportResult(result, selectedImage);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to load from image');
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const result = await importConfigFromZip(file);
      handleImportResult(result, file.name);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to load from ZIP');
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleResetToDefaults = () => {
    setImportError(null);
    setImportSuccess('Configuration reset to defaults');
    setExtensionName(DEFAULT_MANIFEST.app?.name || 'Fleet GitOps');
    if (onConfigLoaded) {
      onConfigLoaded(DEFAULT_MANIFEST, 'defaults');
    }
  };

  const getImageDisplayName = (img: FleetExtensionImage): string => {
    const name = img.title || `${img.repository}:${img.tag}`;
    return name;
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
          {/* Load Configuration Section */}
          <Typography variant="subtitle2" sx={{ mt: 1, mb: 1, fontWeight: 600 }}>
            Load Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Load an existing configuration from a custom extension image or a ZIP file.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap', mb: 2 }}>
            {/* Image selector */}
            <FormControl size="small" sx={{ minWidth: 250, flex: 1 }}>
              <InputLabel>Custom Extension Image</InputLabel>
              <Select
                value={selectedImage}
                onChange={(e) => setSelectedImage(e.target.value)}
                label="Custom Extension Image"
                disabled={loadingImages || importing}
              >
                <MenuItem value="">
                  <em>Select an image...</em>
                </MenuItem>
                {fleetImages.map((img) => (
                  <MenuItem key={`${img.repository}:${img.tag}`} value={`${img.repository}:${img.tag}`}>
                    {getImageDisplayName(img)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              size="small"
              onClick={refreshFleetImages}
              disabled={loadingImages}
              sx={{ minWidth: 40, px: 1 }}
              title="Refresh image list"
            >
              {loadingImages ? <CircularProgress size={20} /> : <RefreshIcon />}
            </Button>

            <Button
              variant="contained"
              startIcon={importing ? <CircularProgress size={16} color="inherit" /> : <UploadIcon />}
              onClick={handleLoadFromImage}
              disabled={!selectedImage || importing}
            >
              Load
            </Button>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              Or upload a ZIP file:
            </Typography>
            <input
              type="file"
              accept=".zip"
              ref={fileInputRef}
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <Button
              variant="outlined"
              startIcon={importing ? <CircularProgress size={16} color="inherit" /> : <FolderOpenIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              Browse...
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button
              variant="text"
              color="secondary"
              startIcon={<RestoreIcon />}
              onClick={handleResetToDefaults}
              disabled={importing}
            >
              Reset to Defaults
            </Button>
          </Box>

          {/* Import status messages */}
          {importSuccess && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setImportSuccess(null)}>
              {importSuccess}
            </Alert>
          )}
          {importError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setImportError(null)}>
              {importError}
            </Alert>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Build Extension Section */}
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Build Extension
          </Typography>
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
