import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import InputBase from '@mui/material/InputBase';

const MAX_LENGTH_WARNING = 20;

// Calculate luminance of a color to determine if it's light or dark
// Returns a value between 0 (black) and 1 (white)
function getLuminance(hex: string): number {
  // Remove # if present
  const color = hex.replace('#', '');

  // Parse RGB values (handle both 3 and 6 digit hex)
  let r: number, g: number, b: number;
  if (color.length === 3) {
    r = parseInt(color[0] + color[0], 16) / 255;
    g = parseInt(color[1] + color[1], 16) / 255;
    b = parseInt(color[2] + color[2], 16) / 255;
  } else {
    r = parseInt(color.substring(0, 2), 16) / 255;
    g = parseInt(color.substring(2, 4), 16) / 255;
    b = parseInt(color.substring(4, 6), 16) / 255;
  }

  // Apply gamma correction
  const rsRGB = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const gsRGB = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const bsRGB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  // Calculate relative luminance
  return 0.2126 * rsRGB + 0.7152 * gsRGB + 0.0722 * bsRGB;
}

// Calculate contrast ratio between two colors (WCAG formula)
// Returns a value between 1 (no contrast) and 21 (maximum contrast)
function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Get the highest-contrast warning color based on background
// Prefers colored warnings (red, yellow, orange) when they meet WCAG standards
// Only falls back to black/white when no colored option has sufficient contrast
// Also avoids picking colors too similar to the title text color
function getContrastWarningColor(backgroundColor?: string, titleTextColor?: string): string {
  if (!backgroundColor || !backgroundColor.startsWith('#')) {
    return '#ff3333'; // Default bright red
  }

  // WCAG AA Large Text requires 3:1 (for bold/large text)
  // We use this since warnings are bold (fontWeight: 600)
  const MIN_CONTRAST = 3.0;

  // Threshold for black/white fallback (stricter)
  const FALLBACK_THRESHOLD = 4.0;

  // Colored warning candidates (in priority order)
  const coloredCandidates = [
    '#ff3333', // Bright red
    '#cc0000', // Dark red
    '#ffcc00', // Bright yellow/gold
    '#ff6600', // Orange
  ];

  // Fallback candidates (when no colored option has sufficient contrast)
  const fallbackCandidates = [
    '#ffffff', // White
    '#000000', // Black
  ];

  // First, try to find a colored candidate that meets minimum contrast
  // and is sufficiently different from the title text color
  let bestColoredOption = '';
  let bestColoredContrast = 0;

  for (const candidate of coloredCandidates) {
    const contrast = getContrastRatio(backgroundColor, candidate);

    // Check if this candidate is too similar to the title text
    let tooSimilarToTitle = false;
    if (titleTextColor && titleTextColor.startsWith('#')) {
      const contrastWithTitle = getContrastRatio(candidate, titleTextColor);
      // If contrast with title is less than 2:1, they're too similar
      tooSimilarToTitle = contrastWithTitle < 2.0;
    }

    if (contrast >= MIN_CONTRAST && !tooSimilarToTitle && contrast > bestColoredContrast) {
      bestColoredContrast = contrast;
      bestColoredOption = candidate;
    }
  }

  // If we found a colored option with sufficient contrast, use it
  if (bestColoredOption) {
    return bestColoredOption;
  }

  // Otherwise, fall back to black or white if they meet the fallback threshold
  let bestFallback = '';
  let bestFallbackContrast = 0;

  for (const candidate of fallbackCandidates) {
    const contrast = getContrastRatio(backgroundColor, candidate);

    // Check if this fallback is too similar to the title text
    let tooSimilarToTitle = false;
    if (titleTextColor && titleTextColor.startsWith('#')) {
      const contrastWithTitle = getContrastRatio(candidate, titleTextColor);
      tooSimilarToTitle = contrastWithTitle < 2.0;
    }

    if (contrast >= FALLBACK_THRESHOLD && !tooSimilarToTitle && contrast > bestFallbackContrast) {
      bestFallbackContrast = contrast;
      bestFallback = candidate;
    }
  }

  if (bestFallback) {
    return bestFallback;
  }

  // Last resort: return the fallback with best contrast (ignore title similarity)
  bestFallback = fallbackCandidates[0];
  bestFallbackContrast = getContrastRatio(backgroundColor, fallbackCandidates[0]);

  for (let i = 1; i < fallbackCandidates.length; i++) {
    const contrast = getContrastRatio(backgroundColor, fallbackCandidates[i]);
    if (contrast > bestFallbackContrast) {
      bestFallbackContrast = contrast;
      bestFallback = fallbackCandidates[i];
    }
  }

  return bestFallback;
}

interface EditableTitleProps {
  value: string;
  editMode?: boolean;
  onChange?: (value: string) => void;
  placeholder?: string;
  variant?: 'h6' | 'subtitle1' | 'subtitle2';
  children?: React.ReactNode; // Additional content to show after the title
  validationWarning?: string | null; // Validation warning to display below the title
  backgroundColor?: string; // Background color for calculating contrast
  textColor?: string; // Title text color (to avoid picking warning colors too similar)
}

/**
 * An inline-editable title component.
 * Shows an InputBase when in edit mode, Typography otherwise.
 */
export const EditableTitle: React.FC<EditableTitleProps> = ({
  value,
  editMode = false,
  onChange,
  placeholder = 'Enter title...',
  variant = 'h6',
  children,
  validationWarning,
  backgroundColor,
  textColor,
}) => {
  if (editMode && onChange) {
    const isTooLong = value.length > MAX_LENGTH_WARNING;
    const warningColor = getContrastWarningColor(backgroundColor, textColor);

    return (
      <Box sx={{ flex: 1 }}>
        <InputBase
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          fullWidth
          sx={{
            typography: variant,
            fontWeight: 700,
            color: 'inherit', // Inherit color from parent (e.g., header text color)
            '& .MuiInputBase-input': {
              p: 0,
              color: 'inherit',
              '&::placeholder': {
                opacity: 0.5,
                color: 'inherit',
              },
            },
          }}
        />
        {isTooLong && (
          <Typography variant="caption" sx={{ color: warningColor, fontWeight: 600 }}>
            Long names may wrap in the sidebar ({value.length} characters)
          </Typography>
        )}
        {validationWarning && (
          <Typography variant="caption" sx={{ display: 'block', mt: isTooLong ? 0.5 : 0, color: warningColor, fontWeight: 600 }}>
            {validationWarning}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Typography variant={variant} sx={{ fontWeight: 700 }}>
      {value}
      {children}
    </Typography>
  );
};

export default EditableTitle;
