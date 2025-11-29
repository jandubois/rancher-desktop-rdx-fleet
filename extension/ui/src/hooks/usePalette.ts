import { useMemo } from 'react';
import { Manifest } from '../manifest';
import { resolvePalette, defaultPalette } from '../theme';

/**
 * Hook that returns the resolved color palette from a manifest.
 * Falls back to default palette values for any undefined colors.
 */
export function usePalette(manifest: Manifest | null | undefined) {
  return useMemo(() => {
    if (!manifest?.branding?.palette) {
      return defaultPalette;
    }
    return resolvePalette(manifest.branding.palette);
  }, [manifest?.branding?.palette]);
}
