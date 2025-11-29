// Color palette types and defaults for the Fleet extension UI

/**
 * Color palette configuration for customizing the extension appearance.
 * All colors are optional and will fall back to sensible defaults.
 */
export interface ColorPalette {
  header?: {
    background?: string;
    text?: string;
  };
  body?: {
    background?: string;
  };
  card?: {
    border?: string;
    title?: string;
  };
}

/**
 * Default color palette values.
 * These match the current MUI theme defaults.
 */
export const defaultPalette: Required<{
  header: Required<NonNullable<ColorPalette['header']>>;
  body: Required<NonNullable<ColorPalette['body']>>;
  card: Required<NonNullable<ColorPalette['card']>>;
}> = {
  header: {
    background: '#1976d2', // MUI primary.main
    text: '#ffffff',
  },
  body: {
    background: '#fafafa', // grey.50
  },
  card: {
    border: '#e0e0e0', // grey.300
    title: 'inherit',
  },
};

/**
 * Merges a partial palette with the defaults to produce a complete palette.
 */
export function resolvePalette(palette?: ColorPalette): typeof defaultPalette {
  return {
    header: {
      background: palette?.header?.background ?? defaultPalette.header.background,
      text: palette?.header?.text ?? defaultPalette.header.text,
    },
    body: {
      background: palette?.body?.background ?? defaultPalette.body.background,
    },
    card: {
      border: palette?.card?.border ?? defaultPalette.card.border,
      title: palette?.card?.title ?? defaultPalette.card.title,
    },
  };
}
