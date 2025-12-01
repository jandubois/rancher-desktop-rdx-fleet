/**
 * EditModeEditTab - Edit branding colors and other settings.
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import PaletteIcon from '@mui/icons-material/Palette';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import RestoreIcon from '@mui/icons-material/Restore';
import CheckIcon from '@mui/icons-material/Check';
import { HARMONY_TYPES, type HarmonyType } from '../utils/paletteGenerator';

/** Configuration for a color field */
export interface ColorFieldConfig {
  id: string;
  label: string;
  group: 'header' | 'body' | 'card';
  property: string;
  defaultValue: string;
}

/** Preview palette colors for a harmony type */
export interface HarmonyPreview {
  headerBg: string;
  headerText: string;
  bodyBg: string;
  cardBorder: string;
  cardTitle: string;
}

export interface EditModeEditTabProps {
  /** Color field configurations */
  colorFields: ColorFieldConfig[];
  /** Function to get current value for a color field */
  getColorValue: (field: ColorFieldConfig) => string;
  /** Function to get resolved picker value for a color field */
  getPickerValue: (field: ColorFieldConfig, currentValue: string) => string;
  /** Color names map (hex -> name) */
  colorNames: Map<string, string>;
  /** Currently selected harmony type */
  selectedHarmony: HarmonyType;
  /** Whether palette is being generated */
  generatingPalette: boolean;
  /** Whether palette can be changed */
  canChangePalette: boolean;
  /** Palette menu anchor element */
  paletteMenuAnchor: HTMLElement | null;
  /** Preview palettes for all harmony types */
  harmonyPreviews: Map<HarmonyType, HarmonyPreview>;
  /** Callback when color changes */
  onColorChange: (field: ColorFieldConfig, value: string) => void;
  /** Callback to reset a color to default */
  onResetColor: (field: ColorFieldConfig) => void;
  /** Callback to generate palette */
  onGeneratePalette: (harmony: HarmonyType) => void;
  /** Callback to open palette menu */
  onOpenPaletteMenu: (event: React.MouseEvent<HTMLElement>) => void;
  /** Callback to close palette menu */
  onClosePaletteMenu: () => void;
  /** Callback when hovering over a harmony option */
  onHarmonyHover: (harmony: HarmonyType | null) => void;
}

// Validate hex color (3, 4, 6, or 8 digit hex with #)
const isValidHexColor = (color: string): boolean => {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color);
};

export function EditModeEditTab({
  colorFields,
  getColorValue,
  getPickerValue,
  colorNames,
  selectedHarmony,
  generatingPalette,
  canChangePalette,
  paletteMenuAnchor,
  harmonyPreviews,
  onColorChange,
  onResetColor,
  onGeneratePalette,
  onOpenPaletteMenu,
  onClosePaletteMenu,
  onHarmonyHover,
}: EditModeEditTabProps) {
  return (
    <>
      {/* Branding Colors Section */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PaletteIcon color="action" />
          <Typography variant="subtitle2">
            Branding Colors
          </Typography>
        </Box>
        <Tooltip title="Generate color palette from icon">
          <Button
            size="small"
            variant="outlined"
            startIcon={generatingPalette ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
            onClick={onOpenPaletteMenu}
            disabled={generatingPalette || !canChangePalette}
          >
            Auto Palette
          </Button>
        </Tooltip>
        <Menu
          anchorEl={paletteMenuAnchor}
          open={Boolean(paletteMenuAnchor)}
          onClose={onClosePaletteMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: {
              onMouseLeave: () => onHarmonyHover(null),
            },
          }}
        >
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Hover to preview • Click to apply
            </Typography>
          </Box>
          <Divider />
          {HARMONY_TYPES.map((harmony) => {
            const preview = harmonyPreviews.get(harmony.value);
            return (
              <MenuItem
                key={harmony.value}
                onClick={() => onGeneratePalette(harmony.value)}
                onMouseEnter={() => onHarmonyHover(harmony.value)}
                selected={selectedHarmony === harmony.value}
                sx={{ py: 1 }}
              >
                {selectedHarmony === harmony.value && (
                  <ListItemIcon>
                    <CheckIcon fontSize="small" />
                  </ListItemIcon>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', ml: selectedHarmony !== harmony.value ? 4 : 0 }}>
                  {/* Color swatch preview */}
                  {preview && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flexShrink: 0 }}>
                      {/* Header preview */}
                      <Box sx={{ display: 'flex', gap: '1px' }}>
                        <Box
                          sx={{
                            width: 18,
                            height: 12,
                            bgcolor: preview.headerBg,
                            borderRadius: '2px 0 0 0',
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                          title="Header Background"
                        />
                        <Box
                          sx={{
                            width: 10,
                            height: 12,
                            bgcolor: preview.headerText,
                            borderRadius: '0 2px 0 0',
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                          title="Header Text"
                        />
                      </Box>
                      {/* Body + Card preview */}
                      <Box sx={{ display: 'flex', gap: '1px' }}>
                        <Box
                          sx={{
                            width: 10,
                            height: 12,
                            bgcolor: preview.bodyBg,
                            borderRadius: '0 0 0 2px',
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                          title="Body Background"
                        />
                        <Box
                          sx={{
                            width: 9,
                            height: 12,
                            bgcolor: preview.cardBorder,
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                          title="Card Border"
                        />
                        <Box
                          sx={{
                            width: 9,
                            height: 12,
                            bgcolor: preview.cardTitle,
                            borderRadius: '0 0 2px 0',
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                          title="Card Title"
                        />
                      </Box>
                    </Box>
                  )}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2">{harmony.label}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                      {harmony.description}
                    </Typography>
                  </Box>
                </Box>
              </MenuItem>
            );
          })}
        </Menu>
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
          const pickerValue = getPickerValue(field, currentValue);

          // Helper text based on state, including color name
          const colorName = isHexColor ? colorNames.get(currentValue) : null;
          const helperText = !isValid
            ? 'Enter hex color (e.g., #1976d2) or "inherit"'
            : isInherit
            ? 'Inherits from parent'
            : colorName
            ? `${colorName}${isDefault ? ' (default)' : ''}`
            : isDefault
            ? 'Default'
            : 'Custom';

          return (
            <Box key={field.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <TextField
                label={field.label}
                value={currentValue}
                onChange={(e) => onColorChange(field, e.target.value)}
                size="small"
                fullWidth
                error={!isValid}
                helperText={helperText}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Box
                          component="input"
                          type="color"
                          value={pickerValue}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onColorChange(field, e.target.value)}
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
                      </InputAdornment>
                    ),
                  },
                }}
              />
              {!isDefault && (
                <Button
                  size="small"
                  onClick={() => onResetColor(field)}
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
    </>
  );
}

export default EditModeEditTab;
