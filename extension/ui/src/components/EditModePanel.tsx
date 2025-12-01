/**
 * EditModePanel - Extension builder panel with tabs for editing, loading, and building.
 */

import { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import BuildIcon from '@mui/icons-material/Build';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
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
import { EditModeLoadTab } from './EditModeLoadTab';
import { EditModeBuildTab } from './EditModeBuildTab';
import { EditModeEditTab, ColorFieldConfig, HarmonyPreview } from './EditModeEditTab';
import {
  generatePaletteFromColor,
  HARMONY_TYPES,
  type HarmonyType,
} from '../utils/paletteGenerator';
import { extractColorsFromSvg, hexToRgb, getColorNames, type ExtractedColor } from '../utils/colorExtractor';

// Default Fleet icon SVG content for color extraction
const DEFAULT_FLEET_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect fill="#22ad5f" width="100" height="100" rx="10"/>
  <path fill="#fff" d="M108.734,68.40666..."/>
</svg>`;

interface EditModePanelProps {
  manifest: Manifest;
  cards: CardDefinition[];
  cardOrder: string[];
  iconState: IconState;
  resolvedPalette?: ReturnType<typeof import('../hooks/usePalette').usePalette>;
  onConfigLoaded?: (manifest: Manifest) => void;
  onPaletteChange?: (palette: ColorPalette) => void;
}

// Validate hex color (3, 4, 6, or 8 digit hex with #)
const isValidHexColor = (color: string): boolean => {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color);
};

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

export function EditModePanel({ manifest, cards, cardOrder, iconState, resolvedPalette, onConfigLoaded, onPaletteChange }: EditModePanelProps) {
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

  // Get picker value for color input
  const getPickerValue = (field: ColorFieldConfig, currentValue: string): string => {
    const isHexColor = isValidHexColor(currentValue);
    if (isHexColor) return currentValue;

    // For non-hex values (like "inherit"), try resolved palette
    if (resolvedPalette) {
      const group = resolvedPalette[field.group as keyof typeof resolvedPalette];
      if (group && typeof group === 'object') {
        const value = (group as Record<string, string>)[field.property];
        if (value && isValidHexColor(value)) return value;
      }
    }
    return field.defaultValue !== 'inherit' ? field.defaultValue : '#212121';
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

  // UI state
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  // Build tab state
  const [imageName, setImageName] = useState('my-fleet-extension:dev');
  const [baseImage, setBaseImage] = useState('');
  const [baseImageStatus, setBaseImageStatus] = useState('Detecting...');
  const [downloading, setDownloading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildOutput, setBuildOutput] = useState<string | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);

  // Load tab state
  const [fleetImages, setFleetImages] = useState<FleetExtensionImage[]>([]);
  const [selectedImage, setSelectedImage] = useState('');
  const [loadingImages, setLoadingImages] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Confirmation dialog state
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // Auto-palette state
  const [paletteMenuAnchor, setPaletteMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedHarmony, setSelectedHarmony] = useState<HarmonyType>('complementary');
  const [generatingPalette, setGeneratingPalette] = useState(false);
  const [harmonyPreviews, setHarmonyPreviews] = useState<Map<HarmonyType, HarmonyPreview>>(new Map());
  const [originalPalette, setOriginalPalette] = useState<ColorPalette | null>(null);
  const [previewingHarmony, setPreviewingHarmony] = useState<HarmonyType | null>(null);

  // Color names state
  const [colorNames, setColorNames] = useState<Map<string, string>>(new Map());

  // Fetch color names when palette colors change
  useEffect(() => {
    const fetchColorNames = async () => {
      const palette = manifest.branding?.palette;
      const hexColors: string[] = [];

      if (palette?.header?.background) hexColors.push(palette.header.background);
      if (palette?.header?.text) hexColors.push(palette.header.text);
      if (palette?.body?.background) hexColors.push(palette.body.background);
      if (palette?.card?.border) hexColors.push(palette.card.border);
      if (palette?.card?.title) hexColors.push(palette.card.title);

      if (hexColors.length === 0) {
        hexColors.push(
          defaultPalette.header.background,
          defaultPalette.header.text,
          defaultPalette.body.background,
          defaultPalette.card.border,
          defaultPalette.card.title,
        );
      }

      const validHexColors = hexColors.filter(color => isValidHexColor(color));
      if (validHexColors.length > 0) {
        const names = await getColorNames(validHexColors);
        setColorNames(names);
      }
    };
    fetchColorNames();
  }, [manifest.branding?.palette]);

  // Get base color for palette generation
  // Uses current header background if set, otherwise extracts from icon
  const getBaseColor = async (): Promise<ExtractedColor> => {
    // First check if user has manually set a header background color
    const currentHeaderBg = manifest.branding?.palette?.header?.background;
    if (currentHeaderBg && isValidHexColor(currentHeaderBg)) {
      const rgb = hexToRgb(currentHeaderBg);
      if (rgb) {
        return { hex: currentHeaderBg, rgb };
      }
    }

    // Otherwise extract from icon
    if (iconState === 'deleted') {
      return {
        hex: defaultPalette.header.background,
        rgb: hexToRgb(defaultPalette.header.background)!,
      };
    } else if (iconState === null) {
      const colors = extractColorsFromSvg(DEFAULT_FLEET_ICON_SVG);
      return colors[0] || {
        hex: '#22ad5f',
        rgb: { r: 34, g: 173, b: 95 },
      };
    } else {
      const customIcon = iconState;
      const dataUrl = `data:${customIcon.mimeType};base64,${customIcon.data}`;

      if (customIcon.mimeType === 'image/svg+xml') {
        const svgContent = atob(customIcon.data);
        const colors = extractColorsFromSvg(svgContent);
        if (colors[0]) return colors[0];
      } else {
        const { extractDominantColor } = await import('../utils/colorExtractor');
        const dominantColor = await extractDominantColor(dataUrl);
        if (dominantColor) return dominantColor;
      }

      // Fallback
      return {
        hex: '#22ad5f',
        rgb: { r: 34, g: 173, b: 95 },
      };
    }
  };

  // Generate all harmony previews when opening the palette menu
  const handleOpenPaletteMenu = async (event: React.MouseEvent<HTMLElement>) => {
    setPaletteMenuAnchor(event.currentTarget);

    // Store current palette for revert
    setOriginalPalette(manifest.branding?.palette || {});

    // Generate preview palettes for all harmony types
    try {
      const baseColor = await getBaseColor();
      const previews = new Map<HarmonyType, HarmonyPreview>();

      for (const harmony of HARMONY_TYPES) {
        const result = generatePaletteFromColor(baseColor, { harmony: harmony.value });
        previews.set(harmony.value, {
          headerBg: result.uiPalette.header?.background || defaultPalette.header.background,
          headerText: result.uiPalette.header?.text || defaultPalette.header.text,
          bodyBg: result.uiPalette.body?.background || defaultPalette.body.background,
          cardBorder: result.uiPalette.card?.border || defaultPalette.card.border,
          cardTitle: result.uiPalette.card?.title || defaultPalette.card.title,
        });
      }

      setHarmonyPreviews(previews);
    } catch (err) {
      console.error('Failed to generate preview palettes:', err);
    }
  };

  // Handle harmony hover - apply preview palette
  const handleHarmonyHover = (harmony: HarmonyType | null) => {
    if (!onPaletteChange) return;

    if (harmony === null) {
      // Mouse left menu - revert to original
      if (originalPalette !== null && previewingHarmony !== null) {
        onPaletteChange(originalPalette);
      }
      setPreviewingHarmony(null);
    } else {
      // Apply preview palette
      const preview = harmonyPreviews.get(harmony);
      if (preview) {
        setPreviewingHarmony(harmony);
        onPaletteChange({
          header: {
            background: preview.headerBg,
            text: preview.headerText,
          },
          body: {
            background: preview.bodyBg,
          },
          card: {
            border: preview.cardBorder,
            title: preview.cardTitle,
          },
        });
      }
    }
  };

  // Handle menu close - revert if no selection made
  const handleClosePaletteMenu = () => {
    if (originalPalette !== null && previewingHarmony !== null && onPaletteChange) {
      onPaletteChange(originalPalette);
    }
    setPaletteMenuAnchor(null);
    setOriginalPalette(null);
    setPreviewingHarmony(null);
  };

  // Generate palette from icon (when harmony is clicked/selected)
  const handleGeneratePalette = async (harmony: HarmonyType) => {
    if (!onPaletteChange) return;

    // Clear preview state first - the palette is already applied from hover
    setPreviewingHarmony(null);
    setOriginalPalette(null);
    setPaletteMenuAnchor(null);
    setSelectedHarmony(harmony);

    // If preview was shown, palette is already applied
    const preview = harmonyPreviews.get(harmony);
    if (preview) {
      onPaletteChange({
        header: {
          background: preview.headerBg,
          text: preview.headerText,
        },
        body: {
          background: preview.bodyBg,
        },
        card: {
          border: preview.cardBorder,
          title: preview.cardTitle,
        },
      });
      setImportSuccess(`Palette generated using ${harmony} harmony`);
      return;
    }

    // Fallback: generate if previews weren't available
    setGeneratingPalette(true);

    try {
      const baseColor = await getBaseColor();
      const result = generatePaletteFromColor(baseColor, { harmony });
      onPaletteChange(result.uiPalette);
      setImportSuccess(`Palette generated using ${harmony} harmony`);
    } catch (err) {
      console.error('Failed to generate palette:', err);
      setImportError('Failed to generate palette from icon');
    } finally {
      setGeneratingPalette(false);
    }
  };

  // Detect base image on mount
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
      if (onConfigLoaded) {
        onConfigLoaded(result.manifest);
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
      onConfigLoaded(DEFAULT_MANIFEST);
    }
  };

  const getImageDisplayName = (img: FleetExtensionImage): string => {
    return img.title || `${img.repository}:${img.tag}`;
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
        {/* Header */}
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
              <Tab label="Edit" id="edit-mode-tab-0" aria-controls="edit-mode-tabpanel-0" />
              <Tab label="Load" id="edit-mode-tab-1" aria-controls="edit-mode-tabpanel-1" />
              <Tab label="Build" id="edit-mode-tab-2" aria-controls="edit-mode-tabpanel-2" />
            </Tabs>

            {/* Status messages */}
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

            {/* Edit Tab */}
            <TabPanel value={activeTab} index={0}>
              <EditModeEditTab
                colorFields={colorFields}
                getColorValue={getColorValue}
                getPickerValue={getPickerValue}
                colorNames={colorNames}
                selectedHarmony={selectedHarmony}
                generatingPalette={generatingPalette}
                canChangePalette={!!onPaletteChange}
                paletteMenuAnchor={paletteMenuAnchor}
                harmonyPreviews={harmonyPreviews}
                onColorChange={handleColorChange}
                onResetColor={handleResetColor}
                onGeneratePalette={handleGeneratePalette}
                onOpenPaletteMenu={handleOpenPaletteMenu}
                onClosePaletteMenu={handleClosePaletteMenu}
                onHarmonyHover={handleHarmonyHover}
              />
            </TabPanel>

            {/* Load Tab */}
            <TabPanel value={activeTab} index={1}>
              <EditModeLoadTab
                fleetImages={fleetImages}
                selectedImage={selectedImage}
                loadingImages={loadingImages}
                importing={importing}
                onSelectedImageChange={setSelectedImage}
                onRefreshImages={refreshFleetImages}
                onLoadFromImage={handleLoadFromImage}
                onFileUpload={handleFileUpload}
                onResetToDefaults={() => setConfirmResetOpen(true)}
                getImageDisplayName={getImageDisplayName}
              />
            </TabPanel>

            {/* Build Tab */}
            <TabPanel value={activeTab} index={2}>
              <EditModeBuildTab
                baseImage={baseImage}
                baseImageStatus={baseImageStatus}
                imageName={imageName}
                downloading={downloading}
                building={building}
                buildOutput={buildOutput}
                buildError={buildError}
                onBaseImageChange={(value) => {
                  setBaseImage(value);
                  setBaseImageStatus('Manually set');
                }}
                onImageNameChange={setImageName}
                onDownload={handleDownload}
                onBuild={handleBuild}
              />
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
