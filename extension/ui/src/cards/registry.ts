import { CardType, CardSettings } from '../manifest/types';
import { CardComponent } from './types';

// Registry of card types to their components
const cardRegistry = new Map<CardType, CardComponent<CardSettings>>();

// Register a card component
export function registerCard<T extends CardSettings>(
  type: CardType,
  component: CardComponent<T>
): void {
  cardRegistry.set(type, component as unknown as CardComponent<CardSettings>);
}

// Get a card component by type
export function getCardComponent(type: CardType): CardComponent<CardSettings> | undefined {
  return cardRegistry.get(type);
}

// Check if a card type is registered
export function isCardTypeRegistered(type: CardType): boolean {
  return cardRegistry.has(type);
}

// Get all registered card types
export function getRegisteredCardTypes(): CardType[] {
  return Array.from(cardRegistry.keys());
}
