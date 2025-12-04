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

  // Parse RGB values
  const r = parseInt(color.substring(0, 2), 16) / 255;
  const g = parseInt(color.substring(2, 4), 16) / 255;
  const b = parseInt(color.substring(4, 6), 16) / 255;

  // Apply gamma correction
  const rsRGB = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const gsRGB = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const bsRGB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  // Calculate relative luminance
  return 0.2126 * rsRGB + 0.7152 * gsRGB + 0.0722 * bsRGB;
}

// Get a high-contrast color (white or black) based on background
// For warnings, we want to use bright red or bright yellow depending on background
function getContrastWarningColor(backgroundColor?: string): string {
  if (!backgroundColor || !backgroundColor.startsWith('#')) {
    return '#ff3333'; // Default bright red
  }

  const luminance = getLuminance(backgroundColor);

  // If background is dark (luminance < 0.5), use bright red
  // If background is light, use dark red
  return luminance < 0.5 ? '#ff3333' : '#cc0000';
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
}) => {
  if (editMode && onChange) {
    const isTooLong = value.length > MAX_LENGTH_WARNING;
    const warningColor = getContrastWarningColor(backgroundColor);

    return (
      <Box sx={{ flex: 1 }}>
        <InputBase
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          fullWidth
          sx={{
            typography: variant,
            fontWeight: variant === 'h6' ? 500 : undefined,
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
    <Typography variant={variant}>
      {value}
      {children}
    </Typography>
  );
};

export default EditableTitle;
