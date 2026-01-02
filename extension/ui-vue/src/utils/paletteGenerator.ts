/**
 * Palette generation utilities using pro-color-harmonies.
 * Generates harmonious color palettes from a base color extracted from an icon.
 */
import {
  ColorPaletteGenerator,
  type OKLCH,
  type PaletteType,
  type PaletteStyle,
  type GeneratorOptions,
} from 'pro-color-harmonies';
import type { ColorPalette } from '../types/palette';
import {
  type ExtractedColor,
  extractDominantColor,
  getContrastTextColor,
  hexToRgb,
  rgbToHex,
} from './colorExtractor';

/**
 * Available harmony types for palette generation
 */
export type HarmonyType = PaletteType;

/**
 * Palette generation options
 */
export interface PaletteGeneratorOptions {
  harmony?: HarmonyType;
  style?: PaletteStyle;
}

const defaultGeneratorOptions: Required<PaletteGeneratorOptions> = {
  harmony: 'complementary',
  style: 'triangle',
};

/**
 * Convert RGB to OKLCH color space
 */
export function rgbToOklch(r: number, g: number, b: number): OKLCH {
  // Normalize RGB to 0-1
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  // Convert sRGB to linear RGB
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const rLin = toLinear(rNorm);
  const gLin = toLinear(gNorm);
  const bLin = toLinear(bNorm);

  // Linear RGB to XYZ (D65 illuminant)
  const x = 0.4124564 * rLin + 0.3575761 * gLin + 0.1804375 * bLin;
  const y = 0.2126729 * rLin + 0.7151522 * gLin + 0.0721750 * bLin;
  const z = 0.0193339 * rLin + 0.1191920 * gLin + 0.9503041 * bLin;

  // XYZ to LMS
  const l = 0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z;
  const m = 0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z;
  const s = 0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z;

  // LMS to OKLAB (via cube root)
  const lPrime = Math.cbrt(l);
  const mPrime = Math.cbrt(m);
  const sPrime = Math.cbrt(s);

  const L = 0.2104542553 * lPrime + 0.7936177850 * mPrime - 0.0040720468 * sPrime;
  const a = 1.9779984951 * lPrime - 2.4285922050 * mPrime + 0.4505937099 * sPrime;
  const bOklab = 0.0259040371 * lPrime + 0.7827717662 * mPrime - 0.8086757660 * sPrime;

  // OKLAB to OKLCH
  const c = Math.sqrt(a * a + bOklab * bOklab);
  let h = Math.atan2(bOklab, a) * (180 / Math.PI);
  if (h < 0) h += 360;

  return { l: L, c, h };
}

/**
 * Convert OKLCH to RGB color space
 */
export function oklchToRgb(oklch: OKLCH): { r: number; g: number; b: number } {
  const { l: L, c, h } = oklch;

  // OKLCH to OKLAB
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const bOklab = c * Math.sin(hRad);

  // OKLAB to LMS (cube)
  const lPrime = L + 0.3963377774 * a + 0.2158037573 * bOklab;
  const mPrime = L - 0.1055613458 * a - 0.0638541728 * bOklab;
  const sPrime = L - 0.0894841775 * a - 1.2914855480 * bOklab;

  const l = lPrime * lPrime * lPrime;
  const m = mPrime * mPrime * mPrime;
  const s = sPrime * sPrime * sPrime;

  // LMS to XYZ
  const x = 1.2270138511 * l - 0.5577999807 * m + 0.2812561490 * s;
  const y = -0.0405801784 * l + 1.1122568696 * m - 0.0716766787 * s;
  const z = -0.0763812845 * l - 0.4214819784 * m + 1.5861632204 * s;

  // XYZ to linear RGB
  const rLin = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const gLin = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z;
  const bLin = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;

  // Linear RGB to sRGB
  const toSrgb = (c: number) =>
    c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

  const r = Math.round(Math.max(0, Math.min(255, toSrgb(rLin) * 255)));
  const g = Math.round(Math.max(0, Math.min(255, toSrgb(gLin) * 255)));
  const b = Math.round(Math.max(0, Math.min(255, toSrgb(bLin) * 255)));

  return { r, g, b };
}

/**
 * Convert hex color to OKLCH
 */
export function hexToOklch(hex: string): OKLCH | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToOklch(rgb.r, rgb.g, rgb.b);
}

/**
 * Convert OKLCH to hex color
 */
export function oklchToHex(oklch: OKLCH): string {
  const { r, g, b } = oklchToRgb(oklch);
  return rgbToHex(r, g, b);
}

/**
 * Result of palette generation
 */
export interface GeneratedPalette {
  baseColor: ExtractedColor;
  harmonyColors: OKLCH[];
  harmonyHex: string[];
  harmonyType: HarmonyType;
  uiPalette: ColorPalette;
}

/**
 * Check if a harmony type should use higher chroma values
 */
export function isHighChromaHarmony(harmonyType: HarmonyType): boolean {
  return harmonyType === 'triadic' || harmonyType === 'tintsShades';
}

/**
 * Build a ColorPalette suitable for the Fleet extension UI from harmony colors
 */
export function buildUiPalette(
  baseColor: ExtractedColor,
  harmonyColors: OKLCH[],
  harmonyType: HarmonyType
): ColorPalette {
  const headerBackground = baseColor.hex;
  const headerText = getContrastTextColor(baseColor.rgb);

  const accentColor = harmonyColors.length > 1 ? harmonyColors[1] : harmonyColors[0];
  const secondaryColor = harmonyColors.length > 2 ? harmonyColors[2] : accentColor;

  const highChroma = isHighChromaHarmony(harmonyType);
  const bodyChromaCap = highChroma ? 0.12 : 0.05;
  const borderChromaCap = highChroma ? 0.18 : 0.07;
  const titleChromaCap = highChroma ? 0.35 : 0.18;
  const titleLightness = highChroma ? 0.35 : 0.45;

  // Light tint for body background
  const lightTint: OKLCH = {
    l: 0.96,
    c: Math.min(accentColor.c * 0.15, bodyChromaCap),
    h: accentColor.h,
  };
  const bodyBackground = oklchToHex(lightTint);

  // Mid-tone for card border
  const borderTint: OKLCH = {
    l: 0.82,
    c: Math.min(accentColor.c * 0.25, borderChromaCap),
    h: accentColor.h,
  };
  const cardBorder = oklchToHex(borderTint);

  // Medium-dark for card title
  let cardTitle = 'inherit';
  if (harmonyColors.length > 1) {
    const titleColor: OKLCH = {
      l: titleLightness,
      c: Math.min(secondaryColor.c, titleChromaCap),
      h: secondaryColor.h,
    };
    cardTitle = oklchToHex(titleColor);
  }

  return {
    header: {
      background: headerBackground,
      text: headerText,
    },
    body: {
      background: bodyBackground,
    },
    card: {
      border: cardBorder,
      title: cardTitle,
    },
  };
}

/**
 * Generate a color palette from a base color using pro-color-harmonies
 */
export function generatePaletteFromColor(
  baseColor: ExtractedColor,
  options: PaletteGeneratorOptions = {}
): GeneratedPalette {
  const opts = { ...defaultGeneratorOptions, ...options };

  const oklch = rgbToOklch(baseColor.rgb.r, baseColor.rgb.g, baseColor.rgb.b);

  const generatorOptions: GeneratorOptions = {
    style: opts.style,
  };

  const harmonyColors = ColorPaletteGenerator.generate(oklch, opts.harmony, generatorOptions);
  const harmonyHex = harmonyColors.map(oklchToHex);

  const uiPalette = buildUiPalette(baseColor, harmonyColors, opts.harmony);

  return {
    baseColor,
    harmonyColors,
    harmonyHex,
    harmonyType: opts.harmony,
    uiPalette,
  };
}

/**
 * Generate a palette directly from a base64 image
 */
export async function generatePaletteFromImage(
  base64Data: string,
  options: PaletteGeneratorOptions = {}
): Promise<GeneratedPalette | null> {
  const dominantColor = await extractDominantColor(base64Data);
  if (!dominantColor) {
    return null;
  }

  return generatePaletteFromColor(dominantColor, options);
}

/**
 * Generate all palette variations from an image
 */
export async function generateAllPalettesFromImage(
  base64Data: string,
  style: PaletteStyle = 'triangle'
): Promise<Map<HarmonyType, GeneratedPalette> | null> {
  const dominantColor = await extractDominantColor(base64Data);
  if (!dominantColor) {
    return null;
  }

  const harmonyTypes: HarmonyType[] = [
    'analogous',
    'complementary',
    'triadic',
    'tetradic',
    'splitComplementary',
    'tintsShades',
  ];

  const palettes = new Map<HarmonyType, GeneratedPalette>();

  for (const harmony of harmonyTypes) {
    const palette = generatePaletteFromColor(dominantColor, { harmony, style });
    palettes.set(harmony, palette);
  }

  return palettes;
}

/**
 * Available harmony types for UI selection
 */
export const HARMONY_TYPES: { value: HarmonyType; label: string; description: string }[] = [
  {
    value: 'complementary',
    label: 'Complementary',
    description: 'High contrast with opposite hue - bold and vibrant',
  },
  {
    value: 'analogous',
    label: 'Analogous',
    description: 'Adjacent colors - harmonious and cohesive',
  },
  {
    value: 'triadic',
    label: 'Triadic',
    description: 'Three evenly spaced colors - balanced and vibrant',
  },
  {
    value: 'splitComplementary',
    label: 'Split Complementary',
    description: 'Base + two colors around the complement - high contrast, less tension',
  },
  {
    value: 'tetradic',
    label: 'Tetradic',
    description: 'Four-color scheme - rich and complex',
  },
  {
    value: 'tintsShades',
    label: 'Tints & Shades',
    description: 'Single hue with lightness variations - monochromatic elegance',
  },
];
