import { describe, it, expect } from 'vitest';
import { resolvePalette, defaultPalette, ColorPalette } from './palette';

describe('resolvePalette', () => {
  it('returns default palette when no palette is provided', () => {
    const result = resolvePalette(undefined);
    expect(result).toEqual(defaultPalette);
  });

  it('returns default palette when empty palette is provided', () => {
    const result = resolvePalette({});
    expect(result).toEqual(defaultPalette);
  });

  it('merges header background with defaults', () => {
    const palette: ColorPalette = {
      header: { background: '#ff0000' },
    };
    const result = resolvePalette(palette);

    expect(result.header.background).toBe('#ff0000');
    expect(result.header.text).toBe(defaultPalette.header.text);
    expect(result.body.background).toBe(defaultPalette.body.background);
    expect(result.card.border).toBe(defaultPalette.card.border);
  });

  it('merges header text with defaults', () => {
    const palette: ColorPalette = {
      header: { text: '#000000' },
    };
    const result = resolvePalette(palette);

    expect(result.header.background).toBe(defaultPalette.header.background);
    expect(result.header.text).toBe('#000000');
  });

  it('merges body background with defaults', () => {
    const palette: ColorPalette = {
      body: { background: '#eeeeee' },
    };
    const result = resolvePalette(palette);

    expect(result.body.background).toBe('#eeeeee');
    expect(result.header.background).toBe(defaultPalette.header.background);
  });

  it('merges card colors with defaults', () => {
    const palette: ColorPalette = {
      card: { border: '#cccccc', title: '#333333' },
    };
    const result = resolvePalette(palette);

    expect(result.card.border).toBe('#cccccc');
    expect(result.card.title).toBe('#333333');
  });

  it('handles partial card colors', () => {
    const palette: ColorPalette = {
      card: { border: '#aaaaaa' },
    };
    const result = resolvePalette(palette);

    expect(result.card.border).toBe('#aaaaaa');
    expect(result.card.title).toBe(defaultPalette.card.title);
  });

  it('merges all sections together', () => {
    const palette: ColorPalette = {
      header: { background: '#111111', text: '#222222' },
      body: { background: '#333333' },
      card: { border: '#444444', title: '#555555' },
    };
    const result = resolvePalette(palette);

    expect(result).toEqual({
      header: { background: '#111111', text: '#222222' },
      body: { background: '#333333' },
      card: { border: '#444444', title: '#555555' },
    });
  });
});

describe('defaultPalette', () => {
  it('has valid default values', () => {
    expect(defaultPalette.header.background).toBe('#1976d2');
    expect(defaultPalette.header.text).toBe('#ffffff');
    expect(defaultPalette.body.background).toBe('#fafafa');
    expect(defaultPalette.card.border).toBe('#e0e0e0');
    expect(defaultPalette.card.title).toBe('inherit');
  });
});
