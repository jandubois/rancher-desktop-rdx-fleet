import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getStorageKey,
  getCurrentStorageKey,
  saveExtensionState,
  loadExtensionState,
  clearExtensionState,
  clearExtensionStateForImage,
  PersistedExtensionState,
} from './extensionStateStorage';
import { DEFAULT_MANIFEST } from '../manifest';

// Mock detectCurrentExtensionImage
vi.mock('./extensionBuilder', () => ({
  detectCurrentExtensionImage: vi.fn(() => 'test-extension:v1.0'),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('extensionStateStorage', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  const createValidState = (): PersistedExtensionState => ({
    manifest: DEFAULT_MANIFEST,
    manifestCards: DEFAULT_MANIFEST.cards,
    cardOrder: ['fleet-status', 'card-1'],
    dynamicCardTitles: { 'fleet-status': 'Custom Title' },
    iconState: null,
    timestamp: Date.now(),
  });

  describe('getStorageKey', () => {
    it('returns key with extension image name', () => {
      expect(getStorageKey('my-extension:latest')).toBe('fleet-extension-state:my-extension:latest');
    });

    it('returns default key when image is null', () => {
      expect(getStorageKey(null)).toBe('fleet-extension-state:default');
    });

    it('returns default key when image is empty string', () => {
      expect(getStorageKey('')).toBe('fleet-extension-state:default');
    });
  });

  describe('getCurrentStorageKey', () => {
    it('returns key based on detected extension image', () => {
      const key = getCurrentStorageKey();
      expect(key).toBe('fleet-extension-state:test-extension:v1.0');
    });
  });

  describe('saveExtensionState', () => {
    it('saves state to localStorage with correct key', () => {
      const state = createValidState();
      saveExtensionState(state);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'fleet-extension-state:test-extension:v1.0',
        expect.any(String)
      );
    });

    it('includes timestamp in saved state', () => {
      const state = createValidState();
      saveExtensionState(state);

      const savedValue = localStorageMock.setItem.mock.calls[0][1];
      const parsed = JSON.parse(savedValue);
      expect(parsed.timestamp).toBeDefined();
      expect(typeof parsed.timestamp).toBe('number');
    });

    it('handles localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceeded');
      });

      const state = createValidState();
      expect(() => saveExtensionState(state)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('loadExtensionState', () => {
    it('returns null when no state exists', () => {
      const result = loadExtensionState();
      expect(result).toBeNull();
    });

    it('returns parsed state when valid state exists', () => {
      const state = createValidState();
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(state));

      const result = loadExtensionState();
      expect(result).toEqual(state);
    });

    it('returns null for invalid JSON', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorageMock.getItem.mockReturnValueOnce('not valid json');

      const result = loadExtensionState();
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('returns null for state missing manifest', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const invalidState = { manifestCards: [], cardOrder: [] };
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(invalidState));

      const result = loadExtensionState();
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('returns null for state with non-array manifestCards', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const invalidState = { manifest: DEFAULT_MANIFEST, manifestCards: 'not-array', cardOrder: [] };
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(invalidState));

      const result = loadExtensionState();
      expect(result).toBeNull();

      consoleSpy.mockRestore();
    });

    it('returns null for state with non-array cardOrder', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const invalidState = { manifest: DEFAULT_MANIFEST, manifestCards: [], cardOrder: 'not-array' };
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(invalidState));

      const result = loadExtensionState();
      expect(result).toBeNull();

      consoleSpy.mockRestore();
    });
  });

  describe('clearExtensionState', () => {
    it('removes state from localStorage', () => {
      clearExtensionState();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        'fleet-extension-state:test-extension:v1.0'
      );
    });

    it('handles localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      expect(() => clearExtensionState()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('clearExtensionStateForImage', () => {
    it('removes state for specific extension image', () => {
      clearExtensionStateForImage('other-extension:v2.0');

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        'fleet-extension-state:other-extension:v2.0'
      );
    });

    it('handles localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      expect(() => clearExtensionStateForImage('test:v1')).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
