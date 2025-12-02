import { CardType, CardSettings } from '../manifest/types';
import { CardComponent } from './types';

// Metadata for registered card types
export interface CardTypeMetadata {
  label: string;                           // Display name in UI
  orderable: boolean;                      // Can be reordered/added via "Add Card"
  category: 'auth' | 'content' | 'special'; // Card category
  defaultSettings: () => CardSettings;     // Factory for default settings
}

// Registry of card types to their components
const cardRegistry = new Map<CardType, CardComponent<CardSettings>>();

// Registry of card type metadata
const metadataRegistry = new Map<CardType, CardTypeMetadata>();

// Register a card component with metadata
export function registerCard<T extends CardSettings>(
  type: CardType,
  component: CardComponent<T>,
  metadata?: CardTypeMetadata
): void {
  cardRegistry.set(type, component as unknown as CardComponent<CardSettings>);
  if (metadata) {
    metadataRegistry.set(type, metadata);
  }
}

// Get a card component by type
export function getCardComponent(type: CardType): CardComponent<CardSettings> | undefined {
  return cardRegistry.get(type);
}

// Get metadata for a card type
export function getCardMetadata(type: CardType): CardTypeMetadata | undefined {
  return metadataRegistry.get(type);
}

// Check if a card type is registered
export function isCardTypeRegistered(type: CardType): boolean {
  return cardRegistry.has(type);
}

// Get all registered card types
export function getRegisteredCardTypes(): CardType[] {
  return Array.from(cardRegistry.keys());
}

// Get all orderable card types (for "Add Card" menu and card ordering)
export function getOrderableCardTypes(): CardType[] {
  return Array.from(metadataRegistry.entries())
    .filter(([, meta]) => meta.orderable)
    .map(([type]) => type);
}

// Get card types for the "Add Card" menu with their labels
export function getAddCardMenuItems(): Array<{ type: CardType; label: string }> {
  return Array.from(metadataRegistry.entries())
    .filter(([, meta]) => meta.orderable)
    .map(([type, meta]) => ({ type, label: meta.label }));
}

// Get default settings for a card type
export function getDefaultSettingsForType(type: CardType): CardSettings {
  const metadata = metadataRegistry.get(type);
  if (metadata) {
    return metadata.defaultSettings();
  }
  return {};
}
