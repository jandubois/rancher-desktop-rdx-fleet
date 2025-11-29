import { useMemo } from 'react';
import { Manifest } from '../manifest';
import { resolvePalette, defaultPalette } from '../theme';

/**
 * Hook that returns the resolved color palette from a manifest.
 * Falls back to default palette values for any undefined colors.
 */
export function usePalette(manifest: Manifest | null | undefined) {
  const palette = manifest?.branding?.palette;
  return useMemo(() => {
    if (!palette) {
      return defaultPalette;
    }
    return resolvePalette(palette);
  }, [palette]);
}
