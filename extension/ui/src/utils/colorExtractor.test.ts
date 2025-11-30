import { describe, it, expect } from 'vitest';
import {
  hexToRgb,
  rgbToHex,
  parseCssColor,
  extractColorsFromSvg,
  getContrastTextColor,
} from './colorExtractor';

describe('colorExtractor', () => {
  describe('hexToRgb', () => {
    it('should parse 6-digit hex colors', () => {
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
      expect(hexToRgb('#22ad5f')).toEqual({ r: 34, g: 173, b: 95 });
    });

    it('should parse 3-digit hex colors', () => {
      expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#0f0')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#00f')).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('should handle hex without # prefix', () => {
      expect(hexToRgb('ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('f00')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should be case-insensitive', () => {
      expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#Ff00FF')).toEqual({ r: 255, g: 0, b: 255 });
    });

    it('should return null for invalid hex', () => {
      expect(hexToRgb('#gg0000')).toBeNull();
      expect(hexToRgb('invalid')).toBeNull();
      expect(hexToRgb('#12345')).toBeNull();
    });
  });

  describe('rgbToHex', () => {
    it('should convert RGB to hex', () => {
      expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
      expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
      expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
      expect(rgbToHex(34, 173, 95)).toBe('#22ad5f');
    });

    it('should pad single digit values', () => {
      expect(rgbToHex(0, 0, 0)).toBe('#000000');
      expect(rgbToHex(15, 15, 15)).toBe('#0f0f0f');
    });

    it('should clamp out-of-range values', () => {
      expect(rgbToHex(300, 0, 0)).toBe('#ff0000');
      expect(rgbToHex(-10, 0, 0)).toBe('#000000');
    });

    it('should round floating point values', () => {
      expect(rgbToHex(255.4, 0.6, 127.5)).toBe('#ff0180');
    });
  });

  describe('parseCssColor', () => {
    it('should parse hex colors', () => {
      expect(parseCssColor('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(parseCssColor('#f00')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should parse rgb() syntax', () => {
      expect(parseCssColor('rgb(255, 0, 0)')).toEqual({ r: 255, g: 0, b: 0 });
      expect(parseCssColor('rgb(0,255,0)')).toEqual({ r: 0, g: 255, b: 0 });
    });

    it('should parse rgba() syntax', () => {
      expect(parseCssColor('rgba(255, 0, 0, 0.5)')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should parse common named colors', () => {
      expect(parseCssColor('white')).toEqual({ r: 255, g: 255, b: 255 });
      expect(parseCssColor('black')).toEqual({ r: 0, g: 0, b: 0 });
      expect(parseCssColor('red')).toEqual({ r: 255, g: 0, b: 0 });
      expect(parseCssColor('green')).toEqual({ r: 0, g: 128, b: 0 });
      expect(parseCssColor('blue')).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('should be case-insensitive for named colors', () => {
      expect(parseCssColor('WHITE')).toEqual({ r: 255, g: 255, b: 255 });
      expect(parseCssColor('Red')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should trim whitespace', () => {
      expect(parseCssColor('  #ff0000  ')).toEqual({ r: 255, g: 0, b: 0 });
      expect(parseCssColor('  white  ')).toEqual({ r: 255, g: 255, b: 255 });
    });
  });

  describe('extractColorsFromSvg', () => {
    it('should extract fill colors from SVG', () => {
      const svg = '<svg><rect fill="#22ad5f" width="100" height="100"/></svg>';
      const colors = extractColorsFromSvg(svg);
      expect(colors).toHaveLength(1);
      expect(colors[0].hex).toBe('#22ad5f');
    });

    it('should extract multiple colors', () => {
      const svg = `
        <svg>
          <rect fill="#22ad5f" width="100" height="100"/>
          <path fill="#ff0000" d="M0,0"/>
          <circle stroke="#0000ff" fill="none"/>
        </svg>
      `;
      const colors = extractColorsFromSvg(svg);
      expect(colors.length).toBeGreaterThanOrEqual(2);
      const hexValues = colors.map(c => c.hex);
      expect(hexValues).toContain('#22ad5f');
      expect(hexValues).toContain('#ff0000');
    });

    it('should extract colors from style attributes', () => {
      const svg = '<svg><rect style="fill: #22ad5f; stroke: #000000;"/></svg>';
      const colors = extractColorsFromSvg(svg);
      const hexValues = colors.map(c => c.hex);
      expect(hexValues).toContain('#22ad5f');
    });

    it('should ignore none and transparent', () => {
      const svg = `
        <svg>
          <rect fill="none"/>
          <path fill="transparent"/>
          <circle fill="#22ad5f"/>
        </svg>
      `;
      const colors = extractColorsFromSvg(svg);
      expect(colors).toHaveLength(1);
      expect(colors[0].hex).toBe('#22ad5f');
    });

    it('should ignore url() references', () => {
      const svg = `
        <svg>
          <rect fill="url(#gradient1)"/>
          <circle fill="#22ad5f"/>
        </svg>
      `;
      const colors = extractColorsFromSvg(svg);
      expect(colors).toHaveLength(1);
      expect(colors[0].hex).toBe('#22ad5f');
    });

    it('should skip near-white colors by default', () => {
      const svg = `
        <svg>
          <rect fill="#ffffff"/>
          <path fill="#22ad5f"/>
        </svg>
      `;
      const colors = extractColorsFromSvg(svg);
      expect(colors).toHaveLength(1);
      expect(colors[0].hex).toBe('#22ad5f');
    });

    it('should extract gradient stop colors', () => {
      const svg = `
        <svg>
          <linearGradient id="grad1">
            <stop offset="0%" stop-color="#ff0000"/>
            <stop offset="100%" stop-color="#00ff00"/>
          </linearGradient>
        </svg>
      `;
      const colors = extractColorsFromSvg(svg);
      const hexValues = colors.map(c => c.hex);
      expect(hexValues).toContain('#ff0000');
      expect(hexValues).toContain('#00ff00');
    });

    it('should handle the fleet icon SVG', () => {
      const fleetIconSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <rect fill="#22ad5f" width="100" height="100" rx="10"/>
          <g transform="translate(5, 10) scale(0.66)">
            <path fill="#fff" d="M108.734..."/>
          </g>
        </svg>
      `;
      const colors = extractColorsFromSvg(fleetIconSvg);
      expect(colors.length).toBeGreaterThanOrEqual(1);
      expect(colors[0].hex).toBe('#22ad5f');
    });

    it('should return empty array for SVG with no colors', () => {
      const svg = '<svg><rect/></svg>';
      const colors = extractColorsFromSvg(svg);
      expect(colors).toHaveLength(0);
    });
  });

  describe('getContrastTextColor', () => {
    it('should return black for light backgrounds', () => {
      expect(getContrastTextColor({ r: 255, g: 255, b: 255 })).toBe('#000000');
      expect(getContrastTextColor({ r: 200, g: 200, b: 200 })).toBe('#000000');
      expect(getContrastTextColor({ r: 255, g: 255, b: 0 })).toBe('#000000');
    });

    it('should return white for dark backgrounds', () => {
      expect(getContrastTextColor({ r: 0, g: 0, b: 0 })).toBe('#ffffff');
      expect(getContrastTextColor({ r: 50, g: 50, b: 50 })).toBe('#ffffff');
      expect(getContrastTextColor({ r: 34, g: 173, b: 95 })).toBe('#ffffff'); // Fleet green luminance ~0.48
    });

    it('should use luminance-based calculation', () => {
      // Red has lower luminance weight (0.299) so needs to be brighter
      expect(getContrastTextColor({ r: 255, g: 0, b: 0 })).toBe('#ffffff');
      // Green has higher luminance weight (0.587)
      expect(getContrastTextColor({ r: 0, g: 255, b: 0 })).toBe('#000000');
      // Blue has lowest luminance weight (0.114)
      expect(getContrastTextColor({ r: 0, g: 0, b: 255 })).toBe('#ffffff');
    });
  });
});
