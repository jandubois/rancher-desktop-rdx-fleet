/**
 * Card component registry.
 * Maps card types to their Vue components.
 */

import type { Component } from 'vue';
import type { CardType } from '../../types/manifest';

import MarkdownCard from './MarkdownCard.vue';
import ImageCard from './ImageCard.vue';
import VideoCard from './VideoCard.vue';
import LinkCard from './LinkCard.vue';
import DividerCard from './DividerCard.vue';
import GitRepoCard from './GitRepoCard.vue';
import FleetStatusCard from './FleetStatusCard.vue';
import HtmlCard from './HtmlCard.vue';
import AuthGitHubCard from './AuthGitHubCard.vue';
import AuthAppCoCard from './AuthAppCoCard.vue';

// Card registry - maps type to component
export const cardRegistry: Partial<Record<CardType, Component>> = {
  'markdown': MarkdownCard,
  'image': ImageCard,
  'video': VideoCard,
  'link': LinkCard,
  'divider': DividerCard,
  'gitrepo': GitRepoCard,
  'html': HtmlCard,
  'auth-github': AuthGitHubCard,
  'auth-appco': AuthAppCoCard,
};

// Special cards that render once (like FleetStatus)
export const specialCards = {
  FleetStatusCard,
};

// Get component for card type
export function getCardComponent(type: CardType): Component | undefined {
  return cardRegistry[type];
}

// Check if card type is supported
export function isCardTypeSupported(type: CardType): boolean {
  return type in cardRegistry;
}
