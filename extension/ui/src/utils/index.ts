// Utility exports
export { getErrorMessage } from './errors';
export { parseGitHubUrl, fetchFleetYamlDeps, fetchGitHubPaths, computeBundleName, buildBundleInfo } from './github';
export type { PathInfo } from './github';
export { KUBE_CONTEXT, FLEET_NAMESPACE } from './constants';
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
export type { ExtensionConfig, BuildResult, DetectionResult } from './extensionBuilder';
