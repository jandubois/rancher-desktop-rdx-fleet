// Extension state persistence using browser localStorage
// Uses the full extension image name as key to support multiple Fleet extensions

import type { Manifest, CardDefinition } from '../manifest';
import type { IconState } from '../components/EditableHeaderIcon';
import { detectCurrentExtensionImage } from './extensionBuilder';

// Default icon height in pixels
export const DEFAULT_ICON_HEIGHT = 40;
// Maximum icon height (fills header with minimal margins)
export const MAX_ICON_HEIGHT = 120;
// Minimum icon height
export const MIN_ICON_HEIGHT = 24;

// State that should be persisted across extension switching
export interface PersistedExtensionState {
  manifest: Manifest;
  manifestCards: CardDefinition[];
  cardOrder: string[];
  dynamicCardTitles: Record<string, string>;
  iconState: IconState;
  iconHeight?: number;  // Custom icon height in pixels
  timestamp: number;  // For debugging/versioning
}

// Storage key prefix
const STORAGE_KEY_PREFIX = 'fleet-extension-state:';

/**
 * Get the localStorage key for a given extension image name
 */
export function getStorageKey(extensionImage: string | null): string {
  return `${STORAGE_KEY_PREFIX}${extensionImage || 'default'}`;
}

/**
 * Get the storage key for the current extension
 */
export function getCurrentStorageKey(): string {
  const extensionImage = detectCurrentExtensionImage();
  return getStorageKey(extensionImage);
}

/**
 * Save extension state to localStorage
 */
export function saveExtensionState(state: PersistedExtensionState): void {
  const key = getCurrentStorageKey();
  try {
    const stateWithTimestamp = {
      ...state,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(stateWithTimestamp));
  } catch (e) {
    console.error('[ExtensionState] Failed to save state:', e);
  }
}

/**
 * Load extension state from localStorage
 * Returns null if no state exists or if parsing fails
 */
export function loadExtensionState(): PersistedExtensionState | null {
  const key = getCurrentStorageKey();
  try {
    const stored = localStorage.getItem(key);
    if (!stored) {
      return null;
    }
    const parsed = JSON.parse(stored) as PersistedExtensionState;
    // Basic validation - ensure required fields exist
    if (!parsed.manifest || !Array.isArray(parsed.manifestCards) || !Array.isArray(parsed.cardOrder)) {
      console.warn('[ExtensionState] Invalid stored state, ignoring');
      return null;
    }
    return parsed;
  } catch (e) {
    console.error('[ExtensionState] Failed to load state:', e);
    return null;
  }
}

/**
 * Clear stored state for the current extension
 */
export function clearExtensionState(): void {
  const key = getCurrentStorageKey();
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error('[ExtensionState] Failed to clear state:', e);
  }
}

/**
 * Clear stored state for a specific extension image
 */
export function clearExtensionStateForImage(extensionImage: string): void {
  const key = getStorageKey(extensionImage);
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error('[ExtensionState] Failed to clear state for image:', e);
  }
}
