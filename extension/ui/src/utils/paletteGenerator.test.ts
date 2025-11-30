import { describe, it, expect } from 'vitest';
import {
  rgbToOklch,
  oklchToRgb,
  hexToOklch,
  oklchToHex,
  generatePaletteFromColor,
  HARMONY_TYPES,
  PALETTE_STYLES,
} from './paletteGenerator';
import type { ExtractedColor } from './colorExtractor';

describe('paletteGenerator', () => {
  describe('rgbToOklch', () => {
    it('should convert RGB to OKLCH', () => {
      // Pure red
      const red = rgbToOklch(255, 0, 0);
      expect(red.l).toBeGreaterThan(0.5);
      expect(red.l).toBeLessThan(0.7);
      expect(red.c).toBeGreaterThan(0.2);
      expect(red.h).toBeGreaterThan(20);
      expect(red.h).toBeLessThan(40);

      // Pure green
      const green = rgbToOklch(0, 255, 0);
      expect(green.l).toBeGreaterThan(0.8);
      expect(green.c).toBeGreaterThan(0.25);
      expect(green.h).toBeGreaterThan(130);
      expect(green.h).toBeLessThan(150);

      // Pure blue
      const blue = rgbToOklch(0, 0, 255);
      expect(blue.l).toBeGreaterThan(0.4);
      expect(blue.l).toBeLessThan(0.5);
      expect(blue.c).toBeGreaterThan(0.3);
      expect(blue.h).toBeGreaterThan(260);
      expect(blue.h).toBeLessThan(280);
    });

    it('should convert white to high lightness, low chroma', () => {
      const white = rgbToOklch(255, 255, 255);
      expect(white.l).toBeGreaterThan(0.95);
      expect(white.c).toBeLessThan(0.01);
    });

    it('should convert black to low lightness, low chroma', () => {
      const black = rgbToOklch(0, 0, 0);
      expect(black.l).toBeLessThan(0.05);
      expect(black.c).toBeLessThan(0.01);
    });

    it('should convert Fleet green (#22ad5f)', () => {
      const fleetGreen = rgbToOklch(34, 173, 95);
      expect(fleetGreen.l).toBeGreaterThan(0.6);
      expect(fleetGreen.l).toBeLessThan(0.75);
      expect(fleetGreen.c).toBeGreaterThan(0.1);
      expect(fleetGreen.h).toBeGreaterThan(140);
      expect(fleetGreen.h).toBeLessThan(160);
    });
  });

  describe('oklchToRgb', () => {
    it('should convert OKLCH back to RGB', () => {
      // Test round-trip conversion for various colors
      const testColors = [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 255, b: 0 },
        { r: 0, g: 0, b: 255 },
        { r: 255, g: 255, b: 0 },
        { r: 255, g: 0, b: 255 },
        { r: 0, g: 255, b: 255 },
        { r: 128, g: 128, b: 128 },
        { r: 34, g: 173, b: 95 }, // Fleet green
      ];

      for (const original of testColors) {
        const oklch = rgbToOklch(original.r, original.g, original.b);
        const converted = oklchToRgb(oklch);

        // Allow some rounding error
        expect(Math.abs(converted.r - original.r)).toBeLessThan(3);
        expect(Math.abs(converted.g - original.g)).toBeLessThan(3);
        expect(Math.abs(converted.b - original.b)).toBeLessThan(3);
      }
    });

    it('should clamp values to valid RGB range', () => {
      // High chroma, high lightness (may be out of sRGB gamut)
      const rgb = oklchToRgb({ l: 0.9, c: 0.4, h: 30 });
      expect(rgb.r).toBeGreaterThanOrEqual(0);
      expect(rgb.r).toBeLessThanOrEqual(255);
      expect(rgb.g).toBeGreaterThanOrEqual(0);
      expect(rgb.g).toBeLessThanOrEqual(255);
      expect(rgb.b).toBeGreaterThanOrEqual(0);
      expect(rgb.b).toBeLessThanOrEqual(255);
    });
  });

  describe('hexToOklch', () => {
    it('should convert hex to OKLCH', () => {
      const fleetGreen = hexToOklch('#22ad5f');
      expect(fleetGreen).not.toBeNull();
      expect(fleetGreen!.l).toBeGreaterThan(0.6);
      expect(fleetGreen!.h).toBeGreaterThan(140);
    });

    it('should return null for invalid hex', () => {
      expect(hexToOklch('invalid')).toBeNull();
      expect(hexToOklch('#gg0000')).toBeNull();
    });
  });

  describe('oklchToHex', () => {
    it('should convert OKLCH to hex', () => {
      const oklch = rgbToOklch(34, 173, 95);
      const hex = oklchToHex(oklch);
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i);

      // Should be close to the original
      expect(hex.toLowerCase()).toMatch(/^#2[0-4]a[cd][5-6][def]$/);
    });
  });

  describe('generatePaletteFromColor', () => {
    const fleetGreen: ExtractedColor = {
      hex: '#22ad5f',
      rgb: { r: 34, g: 173, b: 95 },
    };

    it('should generate a complementary palette by default', () => {
      const result = generatePaletteFromColor(fleetGreen);

      expect(result.baseColor).toEqual(fleetGreen);
      expect(result.harmonyType).toBe('complementary');
      expect(result.harmonyColors).toBeDefined();
      expect(result.harmonyColors.length).toBeGreaterThan(0);
      expect(result.harmonyHex).toBeDefined();
      expect(result.harmonyHex.length).toBe(result.harmonyColors.length);
      expect(result.uiPalette).toBeDefined();
    });

    it('should generate analogous palette', () => {
      const result = generatePaletteFromColor(fleetGreen, { harmony: 'analogous' });
      expect(result.harmonyType).toBe('analogous');
      expect(result.harmonyColors.length).toBeGreaterThan(0);
    });

    it('should generate triadic palette', () => {
      const result = generatePaletteFromColor(fleetGreen, { harmony: 'triadic' });
      expect(result.harmonyType).toBe('triadic');
      expect(result.harmonyColors.length).toBeGreaterThan(0);
    });

    it('should generate split complementary palette', () => {
      const result = generatePaletteFromColor(fleetGreen, { harmony: 'splitComplementary' });
      expect(result.harmonyType).toBe('splitComplementary');
      expect(result.harmonyColors.length).toBeGreaterThan(0);
    });

    it('should generate tetradic palette', () => {
      const result = generatePaletteFromColor(fleetGreen, { harmony: 'tetradic' });
      expect(result.harmonyType).toBe('tetradic');
      expect(result.harmonyColors.length).toBeGreaterThan(0);
    });

    it('should generate tints and shades palette', () => {
      const result = generatePaletteFromColor(fleetGreen, { harmony: 'tintsShades' });
      expect(result.harmonyType).toBe('tintsShades');
      expect(result.harmonyColors.length).toBeGreaterThan(0);
    });

    it('should produce valid hex colors in harmony', () => {
      const result = generatePaletteFromColor(fleetGreen);
      for (const hex of result.harmonyHex) {
        expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });

    it('should produce a valid UI palette', () => {
      const result = generatePaletteFromColor(fleetGreen);
      const { uiPalette } = result;

      // Header
      expect(uiPalette.header?.background).toBe('#22ad5f');
      expect(uiPalette.header?.text).toMatch(/^#(000000|ffffff)$/);

      // Body background should be a light color
      expect(uiPalette.body?.background).toMatch(/^#[0-9a-f]{6}$/i);

      // Card
      expect(uiPalette.card?.border).toMatch(/^#[0-9a-f]{6}$/i);
      expect(uiPalette.card?.title).toBeDefined();
    });

    it('should support different palette styles', () => {
      const styles = ['square', 'triangle', 'circle', 'diamond'] as const;
      for (const style of styles) {
        const result = generatePaletteFromColor(fleetGreen, { style });
        expect(result.harmonyColors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('HARMONY_TYPES', () => {
    it('should have all harmony types defined', () => {
      expect(HARMONY_TYPES).toHaveLength(6);

      const values = HARMONY_TYPES.map(t => t.value);
      expect(values).toContain('complementary');
      expect(values).toContain('analogous');
      expect(values).toContain('triadic');
      expect(values).toContain('splitComplementary');
      expect(values).toContain('tetradic');
      expect(values).toContain('tintsShades');
    });

    it('should have labels and descriptions', () => {
      for (const type of HARMONY_TYPES) {
        expect(type.label).toBeDefined();
        expect(type.label.length).toBeGreaterThan(0);
        expect(type.description).toBeDefined();
        expect(type.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('PALETTE_STYLES', () => {
    it('should have all palette styles defined', () => {
      expect(PALETTE_STYLES).toHaveLength(4);

      const values = PALETTE_STYLES.map(s => s.value);
      expect(values).toContain('square');
      expect(values).toContain('triangle');
      expect(values).toContain('circle');
      expect(values).toContain('diamond');
    });

    it('should have labels and descriptions', () => {
      for (const style of PALETTE_STYLES) {
        expect(style.label).toBeDefined();
        expect(style.label.length).toBeGreaterThan(0);
        expect(style.description).toBeDefined();
        expect(style.description.length).toBeGreaterThan(0);
      }
    });
  });
});
