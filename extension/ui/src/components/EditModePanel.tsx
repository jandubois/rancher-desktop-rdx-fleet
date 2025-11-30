import { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import DownloadIcon from '@mui/icons-material/Download';
import BuildIcon from '@mui/icons-material/Build';
import UploadIcon from '@mui/icons-material/Upload';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RestoreIcon from '@mui/icons-material/Restore';
import SettingsIcon from '@mui/icons-material/Settings';
import PaletteIcon from '@mui/icons-material/Palette';
import { Manifest, CardDefinition, DEFAULT_MANIFEST } from '../manifest';
import { ColorPalette, defaultPalette } from '../theme/palette';
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
import type { IconState } from './EditableHeaderIcon';
import { ConfirmDialog } from './ConfirmDialog';

interface EditModePanelProps {
  manifest: Manifest;
  cards: CardDefinition[];
  cardOrder: string[];
  iconState: IconState;
  onConfigLoaded?: (manifest: Manifest, sourceName: string) => void;
  onPaletteChange?: (palette: ColorPalette) => void;
}

// Validate hex color (3, 4, 6, or 8 digit hex with #)
const isValidHexColor = (color: string): boolean => {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color);
};

// Color field configuration
interface ColorFieldConfig {
  id: string;
  label: string;
  group: 'header' | 'body' | 'card';
  property: string;
  defaultValue: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`edit-mode-tabpanel-${index}`}
      aria-labelledby={`edit-mode-tab-${index}`}
      sx={{ pt: 2 }}
    >
      {value === index && children}
    </Box>
  );
}

export function EditModePanel({ manifest, cards, cardOrder, iconState, onConfigLoaded, onPaletteChange }: EditModePanelProps) {
  // Color field definitions
  const colorFields: ColorFieldConfig[] = [
    { id: 'header-bg', label: 'Header Background', group: 'header', property: 'background', defaultValue: defaultPalette.header.background },
    { id: 'header-text', label: 'Header Text', group: 'header', property: 'text', defaultValue: defaultPalette.header.text },
    { id: 'body-bg', label: 'Body Background', group: 'body', property: 'background', defaultValue: defaultPalette.body.background },
    { id: 'card-border', label: 'Card Border', group: 'card', property: 'border', defaultValue: defaultPalette.card.border },
    { id: 'card-title', label: 'Card Title', group: 'card', property: 'title', defaultValue: defaultPalette.card.title },
  ];

  // Get current color value from manifest palette
  const getColorValue = (field: ColorFieldConfig): string => {
    const palette = manifest.branding?.palette;
    if (!palette) return field.defaultValue;
    const group = palette[field.group];
    if (!group) return field.defaultValue;
    return (group as Record<string, string | undefined>)[field.property] ?? field.defaultValue;
  };

  // Handle color change
  const handleColorChange = (field: ColorFieldConfig, value: string) => {
    if (!onPaletteChange) return;

    const currentPalette = manifest.branding?.palette || {};
    const updatedPalette: ColorPalette = {
      ...currentPalette,
      [field.group]: {
        ...(currentPalette[field.group] || {}),
        [field.property]: value || undefined,
      },
    };

    onPaletteChange(updatedPalette);
  };

  // Reset a color to default
  const handleResetColor = (field: ColorFieldConfig) => {
    if (!onPaletteChange) return;

    const currentPalette = manifest.branding?.palette || {};
    const groupData = { ...(currentPalette[field.group] || {}) };
    delete (groupData as Record<string, string | undefined>)[field.property];

    const updatedPalette: ColorPalette = {
      ...currentPalette,
      [field.group]: Object.keys(groupData).length > 0 ? groupData : undefined,
    };

    // Clean up empty groups
    if (!updatedPalette.header || Object.keys(updatedPalette.header).length === 0) {
      delete updatedPalette.header;
    }
    if (!updatedPalette.body || Object.keys(updatedPalette.body).length === 0) {
      delete updatedPalette.body;
    }
    if (!updatedPalette.card || Object.keys(updatedPalette.card).length === 0) {
      delete updatedPalette.card;
    }

    onPaletteChange(updatedPalette);
  };
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
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

  // Confirmation dialog state
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

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
    name: manifest.app?.name || 'My Fleet Extension',
    manifest,
    cards,
    cardOrder,
    baseImage: baseImage || undefined,
    iconState,
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
      // Notify parent of loaded config (which includes the extension name)
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
    setConfirmResetOpen(false);
    setImportError(null);
    setImportSuccess('Configuration reset to defaults');
    if (onConfigLoaded) {
      onConfigLoaded(DEFAULT_MANIFEST, 'defaults');
    }
  };

  const getImageDisplayName = (img: FleetExtensionImage): string => {
    const name = img.title || `${img.repository}:${img.tag}`;
    return name;
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <>
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
            {/* Tabs */}
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              aria-label="Edit mode tabs"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label="Load" id="edit-mode-tab-0" aria-controls="edit-mode-tabpanel-0" />
              <Tab label="Build" id="edit-mode-tab-1" aria-controls="edit-mode-tabpanel-1" />
              <Tab label="Edit" id="edit-mode-tab-2" aria-controls="edit-mode-tabpanel-2" />
            </Tabs>

            {/* Import status messages - shown across all tabs */}
            {(importSuccess || importError) && (
              <Box sx={{ mt: 2 }}>
                {importSuccess && (
                  <Alert severity="success" onClose={() => setImportSuccess(null)}>
                    {importSuccess}
                  </Alert>
                )}
                {importError && (
                  <Alert severity="error" onClose={() => setImportError(null)}>
                    {importError}
                  </Alert>
                )}
              </Box>
            )}

            {/* Load Tab */}
            <TabPanel value={activeTab} index={0}>
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
                  onClick={() => setConfirmResetOpen(true)}
                  disabled={importing}
                >
                  Reset to Defaults
                </Button>
              </Box>
            </TabPanel>

            {/* Build Tab */}
            <TabPanel value={activeTab} index={1}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Build or download your custom extension as a Docker image or ZIP file.
              </Typography>

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
                  {building ? 'Building...' : 'Build Image'}
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
            </TabPanel>

            {/* Edit Tab */}
            <TabPanel value={activeTab} index={2}>
              {/* Branding Colors Section */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <PaletteIcon color="action" />
                <Typography variant="subtitle2">
                  Branding Colors
                </Typography>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Customize the extension appearance. Enter hex color values (e.g., #1976d2) or use the color picker.
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                {colorFields.map((field) => {
                  const currentValue = getColorValue(field);
                  const isDefault = currentValue === field.defaultValue;
                  const isHexColor = isValidHexColor(currentValue);
                  const isInherit = currentValue === 'inherit';
                  const isValid = isHexColor || isInherit;

                  // Helper text based on state
                  const helperText = !isValid
                    ? 'Enter hex color (e.g., #1976d2) or "inherit"'
                    : isInherit
                    ? 'Inherits from parent (type hex to customize)'
                    : isDefault
                    ? 'Default'
                    : 'Custom';

                  return (
                    <Box key={field.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <TextField
                        label={field.label}
                        value={currentValue}
                        onChange={(e) => handleColorChange(field, e.target.value)}
                        size="small"
                        fullWidth
                        error={!isValid}
                        helperText={helperText}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                {isHexColor ? (
                                  <Box
                                    component="input"
                                    type="color"
                                    value={currentValue}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleColorChange(field, e.target.value)}
                                    sx={{
                                      width: 24,
                                      height: 24,
                                      p: 0,
                                      border: '1px solid',
                                      borderColor: 'divider',
                                      borderRadius: 0.5,
                                      cursor: 'pointer',
                                      '&::-webkit-color-swatch-wrapper': { p: 0 },
                                      '&::-webkit-color-swatch': { border: 'none', borderRadius: 0.5 },
                                    }}
                                  />
                                ) : (
                                  <Box
                                    sx={{
                                      width: 24,
                                      height: 24,
                                      border: '1px dashed',
                                      borderColor: 'divider',
                                      borderRadius: 0.5,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.6rem',
                                      color: 'text.disabled',
                                    }}
                                  >
                                    —
                                  </Box>
                                )}
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                      {!isDefault && (
                        <Button
                          size="small"
                          onClick={() => handleResetColor(field)}
                          sx={{ minWidth: 'auto', px: 1, mt: 0.5 }}
                          title="Reset to default"
                        >
                          <RestoreIcon fontSize="small" />
                        </Button>
                      )}
                    </Box>
                  );
                })}
              </Box>

              {/* Additional Settings Placeholder */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 4, mb: 2 }}>
                <SettingsIcon color="action" />
                <Typography variant="subtitle2">
                  Additional Settings
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                More configuration options coming soon.
              </Typography>
            </TabPanel>
          </Box>
        </Collapse>
      </Paper>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmResetOpen}
        title="Reset to Defaults"
        message="This will reset all configuration to the default values. Any unsaved changes will be lost."
        confirmLabel="Reset"
        confirmColor="warning"
        onConfirm={handleResetToDefaults}
        onCancel={() => setConfirmResetOpen(false)}
      />
    </>
  );
}
