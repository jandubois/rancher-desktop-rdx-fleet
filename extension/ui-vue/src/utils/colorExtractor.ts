/**
 * Color extraction utilities.
 * Extracts dominant colors from images for palette generation.
 */

export interface ExtractedColor {
  hex: string;
  rgb: { r: number; g: number; b: number };
  population: number;
}

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Get contrast text color (black or white) for a given background
 */
export function getContrastTextColor(rgb: { r: number; g: number; b: number }): string {
  // Calculate relative luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Load an image from base64 data
 */
async function loadImage(base64Data: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;

    // Handle both raw base64 and data URLs
    if (base64Data.startsWith('data:')) {
      img.src = base64Data;
    } else {
      img.src = `data:image/png;base64,${base64Data}`;
    }
  });
}

/**
 * Extract colors from an image using canvas
 */
export async function extractColorsFromBase64(base64Data: string): Promise<ExtractedColor[]> {
  try {
    const img = await loadImage(base64Data);

    // Create canvas and draw image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    // Scale down for performance
    const maxSize = 100;
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // Simple color quantization - collect colors and count occurrences
    const colorCounts = new Map<string, { r: number; g: number; b: number; count: number }>();

    for (let i = 0; i < pixels.length; i += 4) {
      const r = Math.round(pixels[i] / 16) * 16;
      const g = Math.round(pixels[i + 1] / 16) * 16;
      const b = Math.round(pixels[i + 2] / 16) * 16;
      const a = pixels[i + 3];

      // Skip transparent pixels
      if (a < 128) continue;

      const key = `${r},${g},${b}`;
      const existing = colorCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        colorCounts.set(key, { r, g, b, count: 1 });
      }
    }

    // Sort by population and take top colors
    const sorted = Array.from(colorCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return sorted.map(c => ({
      hex: rgbToHex(c.r, c.g, c.b),
      rgb: { r: c.r, g: c.g, b: c.b },
      population: c.count,
    }));
  } catch (error) {
    console.error('Failed to extract colors:', error);
    return [];
  }
}

/**
 * Extract dominant color from an image
 */
export async function extractDominantColor(base64Data: string): Promise<ExtractedColor | null> {
  const colors = await extractColorsFromBase64(base64Data);

  // Filter out very dark, very light, and grayish colors
  const vibrantColors = colors.filter(c => {
    const { r, g, b } = c.rgb;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const saturation = Math.max(r, g, b) - Math.min(r, g, b);

    // Keep colors that are somewhat saturated and not too dark/light
    return saturation > 30 && luminance > 0.1 && luminance < 0.9;
  });

  // Return most vibrant color, or first color if no vibrant ones
  return vibrantColors[0] || colors[0] || null;
}
