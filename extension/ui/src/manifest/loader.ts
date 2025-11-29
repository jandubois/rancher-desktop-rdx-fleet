import yaml from 'js-yaml';
import { Manifest, DEFAULT_MANIFEST } from './types';

// Load manifest from manifest.yaml or use default
export async function loadManifest(): Promise<Manifest> {
  try {
    // Try to fetch manifest.yaml from the extension's static files
    // Use relative path to work with vite's base: './' configuration
    const response = await fetch('./manifest.yaml');
    if (!response.ok) {
      return DEFAULT_MANIFEST;
    }

    const text = await response.text();
    const manifest = yaml.load(text) as Partial<Manifest>;

    // Validate and merge with defaults
    return mergeWithDefaults(manifest);
  } catch (err) {
    console.warn('[Manifest] Failed to load manifest, using default:', err);
    return DEFAULT_MANIFEST;
  }
}

// Merge loaded manifest with defaults (permissive parsing)
function mergeWithDefaults(loaded: Partial<Manifest>): Manifest {
  const manifest: Manifest = {
    version: loaded.version || DEFAULT_MANIFEST.version,
    app: {
      name: loaded.app?.name || DEFAULT_MANIFEST.app?.name || 'Fleet GitOps',
      icon: loaded.app?.icon || DEFAULT_MANIFEST.app?.icon,
      description: loaded.app?.description || DEFAULT_MANIFEST.app?.description,
    },
    branding: {
      ...loaded.branding,
    },
    layout: {
      ...DEFAULT_MANIFEST.layout,
      ...loaded.layout,
    },
    cards: loaded.cards && loaded.cards.length > 0 ? loaded.cards : DEFAULT_MANIFEST.cards,
  };

  return manifest;
}

export { DEFAULT_MANIFEST };
