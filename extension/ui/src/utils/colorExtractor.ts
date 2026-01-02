/**
 * Color extraction utilities for extracting dominant colors from images.
 * Uses ColorThief for raster images and custom parsing for SVGs.
 *
 * @see https://lokeshdhakar.com/projects/color-thief/
 */
import ColorThief from 'colorthief';
import { isSvgDataUrl } from './mimeTypes';

/**
 * Represents a color with RGB values
 */
export interface ExtractedColor {
  hex: string;
  rgb: { r: number; g: number; b: number };
}

/**
 * Options for color extraction
 */
export interface ColorExtractionOptions {
  /** Number of colors to extract for palette (default: 5) */
  colorCount?: number;
  /** Quality setting 1-10, lower = faster but less accurate (default: 10) */
  quality?: number;
}

const defaultOptions: Required<ColorExtractionOptions> = {
  colorCount: 5,
  quality: 10,
};

/**
 * Parse a hex color string to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove # if present and handle shorthand
  const cleanHex = hex.replace('#', '');
  const fullHex = cleanHex.length === 3
    ? cleanHex.split('').map(c => c + c).join('')
    : cleanHex;

  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Convert RGB to hex color string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Parse CSS color values (hex, rgb, rgba, named colors)
 */
export function parseCssColor(color: string): { r: number; g: number; b: number } | null {
  const trimmed = color.trim().toLowerCase();

  // Handle hex colors
  if (trimmed.startsWith('#')) {
    return hexToRgb(trimmed);
  }

  // Handle rgb/rgba
  const rgbMatch = trimmed.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }

  // Handle common named colors
  const namedColors: Record<string, { r: number; g: number; b: number }> = {
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
    red: { r: 255, g: 0, b: 0 },
    green: { r: 0, g: 128, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
    yellow: { r: 255, g: 255, b: 0 },
    cyan: { r: 0, g: 255, b: 255 },
    magenta: { r: 255, g: 0, b: 255 },
    gray: { r: 128, g: 128, b: 128 },
    grey: { r: 128, g: 128, b: 128 },
    orange: { r: 255, g: 165, b: 0 },
    purple: { r: 128, g: 0, b: 128 },
    pink: { r: 255, g: 192, b: 203 },
  };

  if (namedColors[trimmed]) {
    return namedColors[trimmed];
  }

  // For browser environment, use canvas for other named colors
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = trimmed;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return { r, g, b };
      }
    } catch {
      // Canvas not available or color invalid
    }
  }

  return null;
}

/**
 * Check if a color is near white (high brightness, low saturation)
 * Used for filtering out near-white colors from extracted palettes.
 */
export function isNearWhite(r: number, g: number, b: number, threshold = 245): boolean {
  return r > threshold && g > threshold && b > threshold;
}

/**
 * Check if a color is near black.
 * Used for filtering out near-black colors from extracted palettes.
 */
export function isNearBlack(r: number, g: number, b: number, threshold = 15): boolean {
  return r < threshold && g < threshold && b < threshold;
}

/**
 * Extract colors from SVG string by parsing fill and stroke attributes
 */
export function extractColorsFromSvg(svgContent: string): ExtractedColor[] {
  const colorSet = new Set<string>();

  // Match fill and stroke attributes with color values
  const colorPatterns = [
    /fill\s*=\s*["']([^"']+)["']/gi,
    /stroke\s*=\s*["']([^"']+)["']/gi,
    /fill\s*:\s*([^;}"']+)/gi,
    /stroke\s*:\s*([^;}"']+)/gi,
    /stop-color\s*:\s*([^;}"']+)/gi,
    /stop-color\s*=\s*["']([^"']+)["']/gi,
    /background(?:-color)?\s*:\s*([^;}"']+)/gi,
  ];

  for (const pattern of colorPatterns) {
    let match;
    while ((match = pattern.exec(svgContent)) !== null) {
      const colorValue = match[1].trim();

      // Skip 'none', 'transparent', 'inherit', 'currentColor', and url() references
      if (['none', 'transparent', 'inherit', 'currentcolor'].includes(colorValue.toLowerCase()) ||
          colorValue.startsWith('url(')) {
        continue;
      }

      const rgb = parseCssColor(colorValue);
      if (rgb) {
        // Skip near-white and near-black colors for dominant color detection
        if (!isNearWhite(rgb.r, rgb.g, rgb.b) && !isNearBlack(rgb.r, rgb.g, rgb.b)) {
          const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
          colorSet.add(hex);
        }
      }
    }
  }

  // If we filtered out all colors, try again including white/black
  if (colorSet.size === 0) {
    for (const pattern of colorPatterns) {
      let match;
      while ((match = pattern.exec(svgContent)) !== null) {
        const colorValue = match[1].trim();
        if (['none', 'transparent', 'inherit', 'currentcolor'].includes(colorValue.toLowerCase()) ||
            colorValue.startsWith('url(')) {
          continue;
        }
        const rgb = parseCssColor(colorValue);
        if (rgb) {
          const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
          colorSet.add(hex);
        }
      }
    }
  }

  return Array.from(colorSet).map(hex => {
    const rgb = hexToRgb(hex)!;
    return { hex, rgb };
  });
}

/**
 * Load an image from base64 data
 */
function loadImage(base64Data: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = base64Data;
  });
}

/**
 * Extract color palette from a base64-encoded image using ColorThief
 */
export async function extractColorsFromBase64(
  base64Data: string,
  options: ColorExtractionOptions = {}
): Promise<ExtractedColor[]> {
  const opts = { ...defaultOptions, ...options };

  // Check if it's an SVG
  if (isSvgDataUrl(base64Data)) {
    try {
      // Decode base64 SVG content
      const base64Content = base64Data.split(',')[1];
      const svgContent = atob(base64Content);
      const colors = extractColorsFromSvg(svgContent);
      return colors.slice(0, opts.colorCount);
    } catch (error) {
      throw new Error('Failed to parse SVG: ' + (error as Error).message);
    }
  }

  // For raster images, use ColorThief
  const img = await loadImage(base64Data);
  const colorThief = new ColorThief();

  try {
    // Get palette using ColorThief
    const palette = colorThief.getPalette(img, opts.colorCount, opts.quality);

    if (!palette || palette.length === 0) {
      // Fall back to dominant color
      const dominant = colorThief.getColor(img, opts.quality);
      if (dominant) {
        return [{
          hex: rgbToHex(dominant[0], dominant[1], dominant[2]),
          rgb: { r: dominant[0], g: dominant[1], b: dominant[2] },
        }];
      }
      return [];
    }

    return palette.map(([r, g, b]) => ({
      hex: rgbToHex(r, g, b),
      rgb: { r, g, b },
    }));
  } catch (error) {
    throw new Error('Failed to extract colors: ' + (error as Error).message);
  }
}

/**
 * Extract the single most dominant color from an image
 */
export async function extractDominantColor(
  base64Data: string,
  quality = 10
): Promise<ExtractedColor | null> {
  // Check if it's an SVG
  if (isSvgDataUrl(base64Data)) {
    try {
      const base64Content = base64Data.split(',')[1];
      const svgContent = atob(base64Content);
      const colors = extractColorsFromSvg(svgContent);
      return colors[0] || null;
    } catch {
      return null;
    }
  }

  // For raster images, use ColorThief
  try {
    const img = await loadImage(base64Data);
    const colorThief = new ColorThief();
    const dominant = colorThief.getColor(img, quality);

    if (dominant) {
      return {
        hex: rgbToHex(dominant[0], dominant[1], dominant[2]),
        rgb: { r: dominant[0], g: dominant[1], b: dominant[2] },
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get a contrasting text color (black or white) based on background luminance
 */
export function getContrastTextColor(backgroundColor: { r: number; g: number; b: number }): string {
  // Calculate relative luminance using sRGB formula (ITU-R BT.709)
  const luminance = (0.299 * backgroundColor.r + 0.587 * backgroundColor.g + 0.114 * backgroundColor.b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Get a human-readable color name for a hex color
 * Uses color-namer library with ntc (Name That Color) palette
 */
export async function getColorName(hex: string): Promise<string> {
  try {
    const colorNamer = (await import('color-namer')).default;
    const result = colorNamer(hex);
    // Use ntc (Name That Color) palette for best results
    return result.ntc[0]?.name || result.basic[0]?.name || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

/**
 * Get color names for multiple hex colors (batched for efficiency)
 */
export async function getColorNames(hexColors: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  try {
    const colorNamer = (await import('color-namer')).default;
    for (const hex of hexColors) {
      if (hex && hex !== 'inherit') {
        const result = colorNamer(hex);
        names.set(hex, result.ntc[0]?.name || result.basic[0]?.name || 'Unknown');
      }
    }
  } catch {
    // Return empty map on error
  }
  return names;
}
