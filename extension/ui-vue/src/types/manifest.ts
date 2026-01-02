/**
 * Manifest types for the Fleet extension card system
 */

import type { ColorPalette } from './palette';

export interface ManifestApp {
  name: string;
  icon?: string;
  description?: string;
}

export interface ManifestBranding {
  primary_color?: string;
  logo?: string;
  palette?: ColorPalette;
  iconHeight?: number;
}

export interface ManifestLayout {
  show_fleet_status?: boolean;
  show_activity_log?: boolean;
  edit_mode?: boolean;
}

export interface FieldSettings {
  editable?: boolean;
  default?: string | string[];
  locked?: boolean;
  allowed?: string[];
}

export interface GitRepoCardSettings {
  duplicatable?: boolean;
  repo_url?: FieldSettings;
  branch?: FieldSettings;
  paths?: FieldSettings;
  max_visible_paths?: number;
}

export interface AuthCardSettings {
  required?: boolean;
  show_status?: boolean;
  auto_collapse?: boolean;
}

export interface AppCoCardSettings extends AuthCardSettings {
  show_catalog_link?: boolean;
}

export interface MarkdownCardSettings {
  content: string;
}

export interface BundledImage {
  data: string;
  filename: string;
  mimeType: string;
}

export interface ImageCardSettings {
  src: string;
  alt?: string;
  bundledImage?: BundledImage;
}

export interface VideoCardSettings {
  src: string;
  title?: string;
}

export interface LinkItem {
  label: string;
  url: string;
  icon?: string;
}

export interface LinkCardSettings {
  links: LinkItem[];
  variant?: 'buttons' | 'list';
}

export interface DividerCardSettings {
  label?: string;
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface HtmlCardSettings {
  content: string;
}

export type CardSettings =
  | GitRepoCardSettings
  | AuthCardSettings
  | AppCoCardSettings
  | MarkdownCardSettings
  | ImageCardSettings
  | VideoCardSettings
  | LinkCardSettings
  | DividerCardSettings
  | HtmlCardSettings;

export type CardType =
  | 'gitrepo'
  | 'auth-github'
  | 'auth-git'
  | 'auth-appco'
  | 'markdown'
  | 'html'
  | 'image'
  | 'video'
  | 'link'
  | 'divider'
  | 'placeholder';

export interface CardDefinition {
  id: string;
  type: CardType;
  title?: string;
  visible?: boolean;
  enabled?: boolean;
  settings?: CardSettings;
}

export interface Manifest {
  version: string;
  app?: ManifestApp;
  branding?: ManifestBranding;
  layout?: ManifestLayout;
  cards: CardDefinition[];
}

export const DEFAULT_MANIFEST: Manifest = {
  version: '1.0',
  app: {
    name: 'Fleet GitOps',
  },
  layout: {
    show_fleet_status: true,
    show_activity_log: true,
    edit_mode: true,
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
