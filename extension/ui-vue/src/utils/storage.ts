/**
 * Extension state persistence - matches React version exactly.
 * Uses the same localStorage keys and format for seamless switching.
 */

import { ddClient } from '../lib/ddClient';
import type { Manifest, CardDefinition } from '../types/manifest';

// ============================================
// Types - must match React exactly
// ============================================

export interface CustomIcon {
  data: string;
  filename: string;
  mimeType: string;
}

export type IconState = CustomIcon | null | 'deleted';

export interface EditModeSnapshot {
  manifest: Manifest;
  manifestCards: CardDefinition[];
  cardOrder: string[];
  iconState: IconState;
  iconHeight: number;
  dynamicCardTitles: Record<string, string>;
}

export interface PersistedExtensionState {
  manifest: Manifest;
  manifestCards: CardDefinition[];
  cardOrder: string[];
  dynamicCardTitles: Record<string, string>;
  iconState: IconState;
  iconHeight?: number;
  editMode?: boolean;
  editModeSnapshot?: EditModeSnapshot | null;
  activeEditTab?: number;
  timestamp: number;
}

export interface RepoConfig {
  name: string;
  repo: string;
  branch?: string;
  paths: string[];
}

// ============================================
// Constants - match React exactly
// ============================================

export const DEFAULT_ICON_HEIGHT = 40;
export const MAX_ICON_HEIGHT = 120;
export const MIN_ICON_HEIGHT = 24;

const STORAGE_KEY_PREFIX = 'fleet-extension-state:';
const AUTH_COLLAPSED_PREFIX = 'auth-card-collapsed-';
const GITREPO_CONFIGS_KEY = 'fleet-gitrepo-configs';
const FRAMEWORK_KEY = 'fleet-ui-framework';

// ============================================
// Extension Image Detection
// ============================================

export function detectCurrentExtensionImage(): string | null {
  const ext = ddClient.extension as { image?: string };
  return ext.image || null;
}

export function getStorageKey(extensionImage: string | null): string {
  return `${STORAGE_KEY_PREFIX}${extensionImage || 'default'}`;
}

export function getCurrentStorageKey(): string {
  const extensionImage = detectCurrentExtensionImage();
  return getStorageKey(extensionImage);
}

// ============================================
// Main Extension State
// ============================================

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

export function clearExtensionState(): void {
  const key = getCurrentStorageKey();
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error('[ExtensionState] Failed to clear state:', e);
  }
}

// ============================================
// Auth Card Collapse State
// ============================================

export function getAuthCardCollapsed(cardId: string): boolean | null {
  const stored = localStorage.getItem(AUTH_COLLAPSED_PREFIX + cardId);
  if (stored === null) return null;
  return stored === 'true';
}

export function setAuthCardCollapsed(cardId: string, collapsed: boolean): void {
  localStorage.setItem(AUTH_COLLAPSED_PREFIX + cardId, String(collapsed));
}

// ============================================
// GitRepo Configs
// ============================================

export function loadRepoConfigs(): RepoConfig[] {
  try {
    const stored = localStorage.getItem(GITREPO_CONFIGS_KEY);
    if (stored) {
      return JSON.parse(stored) as RepoConfig[];
    }
  } catch (e) {
    console.error('[RepoConfigs] Failed to load:', e);
  }
  return [];
}

export function saveRepoConfigs(configs: RepoConfig[]): void {
  try {
    localStorage.setItem(GITREPO_CONFIGS_KEY, JSON.stringify(configs));
  } catch (e) {
    console.error('[RepoConfigs] Failed to save:', e);
  }
}

// ============================================
// Framework Selection
// ============================================

export type UIFramework = 'react' | 'vue';

export function getUIFramework(): UIFramework {
  const stored = localStorage.getItem(FRAMEWORK_KEY);
  if (stored === 'vue') return 'vue';
  return 'react'; // Default to React
}

export function setUIFramework(framework: UIFramework): void {
  localStorage.setItem(FRAMEWORK_KEY, framework);
}
