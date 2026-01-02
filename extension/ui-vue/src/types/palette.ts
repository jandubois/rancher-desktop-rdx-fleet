/**
 * Color palette types and defaults for the Fleet extension UI
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

export interface ResolvedPalette {
  header: {
    background: string;
    text: string;
  };
  body: {
    background: string;
  };
  card: {
    border: string;
    title: string;
  };
}

export const defaultPalette: ResolvedPalette = {
  header: {
    background: '#1976d2',
    text: '#ffffff',
  },
  body: {
    background: '#fafafa',
  },
  card: {
    border: '#e0e0e0',
    title: 'inherit',
  },
};

export function resolvePalette(palette?: ColorPalette): ResolvedPalette {
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
