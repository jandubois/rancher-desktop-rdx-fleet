/**
 * Unit tests for the manifest Pinia store.
 * Tests state management and localStorage persistence.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useManifestStore } from './manifest';
import { DEFAULT_MANIFEST } from '../types/manifest';
import type { CardDefinition } from '../types/manifest';

// Mock the storage utilities
vi.mock('../utils/storage', () => ({
  loadExtensionState: vi.fn(() => null),
  saveExtensionState: vi.fn(),
  clearExtensionState: vi.fn(),
  DEFAULT_ICON_HEIGHT: 40,
}));

// Get mocked functions
import { loadExtensionState, saveExtensionState, clearExtensionState } from '../utils/storage';
const mockLoadExtensionState = vi.mocked(loadExtensionState);
const mockSaveExtensionState = vi.mocked(saveExtensionState);
const mockClearExtensionState = vi.mocked(clearExtensionState);

describe('useManifestStore', () => {
  beforeEach(() => {
    // Create fresh pinia instance for each test
    setActivePinia(createPinia());
    // Reset all mocks and default return value
    vi.clearAllMocks();
    mockLoadExtensionState.mockReturnValue(null);
  });

  describe('initial state', () => {
    it('should initialize with default manifest when no stored state', () => {
      mockLoadExtensionState.mockReturnValue(null);

      const store = useManifestStore();

      expect(store.manifest).toEqual(DEFAULT_MANIFEST);
      expect(store.editMode).toBe(false);
    });

    it('should initialize from stored state when available', () => {
      const storedState = {
        manifest: { ...DEFAULT_MANIFEST, app: { name: 'Test App' } },
        manifestCards: [{ id: 'test', type: 'markdown' as const, title: 'Test' }],
        cardOrder: ['test'],
        dynamicCardTitles: {},
        iconState: null,
        iconHeight: 50,
        editMode: true,
        editModeSnapshot: null,
        activeEditTab: 2,
        timestamp: Date.now(),
      };
      mockLoadExtensionState.mockReturnValue(storedState);

      const store = useManifestStore();

      expect(store.manifest.app?.name).toBe('Test App');
      expect(store.editMode).toBe(true);
      expect(store.iconHeight).toBe(50);
      expect(store.activeEditTab).toBe(2);
    });
  });

  describe('computed properties', () => {
    it('should compute appName from manifest', () => {
      const store = useManifestStore();

      expect(store.appName).toBe(DEFAULT_MANIFEST.app?.name ?? 'Fleet GitOps');
    });

    it('should compute visibleCards filtering out hidden cards', () => {
      const store = useManifestStore();
      store.manifestCards = [
        { id: '1', type: 'markdown', visible: true },
        { id: '2', type: 'markdown', visible: false },
        { id: '3', type: 'markdown' }, // visible by default
      ] as CardDefinition[];
      store.cardOrder = ['1', '2', '3'];

      expect(store.visibleCards).toHaveLength(2);
      expect(store.visibleCards.map(c => c.id)).toEqual(['1', '3']);
    });

    it('should compute orderedCards based on cardOrder', () => {
      const store = useManifestStore();
      store.manifestCards = [
        { id: 'a', type: 'markdown' },
        { id: 'b', type: 'markdown' },
        { id: 'c', type: 'markdown' },
      ] as CardDefinition[];
      store.cardOrder = ['c', 'a', 'b'];

      expect(store.orderedCards.map(c => c.id)).toEqual(['c', 'a', 'b']);
    });

    it('should compute palette with defaults', () => {
      const store = useManifestStore();

      expect(store.palette.header.background).toBeDefined();
      expect(store.palette.header.text).toBeDefined();
      expect(store.palette.body.background).toBeDefined();
    });

    it('should compute showFleetStatus from layout', () => {
      const store = useManifestStore();

      // Default should show fleet status
      expect(store.showFleetStatus).toBe(true);

      store.manifest = {
        ...store.manifest,
        layout: { show_fleet_status: false },
      };

      expect(store.showFleetStatus).toBe(false);
    });

    it('should compute allowEditMode from layout', () => {
      const store = useManifestStore();

      store.manifest = {
        ...store.manifest,
        layout: { edit_mode: true },
      };

      expect(store.allowEditMode).toBe(true);
    });
  });

  describe('actions', () => {
    it('should update card correctly', () => {
      const store = useManifestStore();
      store.manifestCards = [
        { id: 'test', type: 'markdown', title: 'Original' },
      ] as CardDefinition[];

      store.updateCard('test', { title: 'Updated' });

      expect(store.manifestCards[0].title).toBe('Updated');
    });

    it('should add card at end when no afterId specified', () => {
      const store = useManifestStore();
      store.manifestCards = [{ id: 'existing', type: 'markdown' }] as CardDefinition[];
      store.cardOrder = ['existing'];

      store.addCard({ id: 'new', type: 'link' } as CardDefinition);

      expect(store.manifestCards).toHaveLength(2);
      expect(store.cardOrder).toEqual(['existing', 'new']);
    });

    it('should add card after specified card', () => {
      const store = useManifestStore();
      store.manifestCards = [
        { id: 'first', type: 'markdown' },
        { id: 'third', type: 'markdown' },
      ] as CardDefinition[];
      store.cardOrder = ['first', 'third'];

      store.addCard({ id: 'second', type: 'link' } as CardDefinition, 'first');

      expect(store.cardOrder).toEqual(['first', 'second', 'third']);
    });

    it('should remove card and clean up dynamic title', () => {
      const store = useManifestStore();
      store.manifestCards = [
        { id: 'keep', type: 'markdown' },
        { id: 'remove', type: 'markdown' },
      ] as CardDefinition[];
      store.cardOrder = ['keep', 'remove'];
      store.dynamicCardTitles = { remove: 'Custom Title' };

      store.removeCard('remove');

      expect(store.manifestCards).toHaveLength(1);
      expect(store.cardOrder).toEqual(['keep']);
      expect(store.dynamicCardTitles).not.toHaveProperty('remove');
    });

    it('should reorder cards', () => {
      const store = useManifestStore();
      store.cardOrder = ['a', 'b', 'c'];

      store.reorderCards(['c', 'b', 'a']);

      expect(store.cardOrder).toEqual(['c', 'b', 'a']);
    });

    it('should set and get card title', () => {
      const store = useManifestStore();

      store.setCardTitle('card1', 'Custom Title');

      expect(store.getCardTitle('card1')).toBe('Custom Title');
      expect(store.getCardTitle('nonexistent')).toBeUndefined();
    });

    it('should set edit mode', () => {
      const store = useManifestStore();

      store.setEditMode(true);
      expect(store.editMode).toBe(true);

      store.setEditMode(false);
      expect(store.editMode).toBe(false);
    });

    it('should create and restore snapshot', () => {
      const store = useManifestStore();
      store.manifestCards = [{ id: 'original', type: 'markdown' }] as CardDefinition[];
      store.cardOrder = ['original'];

      // Save snapshot
      store.saveSnapshot();

      // Modify state
      store.manifestCards = [{ id: 'modified', type: 'link' }] as CardDefinition[];
      store.cardOrder = ['modified'];

      // Restore snapshot
      store.restoreSnapshot();

      expect(store.manifestCards[0].id).toBe('original');
      expect(store.cardOrder).toEqual(['original']);
    });

    it('should reset to default state', () => {
      const store = useManifestStore();
      store.manifestCards = [{ id: 'custom', type: 'markdown' }] as CardDefinition[];
      store.editMode = true;

      store.reset();

      expect(store.manifest).toEqual(DEFAULT_MANIFEST);
      expect(store.editMode).toBe(false);
      expect(mockClearExtensionState).toHaveBeenCalled();
    });
  });

  describe('persistence', () => {
    it('should save state when manifest changes', async () => {
      const store = useManifestStore();

      store.setManifest({ ...DEFAULT_MANIFEST, app: { name: 'Changed' } });

      // Wait for watcher to trigger
      await vi.waitFor(() => {
        expect(mockSaveExtensionState).toHaveBeenCalled();
      });
    });

    it('should save state when cards are modified', async () => {
      const store = useManifestStore();
      store.manifestCards = [{ id: 'test', type: 'markdown' }] as CardDefinition[];
      store.cardOrder = ['test'];

      vi.clearAllMocks();
      store.updateCard('test', { title: 'Updated' });

      await vi.waitFor(() => {
        expect(mockSaveExtensionState).toHaveBeenCalled();
      });
    });
  });
});
