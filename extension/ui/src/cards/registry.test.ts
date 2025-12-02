import { describe, it, expect, beforeAll } from 'vitest';
import { getAddCardMenuItems } from './registry';

// Import all cards to ensure they register themselves
import './AuthGitHubCard';
import './AuthAppCoCard';
import './DividerCard';
import './HtmlCard';
import './ImageCard';
import './LinkCard';
import './MarkdownCard';
import './VideoCard';

describe('registry', () => {
  describe('getAddCardMenuItems', () => {
    it('returns all orderable card types when no existing types provided', () => {
      const items = getAddCardMenuItems();
      expect(items.length).toBeGreaterThan(0);

      // Should include auth cards when no filter applied
      const types = items.map((item) => item.type);
      expect(types).toContain('auth-github');
      expect(types).toContain('auth-appco');
    });

    it('filters out singleton cards that already exist', () => {
      // Get all items first
      const allItems = getAddCardMenuItems();
      const allTypes = allItems.map((item) => item.type);

      // auth-github is singleton, so it should be filtered when it exists
      const itemsWithGitHub = getAddCardMenuItems(['auth-github']);
      const typesWithGitHub = itemsWithGitHub.map((item) => item.type);

      expect(allTypes).toContain('auth-github');
      expect(typesWithGitHub).not.toContain('auth-github');

      // auth-appco should still be present since it wasn't in existingTypes
      expect(typesWithGitHub).toContain('auth-appco');
    });

    it('filters out multiple singleton cards that already exist', () => {
      const items = getAddCardMenuItems(['auth-github', 'auth-appco']);
      const types = items.map((item) => item.type);

      expect(types).not.toContain('auth-github');
      expect(types).not.toContain('auth-appco');
    });

    it('does not filter non-singleton orderable cards', () => {
      // Non-singleton cards should not be filtered even if they exist
      const allItems = getAddCardMenuItems();
      const nonSingletonTypes = allItems
        .filter((item) => !['auth-github', 'auth-appco'].includes(item.type))
        .map((item) => item.type);

      if (nonSingletonTypes.length > 0) {
        const itemsWithExisting = getAddCardMenuItems(nonSingletonTypes);
        const typesWithExisting = itemsWithExisting.map((item) => item.type);

        // Non-singleton types should still be present
        for (const type of nonSingletonTypes) {
          expect(typesWithExisting).toContain(type);
        }
      }
    });

    it('handles empty existing types array', () => {
      const itemsWithEmpty = getAddCardMenuItems([]);
      const itemsWithUndefined = getAddCardMenuItems();

      // Both should return the same results
      expect(itemsWithEmpty.length).toBe(itemsWithUndefined.length);
    });
  });
});
