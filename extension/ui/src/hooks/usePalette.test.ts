import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePalette } from './usePalette';
import { Manifest, DEFAULT_MANIFEST } from '../manifest';
import { defaultPalette } from '../theme';

describe('usePalette', () => {
  it('returns default palette when manifest is null', () => {
    const { result } = renderHook(() => usePalette(null));
    expect(result.current).toEqual(defaultPalette);
  });

  it('returns default palette when manifest is undefined', () => {
    const { result } = renderHook(() => usePalette(undefined));
    expect(result.current).toEqual(defaultPalette);
  });

  it('returns default palette when manifest has no branding', () => {
    const manifest: Manifest = {
      ...DEFAULT_MANIFEST,
      branding: undefined,
    };
    const { result } = renderHook(() => usePalette(manifest));
    expect(result.current).toEqual(defaultPalette);
  });

  it('returns default palette when branding has no palette', () => {
    const manifest: Manifest = {
      ...DEFAULT_MANIFEST,
      branding: { logo: 'test.png' },
    };
    const { result } = renderHook(() => usePalette(manifest));
    expect(result.current).toEqual(defaultPalette);
  });

  it('returns custom palette when manifest has palette', () => {
    const manifest: Manifest = {
      ...DEFAULT_MANIFEST,
      branding: {
        palette: {
          header: { background: '#ff0000' },
        },
      },
    };
    const { result } = renderHook(() => usePalette(manifest));

    expect(result.current.header.background).toBe('#ff0000');
    expect(result.current.header.text).toBe(defaultPalette.header.text);
  });

  it('memoizes the result for the same palette', () => {
    const manifest: Manifest = {
      ...DEFAULT_MANIFEST,
      branding: {
        palette: {
          header: { background: '#ff0000' },
        },
      },
    };

    const { result, rerender } = renderHook(() => usePalette(manifest));
    const firstResult = result.current;

    rerender();
    const secondResult = result.current;

    expect(firstResult).toBe(secondResult);
  });
});
