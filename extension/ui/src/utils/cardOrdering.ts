/**
 * Card ordering utilities.
 *
 * Handles the logic for computing effective card order from
 * user preferences, manifest cards, and dynamic git repos.
 */

import type { CardDefinition, CardType } from '../manifest';
import type { GitRepo } from '../types';

/** Card types that can appear in the card order */
const ORDERABLE_CARD_TYPES: CardType[] = [
  'markdown',
  'html',
  'image',
  'video',
  'link',
  'divider',
  'placeholder',
];

/**
 * Build the effective card order by filtering deleted cards and adding new ones.
 *
 * @param userCardOrder - User's preferred card order (may contain stale IDs)
 * @param gitRepos - Current list of git repos
 * @param manifestCards - Cards defined in manifest
 * @returns Filtered and updated card order
 */
export function buildEffectiveCardOrder(
  userCardOrder: string[],
  gitRepos: GitRepo[],
  manifestCards: CardDefinition[]
): string[] {
  // Build set of all currently valid card IDs
  const gitRepoIds = gitRepos.map((r) => `gitrepo-${r.name}`);
  const manifestCardIds = manifestCards
    .filter((c) => ORDERABLE_CARD_TYPES.includes(c.type))
    .map((c) => c.id);
  const allValidIds = new Set(['fleet-status', ...gitRepoIds, ...manifestCardIds]);

  // Filter out deleted cards from user's preferred order
  const filtered = userCardOrder.filter((id) => allValidIds.has(id));

  // Add new cards that aren't in the order yet
  const existingIds = new Set(filtered);
  const newIds = [...allValidIds].filter((id) => !existingIds.has(id));

  return [...filtered, ...newIds];
}

/**
 * Insert a new card ID after a given card in the order.
 *
 * @param cardOrder - Current card order
 * @param afterCardId - ID of the card to insert after
 * @param newCardId - ID of the new card to insert
 * @returns Updated card order
 */
export function insertCardAfter(
  cardOrder: string[],
  afterCardId: string,
  newCardId: string
): string[] {
  const index = cardOrder.indexOf(afterCardId);
  if (index === -1) {
    return [...cardOrder, newCardId];
  }
  return [...cardOrder.slice(0, index + 1), newCardId, ...cardOrder.slice(index + 1)];
}

/**
 * Remove a card ID from the order.
 *
 * @param cardOrder - Current card order
 * @param cardId - ID of the card to remove
 * @returns Updated card order
 */
export function removeCardFromOrder(cardOrder: string[], cardId: string): string[] {
  return cardOrder.filter((id) => id !== cardId);
}

/**
 * Move a card from one position to another in the order.
 *
 * @param cardOrder - Current card order
 * @param fromIndex - Source index
 * @param toIndex - Destination index
 * @returns Updated card order
 */
export function moveCardInOrder(
  cardOrder: string[],
  fromIndex: number,
  toIndex: number
): string[] {
  const result = [...cardOrder];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

/**
 * Get the card ID for a git repo.
 *
 * @param repoName - Name of the git repo
 * @returns Card ID string
 */
export function getGitRepoCardId(repoName: string): string {
  return `gitrepo-${repoName}`;
}

/**
 * Extract the repo name from a git repo card ID.
 *
 * @param cardId - Card ID string
 * @returns Repo name, or null if not a git repo card
 */
export function getRepoNameFromCardId(cardId: string): string | null {
  if (cardId.startsWith('gitrepo-')) {
    return cardId.replace('gitrepo-', '');
  }
  return null;
}

/**
 * Check if a card ID represents a git repo card.
 *
 * @param cardId - Card ID to check
 * @returns True if the card ID is a git repo card
 */
export function isGitRepoCardId(cardId: string): boolean {
  return cardId.startsWith('gitrepo-');
}

/**
 * Check if a card ID represents a placeholder card.
 *
 * @param cardId - Card ID to check
 * @returns True if the card ID is a placeholder card
 */
export function isPlaceholderCardId(cardId: string): boolean {
  return cardId.startsWith('placeholder-');
}

/**
 * Check if a card ID represents the fleet status card.
 *
 * @param cardId - Card ID to check
 * @returns True if the card ID is the fleet status card
 */
export function isFleetStatusCardId(cardId: string): boolean {
  return cardId === 'fleet-status';
}
