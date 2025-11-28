// Manifest types for the Fleet extension card system

export interface ManifestApp {
  name: string;
  icon?: string;  // Extension icon (shown in RD sidebar)
  description?: string;
}

export interface ManifestBranding {
  primary_color?: string;
  logo?: string;  // Header logo (within extension UI)
}

export interface ManifestLayout {
  show_fleet_status?: boolean;
  show_activity_log?: boolean;
  edit_mode?: boolean;  // Allow edit mode (only for official extension)
}

// Field settings for editable/lockable fields
export interface FieldSettings {
  editable?: boolean;
  default?: string | string[];
  locked?: boolean;
  allowed?: string[];  // Whitelist (for paths)
}

// Card-specific settings
export interface GitRepoCardSettings {
  duplicatable?: boolean;
  repo_url?: FieldSettings;
  branch?: FieldSettings;
  paths?: FieldSettings;
  max_visible_paths?: number;  // Max paths before scrolling (default: 6)
}

export interface AuthCardSettings {
  required?: boolean;
  show_status?: boolean;
}

export interface MarkdownCardSettings {
  content: string;
}

export interface ImageCardSettings {
  src: string;
  alt?: string;
}

export interface VideoCardSettings {
  src: string;
  title?: string;
}

export interface LinkItem {
  label: string;
  url: string;
  icon?: string;  // MUI icon name (optional)
}

export interface LinkCardSettings {
  links: LinkItem[];
  variant?: 'buttons' | 'list';  // Display style
}

export interface DividerCardSettings {
  label?: string;
  style?: 'solid' | 'dashed' | 'dotted';
}

export type CardSettings =
  | GitRepoCardSettings
  | AuthCardSettings
  | MarkdownCardSettings
  | ImageCardSettings
  | VideoCardSettings
  | LinkCardSettings
  | DividerCardSettings;

export type CardType =
  | 'gitrepo'
  | 'auth-github'
  | 'auth-git'
  | 'auth-appco'
  | 'markdown'
  | 'image'
  | 'video'
  | 'link'
  | 'divider'
  | 'placeholder';  // Temporary type for cards being configured

export interface CardDefinition {
  id: string;
  type: CardType;
  title?: string;
  visible?: boolean;  // default: true
  enabled?: boolean;  // default: true
  settings?: CardSettings;
}

export interface Manifest {
  version: string;
  app?: ManifestApp;
  branding?: ManifestBranding;
  layout?: ManifestLayout;
  cards: CardDefinition[];
}

// Default manifest when none is provided
export const DEFAULT_MANIFEST: Manifest = {
  version: '1.0',
  app: {
    name: 'Fleet GitOps',
  },
  layout: {
    show_fleet_status: true,
    show_activity_log: true,
    edit_mode: true,  // Official extension allows editing
  },
  cards: [
    {
      id: 'github-auth',
      type: 'auth-github',
      title: 'GitHub Credentials',
      settings: {
        required: false,
      } as AuthCardSettings,
    },
    {
      id: 'default-gitrepo',
      type: 'gitrepo',
      title: 'Git Repository',
      settings: {
        duplicatable: true,
        repo_url: { editable: true },
        paths: { editable: true },
      } as GitRepoCardSettings,
    },
  ],
};
