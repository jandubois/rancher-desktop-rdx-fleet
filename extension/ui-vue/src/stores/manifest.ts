/**
 * Manifest Store - Manages the extension manifest and cards.
 * Uses the same localStorage format as React for seamless switching.
 */

import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { Manifest, CardDefinition } from '../types/manifest';
import { DEFAULT_MANIFEST } from '../types/manifest';
import { resolvePalette, type ResolvedPalette } from '../types/palette';
import {
  loadExtensionState,
  saveExtensionState,
  clearExtensionState,
  type PersistedExtensionState,
  type IconState,
  type EditModeSnapshot,
  DEFAULT_ICON_HEIGHT,
} from '../utils/storage';

export const useManifestStore = defineStore('manifest', () => {
  // Load initial state from localStorage (React-compatible format)
  const initialState = loadExtensionState();

  // State - using Vue refs for reactivity
  const manifest = ref<Manifest>(initialState?.manifest ?? DEFAULT_MANIFEST);
  const manifestCards = ref<CardDefinition[]>(initialState?.manifestCards ?? DEFAULT_MANIFEST.cards);
  const cardOrder = ref<string[]>(initialState?.cardOrder ?? DEFAULT_MANIFEST.cards.map(c => c.id));
  const dynamicCardTitles = ref<Record<string, string>>(initialState?.dynamicCardTitles ?? {});
  const iconState = ref<IconState>(initialState?.iconState ?? null);
  const iconHeight = ref<number>(initialState?.iconHeight ?? DEFAULT_ICON_HEIGHT);
  const editMode = ref<boolean>(initialState?.editMode ?? false);
  const editModeSnapshot = ref<EditModeSnapshot | null>(initialState?.editModeSnapshot ?? null);
  const activeEditTab = ref<number>(initialState?.activeEditTab ?? 0);

  // Computed properties - Vue's reactive getters
  const cards = computed(() => manifestCards.value);

  const orderedCards = computed(() => {
    // Return cards in the order specified by cardOrder
    return cardOrder.value
      .map(id => manifestCards.value.find(c => c.id === id))
      .filter((c): c is CardDefinition => c !== undefined);
  });

  const visibleCards = computed(() =>
    orderedCards.value.filter(card => card.visible !== false)
  );

  const appName = computed(() => manifest.value.app?.name ?? 'Fleet GitOps');

  const appIcon = computed(() => manifest.value.app?.icon);

  const headerLogo = computed(() => manifest.value.branding?.logo);

  const computedIconHeight = computed(() => iconHeight.value);

  const primaryColor = computed(() => manifest.value.branding?.primary_color);

  const palette = computed<ResolvedPalette>(() =>
    resolvePalette(manifest.value.branding?.palette)
  );

  const showFleetStatus = computed(() => manifest.value.layout?.show_fleet_status !== false);

  const showActivityLog = computed(() => manifest.value.layout?.show_activity_log !== false);

  const allowEditMode = computed(() => manifest.value.layout?.edit_mode === true);

  // Save to localStorage whenever state changes
  function saveState() {
    const state: PersistedExtensionState = {
      manifest: manifest.value,
      manifestCards: manifestCards.value,
      cardOrder: cardOrder.value,
      dynamicCardTitles: dynamicCardTitles.value,
      iconState: iconState.value,
      iconHeight: iconHeight.value,
      editMode: editMode.value,
      editModeSnapshot: editModeSnapshot.value,
      activeEditTab: activeEditTab.value,
      timestamp: Date.now(),
    };
    saveExtensionState(state);
  }

  // Watch for changes and auto-save
  watch(
    [manifest, manifestCards, cardOrder, dynamicCardTitles, iconState, iconHeight, editMode, editModeSnapshot, activeEditTab],
    () => {
      saveState();
    },
    { deep: true }
  );

  // Actions
  function setManifest(newManifest: Manifest) {
    manifest.value = newManifest;
  }

  function setManifestCards(cards: CardDefinition[]) {
    manifestCards.value = cards;
  }

  function updateCard(cardId: string, updates: Partial<CardDefinition>) {
    const index = manifestCards.value.findIndex(c => c.id === cardId);
    if (index !== -1) {
      manifestCards.value[index] = { ...manifestCards.value[index], ...updates };
    }
  }

  function addCard(card: CardDefinition, afterId?: string) {
    manifestCards.value.push(card);
    if (afterId) {
      const afterIndex = cardOrder.value.indexOf(afterId);
      if (afterIndex !== -1) {
        cardOrder.value.splice(afterIndex + 1, 0, card.id);
      } else {
        cardOrder.value.push(card.id);
      }
    } else {
      cardOrder.value.push(card.id);
    }
  }

  function removeCard(cardId: string) {
    const cardIndex = manifestCards.value.findIndex(c => c.id === cardId);
    if (cardIndex !== -1) {
      manifestCards.value.splice(cardIndex, 1);
    }
    const orderIndex = cardOrder.value.indexOf(cardId);
    if (orderIndex !== -1) {
      cardOrder.value.splice(orderIndex, 1);
    }
    // Clean up dynamic title if exists
    if (dynamicCardTitles.value[cardId]) {
      delete dynamicCardTitles.value[cardId];
    }
  }

  function reorderCards(newOrder: string[]) {
    cardOrder.value = newOrder;
  }

  function setCardTitle(cardId: string, title: string) {
    dynamicCardTitles.value[cardId] = title;
  }

  function getCardTitle(cardId: string): string | undefined {
    return dynamicCardTitles.value[cardId];
  }

  function setIconState(state: IconState) {
    iconState.value = state;
  }

  function setIconHeight(height: number) {
    iconHeight.value = height;
  }

  function setEditMode(value: boolean) {
    editMode.value = value;
  }

  function setActiveEditTab(tab: number) {
    activeEditTab.value = tab;
  }

  function createSnapshot(): EditModeSnapshot {
    return {
      manifest: JSON.parse(JSON.stringify(manifest.value)),
      manifestCards: JSON.parse(JSON.stringify(manifestCards.value)),
      cardOrder: [...cardOrder.value],
      iconState: iconState.value,
      iconHeight: iconHeight.value,
      dynamicCardTitles: { ...dynamicCardTitles.value },
    };
  }

  function saveSnapshot() {
    editModeSnapshot.value = createSnapshot();
  }

  function restoreSnapshot() {
    if (editModeSnapshot.value) {
      manifest.value = editModeSnapshot.value.manifest;
      manifestCards.value = editModeSnapshot.value.manifestCards;
      cardOrder.value = editModeSnapshot.value.cardOrder;
      iconState.value = editModeSnapshot.value.iconState;
      iconHeight.value = editModeSnapshot.value.iconHeight;
      dynamicCardTitles.value = editModeSnapshot.value.dynamicCardTitles;
    }
  }

  function clearSnapshot() {
    editModeSnapshot.value = null;
  }

  function reset() {
    manifest.value = DEFAULT_MANIFEST;
    manifestCards.value = DEFAULT_MANIFEST.cards;
    cardOrder.value = DEFAULT_MANIFEST.cards.map(c => c.id);
    dynamicCardTitles.value = {};
    iconState.value = null;
    iconHeight.value = DEFAULT_ICON_HEIGHT;
    editMode.value = false;
    editModeSnapshot.value = null;
    activeEditTab.value = 0;
    clearExtensionState();
  }

  function updatePalette(newPalette: import('../types/palette').ColorPalette) {
    manifest.value = {
      ...manifest.value,
      branding: {
        ...manifest.value.branding,
        palette: newPalette,
      },
    };
  }

  function loadManifest(newManifest: Manifest) {
    manifest.value = newManifest;
    manifestCards.value = newManifest.cards || DEFAULT_MANIFEST.cards;
    cardOrder.value = (newManifest.cards || DEFAULT_MANIFEST.cards).map(c => c.id);
    dynamicCardTitles.value = {};
  }

  return {
    // State
    manifest,
    manifestCards,
    cardOrder,
    dynamicCardTitles,
    iconState,
    iconHeight: computedIconHeight,
    editMode,
    editModeSnapshot,
    activeEditTab,

    // Computed
    cards,
    orderedCards,
    visibleCards,
    appName,
    appIcon,
    headerLogo,
    primaryColor,
    palette,
    showFleetStatus,
    showActivityLog,
    allowEditMode,

    // Actions
    setManifest,
    setManifestCards,
    updateCard,
    addCard,
    removeCard,
    reorderCards,
    setCardTitle,
    getCardTitle,
    setIconState,
    setIconHeight,
    setEditMode,
    setActiveEditTab,
    saveSnapshot,
    restoreSnapshot,
    clearSnapshot,
    reset,
    updatePalette,
    loadManifest,
  };
});
