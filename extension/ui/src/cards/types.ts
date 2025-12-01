import { ReactNode } from 'react';
import { CardDefinition, CardSettings } from '../manifest/types';

// Props passed to all card components
export interface CardProps<T extends CardSettings = CardSettings> {
  definition: CardDefinition;
  settings: T;
  editMode?: boolean;
  onSettingsChange?: (settings: T) => void;
  paletteColors?: CardPaletteColors;
}

// Card component type
export type CardComponent<T extends CardSettings = CardSettings> = React.FC<CardProps<T>>;

// Palette colors for card styling
export interface CardPaletteColors {
  border?: string;
  title?: string;
}

// Card wrapper props
export interface CardWrapperProps {
  definition: CardDefinition;
  editMode?: boolean;
  onMove?: (direction: 'up' | 'down') => void;
  onDelete?: () => void;
  onSettingsClick?: () => void;
  onVisibilityToggle?: () => void;
  onTitleChange?: (title: string) => void;
  paletteColors?: CardPaletteColors;
  children: ReactNode;
}
