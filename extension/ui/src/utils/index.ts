// Utility exports
export { getErrorMessage } from './errors';
export { KUBE_CONTEXT, FLEET_NAMESPACE } from './constants';
export {
  SUPPORTED_IMAGE_MIME_TYPES,
  getExtensionForMimeType,
  getMimeTypeForExtension,
  isSvgMimeType,
  isSvgDataUrl,
} from './mimeTypes';
export type { SupportedImageMimeType } from './mimeTypes';

// Re-export bundle utilities from GitHubService (used by dependency resolver)
// Note: The full GitHubService is being deprecated in favor of backend path discovery.
// These utility functions remain useful for the frontend dependency resolution.
export { computeBundleName, buildBundleInfo, parseGitHubUrl } from '../services/GitHubService';
export type { PathInfo } from '../services/GitHubService';
export {
  generateManifestYaml,
  generateMetadataJson,
  generateDockerfile,
  createExtensionZip,
  downloadExtensionZip,
  buildExtension,
  detectCurrentExtensionImage,
  detectCurrentExtensionImageAsync,
} from './extensionBuilder';
export type { ExtensionConfig, BuildResult, DetectionResult, GitRepoConfig } from './extensionBuilder';
export {
  buildEffectiveCardOrder,
  insertCardAfter,
  removeCardFromOrder,
  moveCardInOrder,
  getGitRepoCardId,
  getRepoNameFromCardId,
  isGitRepoCardId,
  isPlaceholderCardId,
  isFleetStatusCardId,
} from './cardOrdering';
