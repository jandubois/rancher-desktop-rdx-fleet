/**
 * ExtensionImageIcon - Displays extension icon from image data or falls back to puzzle piece.
 *
 * Shows:
 * - The actual extension icon if iconData is available (base64 encoded)
 * - Material-UI's ExtensionIcon (puzzle piece) as fallback
 */

import Box from '@mui/material/Box';
import ExtensionIcon from '@mui/icons-material/Extension';

export interface ExtensionImageIconProps {
  /** Base64 encoded icon data */
  iconData?: string;
  /** MIME type of the icon (e.g., "image/svg+xml", "image/png") */
  iconMimeType?: string;
  /** Icon size in pixels (default: 20) */
  size?: number;
  /** Color for the fallback puzzle icon (MUI color) */
  fallbackColor?: 'inherit' | 'primary' | 'secondary' | 'action' | 'disabled' | 'error' | 'success' | 'warning' | 'info';
}

/**
 * Component that displays an extension's actual icon or falls back to a puzzle piece.
 */
export function ExtensionImageIcon({
  iconData,
  iconMimeType,
  size = 20,
  fallbackColor = 'action',
}: ExtensionImageIconProps) {
  // If we have icon data, display the actual icon
  if (iconData && iconMimeType) {
    const dataUrl = `data:${iconMimeType};base64,${iconData}`;

    return (
      <Box
        component="img"
        src={dataUrl}
        alt="Extension icon"
        sx={{
          width: size,
          height: size,
          objectFit: 'contain',
        }}
      />
    );
  }

  // Fallback to puzzle piece icon
  return <ExtensionIcon fontSize="small" color={fallbackColor} sx={{ fontSize: size }} />;
}

export default ExtensionImageIcon;
