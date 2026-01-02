/**
 * Manifest Store - Manages the extension manifest and cards.
 * Uses Pinia with Vue's reactivity system for state management.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Manifest, CardDefinition } from '../types/manifest';
import { DEFAULT_MANIFEST } from '../types/manifest';
import { resolvePalette, type ResolvedPalette } from '../types/palette';

const STORAGE_KEY = 'fleet-extension-manifest';

export const useManifestStore = defineStore('manifest', () => {
  // State - using Vue refs for reactivity
  const manifest = ref<Manifest>(loadFromStorage() ?? DEFAULT_MANIFEST);
  const editMode = ref(false);

  // Computed properties - Vue's reactive getters
  const cards = computed(() => manifest.value.cards);

  const visibleCards = computed(() =>
    manifest.value.cards.filter(card => card.visible !== false)
  );

  const appName = computed(() => manifest.value.app?.name ?? 'Fleet GitOps');

  const appIcon = computed(() => manifest.value.app?.icon);

  const headerLogo = computed(() => manifest.value.branding?.logo);

  const iconHeight = computed(() => manifest.value.branding?.iconHeight ?? 40);

  const primaryColor = computed(() => manifest.value.branding?.primary_color);

  const palette = computed<ResolvedPalette>(() =>
    resolvePalette(manifest.value.branding?.palette)
  );

  const showFleetStatus = computed(() => manifest.value.layout?.show_fleet_status !== false);

  const showActivityLog = computed(() => manifest.value.layout?.show_activity_log !== false);

  const allowEditMode = computed(() => manifest.value.layout?.edit_mode === true);

  // Actions
  function loadFromStorage(): Manifest | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(manifest.value));
    } catch (e) {
      console.warn('Failed to save manifest to localStorage:', e);
    }
  }

  function setManifest(newManifest: Manifest) {
    manifest.value = newManifest;
    saveToStorage();
  }

  function updateCard(cardId: string, updates: Partial<CardDefinition>) {
    const index = manifest.value.cards.findIndex(c => c.id === cardId);
    if (index !== -1) {
      manifest.value.cards[index] = { ...manifest.value.cards[index], ...updates };
      saveToStorage();
    }
  }

  function addCard(card: CardDefinition) {
    manifest.value.cards.push(card);
    saveToStorage();
  }

  function removeCard(cardId: string) {
    const index = manifest.value.cards.findIndex(c => c.id === cardId);
    if (index !== -1) {
      manifest.value.cards.splice(index, 1);
      saveToStorage();
    }
  }

  function reorderCards(newOrder: CardDefinition[]) {
    manifest.value.cards = newOrder;
    saveToStorage();
  }

  function setEditMode(value: boolean) {
    editMode.value = value;
  }

  function reset() {
    manifest.value = DEFAULT_MANIFEST;
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    // State
    manifest,
    editMode,

    // Computed
    cards,
    visibleCards,
    appName,
    appIcon,
    headerLogo,
    iconHeight,
    primaryColor,
    palette,
    showFleetStatus,
    showActivityLog,
    allowEditMode,

    // Actions
    setManifest,
    updateCard,
    addCard,
    removeCard,
    reorderCards,
    setEditMode,
    reset,
  };
});
