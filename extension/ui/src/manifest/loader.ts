import { Manifest, DEFAULT_MANIFEST } from './types';

// Load manifest from manifest.yaml or use default
export async function loadManifest(): Promise<Manifest> {
  try {
    // Try to fetch manifest.yaml from the extension's static files
    // Use relative path to work with vite's base: './' configuration
    const url = new URL('./manifest.yaml', window.location.href).href;
    console.log('[Manifest] Fetching from:', url);
    const response = await fetch('./manifest.yaml');
    console.log('[Manifest] Response status:', response.status, response.statusText);
    if (!response.ok) {
      console.log('[Manifest] No custom manifest found, using default');
      return DEFAULT_MANIFEST;
    }

    const text = await response.text();
    console.log('[Manifest] Raw YAML text:', text.substring(0, 200) + '...');
    const manifest = parseYaml(text);
    console.log('[Manifest] Parsed manifest:', JSON.stringify(manifest, null, 2));

    // Validate and merge with defaults
    return mergeWithDefaults(manifest);
  } catch (err) {
    console.warn('[Manifest] Failed to load manifest, using default:', err);
    return DEFAULT_MANIFEST;
  }
}

// Simple YAML parser for manifest files
// Supports basic YAML structure needed for manifests
function parseYaml(text: string): Partial<Manifest> {
  const result: Record<string, unknown> = {};
  const lines = text.split('\n');
  const stack: { indent: number; obj: Record<string, unknown>; key?: string }[] = [
    { indent: -1, obj: result },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) continue;

    // Calculate indent
    const indent = line.search(/\S/);
    if (indent === -1) continue;

    const content = line.trim();

    // Handle list items
    if (content.startsWith('- ')) {
      const listContent = content.slice(2).trim();

      // Find parent
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      const parent = stack[stack.length - 1];
      const parentKey = parent.key;

      if (parentKey && parent.obj[parentKey] === undefined) {
        parent.obj[parentKey] = [];
      }

      if (parentKey && Array.isArray(parent.obj[parentKey])) {
        if (listContent.includes(':')) {
          // Object in list
          const obj: Record<string, unknown> = {};
          const [key, value] = parseKeyValue(listContent);
          if (value !== undefined) {
            obj[key] = value;
          }
          (parent.obj[parentKey] as unknown[]).push(obj);
          stack.push({ indent, obj, key: undefined });
        } else {
          // Simple value in list
          (parent.obj[parentKey] as unknown[]).push(parseValue(listContent));
        }
      }
      continue;
    }

    // Handle key: value
    if (content.includes(':')) {
      const [key, value] = parseKeyValue(content);

      // Pop stack until we find appropriate parent
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      const parent = stack[stack.length - 1];

      if (value !== undefined) {
        // Simple key: value
        parent.obj[key] = value;
      } else {
        // Key for nested object
        parent.obj[key] = {};
        stack.push({ indent, obj: parent.obj[key] as Record<string, unknown>, key });
      }
    }
  }

  return result as Partial<Manifest>;
}

function parseKeyValue(content: string): [string, unknown | undefined] {
  const colonIndex = content.indexOf(':');
  if (colonIndex === -1) return [content, undefined];

  const key = content.slice(0, colonIndex).trim();
  const valueStr = content.slice(colonIndex + 1).trim();

  if (!valueStr) return [key, undefined];

  return [key, parseValue(valueStr)];
}

function parseValue(str: string): unknown {
  // Handle multiline strings (|)
  if (str === '|') return str;

  // Handle quoted strings
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }

  // Handle booleans
  if (str === 'true') return true;
  if (str === 'false') return false;

  // Handle numbers
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    return parseFloat(str);
  }

  return str;
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

  // Log warnings for unknown fields
  const knownTopLevel = ['version', 'app', 'branding', 'layout', 'cards'];
  for (const key of Object.keys(loaded)) {
    if (!knownTopLevel.includes(key)) {
      console.warn(`[Manifest] Unknown field ignored: ${key}`);
    }
  }

  return manifest;
}

export { DEFAULT_MANIFEST };
