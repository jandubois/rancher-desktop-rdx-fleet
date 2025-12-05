import yaml from 'js-yaml';
import JSZip from 'jszip';
import { Manifest, CardDefinition, ImageCardSettings } from '../manifest';
import type { BundledImage } from '../manifest';
import { ddClient } from '../lib/ddClient';
import { backendService } from '../services/BackendService';
import type { CustomIcon } from '../components/IconUpload';
import type { IconState } from '../components/EditableHeaderIcon';
import { DEFAULT_ICON_HEIGHT } from './extensionStateStorage';

// Collected bundled image with its target path
interface CollectedBundledImage {
  path: string;        // Path in the bundle (e.g., "images/my-image.png")
  data: string;        // Base64 encoded data
  mimeType: string;    // MIME type
}

// Fleet extension image info (from Docker labels)
export interface FleetExtensionImage {
  id: string;           // Image ID
  repository: string;   // Repository name
  tag: string;          // Tag
  type: 'base' | 'custom';  // Fleet extension type
  title?: string;       // Human-readable title from OCI label
  baseImage?: string;   // For custom extensions, the base image used
  fleetName?: string;   // io.rancher-desktop.fleet.name label - canonical identifier for ownership
}

// Import result from image or ZIP
export interface ImportResult {
  success: boolean;
  manifest?: Manifest;
  metadata?: Record<string, unknown>;
  icons?: Map<string, string>;   // filename -> base64 content (e.g., "icons/custom-icon.png")
  images?: Map<string, string>;  // filename -> base64 content (e.g., "images/my-image.png")
  error?: string;
}

// Extension build configuration
export interface ExtensionConfig {
  name: string;
  manifest: Manifest;
  cards: CardDefinition[];
  cardOrder: string[];
  baseImage?: string;
  iconState?: IconState;  // null = default, CustomIcon = custom, 'deleted' = no icon
  iconHeight?: number;    // Custom icon height in pixels
}

// Build result
export interface BuildResult {
  success: boolean;
  imageName: string;
  output: string;
  error?: string;
}

// Get the current extension's image name from the SDK
export function detectCurrentExtensionImage(): string | null {
  const ext = ddClient.extension as { image?: string };
  return ext.image || null;
}

// Detection result with diagnostic info
export interface DetectionResult {
  image: string | null;
  source: string;  // 'sdk', 'fallback'
  details?: string;
}

// Async detection - just wraps the sync version for API compatibility
export async function detectCurrentExtensionImageAsync(): Promise<DetectionResult> {
  const ext = ddClient.extension as { image?: string };

  if (ext.image) {
    return { image: ext.image, source: 'sdk' };
  }

  return { image: null, source: 'fallback', details: 'SDK returned no image' };
}

// Generate manifest.yaml content from current state
export function generateManifestYaml(config: ExtensionConfig): string {
  // Filter out placeholder cards and reorder based on cardOrder
  const orderedCards = config.cardOrder
    .map(id => config.cards.find(c => c.id === id))
    .filter((c): c is CardDefinition => c !== undefined && c.type !== 'placeholder');

  // Build branding section, including iconHeight if not default
  const branding = config.manifest.branding || {};
  const iconHeight = config.iconHeight;
  const brandingWithIconHeight = iconHeight && iconHeight !== DEFAULT_ICON_HEIGHT
    ? { ...branding, iconHeight }
    : branding;

  const manifest: Manifest = {
    version: config.manifest.version || '1.0',
    app: {
      name: config.name || config.manifest.app?.name || 'My Fleet Extension',
      icon: config.manifest.app?.icon,
      description: config.manifest.app?.description,
    },
    branding: Object.keys(brandingWithIconHeight).length > 0 ? brandingWithIconHeight : undefined,
    layout: {
      ...config.manifest.layout,
      edit_mode: false,  // Custom extensions typically disable edit mode
    },
    cards: orderedCards.map(card => ({
      id: card.id,
      type: card.type,
      ...(card.title && { title: card.title }),
      ...(card.visible === false && { visible: false }),
      ...(card.enabled === false && { enabled: false }),
      ...(card.settings && { settings: card.settings }),
    })),
  };

  return yaml.dump(manifest, {
    indent: 2,
    lineWidth: -1,  // Don't wrap lines
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });
}

// Helper to check if iconState is a custom icon object
function isCustomIcon(iconState: IconState | undefined): iconState is CustomIcon {
  return iconState !== null && iconState !== undefined && iconState !== 'deleted';
}

// Get the icon path for metadata.json based on config
// Returns null if icon is explicitly deleted (no icon)
function getIconPath(config: ExtensionConfig): string | null {
  const { iconState } = config;

  // Explicitly deleted = no icon
  if (iconState === 'deleted') {
    return null;
  }

  // Custom icon uploaded
  if (isCustomIcon(iconState)) {
    const ext = iconState.mimeType === 'image/svg+xml' ? 'svg'
      : iconState.mimeType === 'image/png' ? 'png'
      : iconState.mimeType === 'image/jpeg' ? 'jpg'
      : iconState.mimeType === 'image/gif' ? 'gif'
      : iconState.mimeType === 'image/webp' ? 'webp'
      : 'png';
    return `/icons/custom-icon.${ext}`;
  }

  // Default = use base image's icon (don't override)
  return '/icons/fleet-icon.svg';
}

// Generate metadata.json for the extension
// Includes vm.composefile for backend service and all host binaries
export function generateMetadataJson(config: ExtensionConfig): string {
  const iconPath = getIconPath(config);
  const metadata: Record<string, unknown> = {
    ...(iconPath && { icon: iconPath }),  // Only include icon if not deleted
    vm: {
      composefile: 'compose.yaml',
      exposes: {
        socket: 'fleet-gitops.sock',
      },
    },
    ui: {
      'dashboard-tab': {
        title: config.name || 'My Fleet Extension',
        root: '/ui',
        src: 'index.html',
      },
    },
    host: {
      binaries: [
        {
          darwin: [{ path: '/host/darwin/rd-exec' }],
          linux: [{ path: '/host/linux/rd-exec' }],
          windows: [{ path: '/host/windows/rd-exec.cmd' }],
        },
        {
          darwin: [{ path: '/host/darwin/kubectl-apply-json' }],
          linux: [{ path: '/host/linux/kubectl-apply-json' }],
          windows: [{ path: '/host/windows/kubectl-apply-json.cmd' }],
        },
        {
          darwin: [{ path: '/host/darwin/gh-token' }],
          linux: [{ path: '/host/linux/gh-token' }],
          windows: [{ path: '/host/windows/gh-token.cmd' }],
        },
        {
          darwin: [{ path: '/host/darwin/gh-auth-status' }],
          linux: [{ path: '/host/linux/gh-auth-status' }],
          windows: [{ path: '/host/windows/gh-auth-status.cmd' }],
        },
        {
          darwin: [{ path: '/host/darwin/cred-helper-check' }],
          linux: [{ path: '/host/linux/cred-helper-check' }],
          windows: [{ path: '/host/windows/cred-helper-check.cmd' }],
        },
        {
          darwin: [{ path: '/host/darwin/cred-store' }],
          linux: [{ path: '/host/linux/cred-store' }],
          windows: [{ path: '/host/windows/cred-store.cmd' }],
        },
        {
          darwin: [{ path: '/host/darwin/cred-get' }],
          linux: [{ path: '/host/linux/cred-get' }],
          windows: [{ path: '/host/windows/cred-get.cmd' }],
        },
        {
          darwin: [{ path: '/host/darwin/cred-delete' }],
          linux: [{ path: '/host/linux/cred-delete' }],
          windows: [{ path: '/host/windows/cred-delete.cmd' }],
        },
      ],
    },
  };

  return JSON.stringify(metadata, null, 2);
}

// Generate a sanitized extension identifier from the name
function generateExtensionIdentifier(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'custom-fleet-extension';
}

// Generate Dockerfile for custom extension
export function generateDockerfile(config: ExtensionConfig, hasBundledImages = false): string {
  const baseImage = config.baseImage || 'ghcr.io/rancher-sandbox/fleet-gitops-extension:latest';
  const extensionName = config.name || 'My Fleet Extension';
  const extensionId = generateExtensionIdentifier(extensionName);
  const hasCustomIcon = isCustomIcon(config.iconState);
  const iconPath = getIconPath(config);

  let dockerfile = `# Custom Fleet GitOps Extension
# Generated by Fleet GitOps Extension Builder

# BASE_IMAGE ARG must be declared before FROM (for FROM instruction)
# and again after FROM (to use in labels, since ARGs reset after FROM)
ARG BASE_IMAGE="${baseImage}"
FROM \${BASE_IMAGE}
ARG BASE_IMAGE

# Extension metadata - override base image labels
LABEL org.opencontainers.image.title="${extensionName}"
LABEL org.opencontainers.image.description="Custom Fleet GitOps extension"
`;

  // Only add icon label if there's an icon path
  if (iconPath) {
    dockerfile += `LABEL com.docker.desktop.extension.icon="${iconPath}"
`;
  }

  dockerfile += `
# Mark this as a custom Fleet extension (enables config extraction)
LABEL io.rancher-desktop.fleet.type="custom"
LABEL io.rancher-desktop.fleet.name="${extensionId}"
LABEL io.rancher-desktop.fleet.base-image="\${BASE_IMAGE}"

# Override manifest with custom configuration
COPY manifest.yaml /ui/manifest.yaml

# Override metadata for custom title
COPY metadata.json /metadata.json
`;

  if (hasCustomIcon) {
    dockerfile += `
# Add custom icon
COPY icons/ /icons/
`;
  }

  if (hasBundledImages) {
    dockerfile += `
# Add bundled images for image cards
COPY images/ /images/
`;
  }

  return dockerfile;
}

// Generate a simple README for the extension package
export function generateReadme(config: ExtensionConfig): string {
  const extensionName = config.name || 'My Fleet Extension';

  return `# ${extensionName}

A customized Fleet GitOps extension for Rancher Desktop.

## Building

\`\`\`bash
docker build -t my-fleet-extension:dev .
\`\`\`

## Installing

\`\`\`bash
docker extension install my-fleet-extension:dev
\`\`\`

## Customization

- **manifest.yaml**: Card configuration and layout
- **metadata.json**: Extension title and icon path
- **icons/**: Custom icons (optional)

## Updating the Base Image

To use a different base image, modify the Dockerfile:

\`\`\`dockerfile
ARG BASE_IMAGE=ghcr.io/rancher-sandbox/fleet-gitops-extension:v1.0.0
\`\`\`

Or pass it at build time:

\`\`\`bash
docker build --build-arg BASE_IMAGE=ghcr.io/rancher-sandbox/fleet-gitops-extension:v1.0.0 -t my-fleet-extension:dev .
\`\`\`
`;
}

// Get the custom icon filename based on its MIME type
function getCustomIconFilename(customIcon: CustomIcon): string {
  const ext = customIcon.mimeType === 'image/svg+xml' ? 'svg'
    : customIcon.mimeType === 'image/png' ? 'png'
    : customIcon.mimeType === 'image/jpeg' ? 'jpg'
    : customIcon.mimeType === 'image/gif' ? 'gif'
    : customIcon.mimeType === 'image/webp' ? 'webp'
    : 'png';
  return `custom-icon.${ext}`;
}

// Get extension for a MIME type
function getExtensionForMimeType(mimeType: string): string {
  return mimeType === 'image/svg+xml' ? 'svg'
    : mimeType === 'image/png' ? 'png'
    : mimeType === 'image/jpeg' ? 'jpg'
    : mimeType === 'image/gif' ? 'gif'
    : mimeType === 'image/webp' ? 'webp'
    : 'png';
}

// Sanitize filename for safe bundling
function sanitizeFilename(filename: string): string {
  // Remove path components and special characters, keep alphanumeric, dash, underscore, dot
  return filename
    .replace(/^.*[\\/]/, '')  // Remove path
    .replace(/[^a-zA-Z0-9._-]/g, '-')  // Replace special chars
    .replace(/-+/g, '-')  // Collapse multiple dashes
    .replace(/^-|-$/g, '');  // Trim dashes
}

// Collect all bundled images from cards, returns map of card ID + index to image info
function collectBundledImages(cards: CardDefinition[]): CollectedBundledImage[] {
  const collected: CollectedBundledImage[] = [];
  const usedFilenames = new Set<string>();

  for (const card of cards) {
    if (card.type === 'image' && card.settings) {
      const settings = card.settings as ImageCardSettings;
      if (settings.bundledImage) {
        const bundledImage = settings.bundledImage;
        // Generate a unique filename based on original name
        let baseName = sanitizeFilename(bundledImage.filename);
        // If no extension, add one based on MIME type
        if (!baseName.includes('.')) {
          baseName += '.' + getExtensionForMimeType(bundledImage.mimeType);
        }

        // Ensure uniqueness by adding card ID if needed
        let finalName = baseName;
        if (usedFilenames.has(finalName)) {
          const ext = finalName.includes('.') ? '.' + finalName.split('.').pop() : '';
          const nameWithoutExt = finalName.replace(/\.[^.]+$/, '');
          finalName = `${nameWithoutExt}-${card.id}${ext}`;
        }
        usedFilenames.add(finalName);

        collected.push({
          path: `images/${finalName}`,
          data: bundledImage.data,
          mimeType: bundledImage.mimeType,
        });

        // Update the card's src to point to the bundled path
        // Note: This mutates the card which is intentional during bundling
        settings.src = `/images/${finalName}`;
      }
    }
  }

  return collected;
}

// Create a manifest for export, stripping bundledImage data from image cards
// Returns a deep clone with bundledImage removed (data is stored separately)
function createExportManifest(config: ExtensionConfig): Manifest {
  // Filter out placeholder cards and reorder based on cardOrder
  const orderedCards = config.cardOrder
    .map(id => config.cards.find(c => c.id === id))
    .filter((c): c is CardDefinition => c !== undefined && c.type !== 'placeholder');

  const exportCards = orderedCards.map(card => {
    const exportCard: CardDefinition = {
      id: card.id,
      type: card.type,
      ...(card.title && { title: card.title }),
      ...(card.visible === false && { visible: false }),
      ...(card.enabled === false && { enabled: false }),
    };

    if (card.settings) {
      if (card.type === 'image') {
        // For image cards, strip bundledImage data but keep src
        const imageSettings = card.settings as ImageCardSettings;
        exportCard.settings = {
          src: imageSettings.src,
          ...(imageSettings.alt && { alt: imageSettings.alt }),
        };
      } else {
        exportCard.settings = card.settings;
      }
    }

    return exportCard;
  });

  return {
    version: config.manifest.version || '1.0',
    app: {
      name: config.name || config.manifest.app?.name || 'My Fleet Extension',
      icon: config.manifest.app?.icon,
      description: config.manifest.app?.description,
    },
    branding: config.manifest.branding,
    layout: {
      ...config.manifest.layout,
      edit_mode: false,
    },
    cards: exportCards,
  };
}

// Create a ZIP file with all extension files
export async function createExtensionZip(config: ExtensionConfig): Promise<Blob> {
  const zip = new JSZip();

  // Collect bundled images from cards (this also updates src paths)
  const bundledImages = collectBundledImages(config.cards);

  // Create export manifest (strips bundledImage data)
  const exportManifest = createExportManifest(config);
  zip.file('manifest.yaml', yaml.dump(exportManifest, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  }));

  // Add metadata.json
  zip.file('metadata.json', generateMetadataJson(config));

  // Add Dockerfile (needs to know about bundled images)
  zip.file('Dockerfile', generateDockerfile(config, bundledImages.length > 0));

  // Add README
  zip.file('README.md', generateReadme(config));

  // Add custom icon if present
  if (isCustomIcon(config.iconState)) {
    // Decode base64 and add to icons directory
    const iconFilename = getCustomIconFilename(config.iconState);
    const binaryData = atob(config.iconState.data);
    const bytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      bytes[i] = binaryData.charCodeAt(i);
    }
    zip.file(`icons/${iconFilename}`, bytes);
  }
  // Note: If icon is deleted or default, no icons directory needed

  // Add bundled images
  for (const img of bundledImages) {
    const binaryData = atob(img.data);
    const bytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      bytes[i] = binaryData.charCodeAt(i);
    }
    zip.file(img.path, bytes);
  }

  // Generate the ZIP blob
  return await zip.generateAsync({ type: 'blob' });
}

// Trigger a file download in the browser
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Download extension as ZIP
export async function downloadExtensionZip(config: ExtensionConfig): Promise<void> {
  const blob = await createExtensionZip(config);
  const safeName = (config.name || 'my-fleet-extension')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  downloadBlob(blob, `${safeName}.zip`);
}

// Build extension using Docker via the backend API
// This uses the backend's Dockerode connection to build images directly,
// eliminating the need for an external docker:cli container.
export async function buildExtension(
  config: ExtensionConfig,
  imageName: string,
  onProgress?: (message: string) => void
): Promise<BuildResult> {
  const baseImage = config.baseImage || 'ghcr.io/rancher-sandbox/fleet-gitops-extension:latest';
  const extensionTitle = config.name || 'My Fleet Extension';
  const extensionId = generateExtensionIdentifier(extensionTitle);
  const hasCustomIcon = isCustomIcon(config.iconState);
  const isIconDeleted = config.iconState === 'deleted';

  // Collect bundled images from cards (this also updates src paths in settings)
  const bundledImages = collectBundledImages(config.cards);

  // Create export manifest (strips bundledImage data from image cards)
  const exportManifest = createExportManifest(config);
  const manifestYaml = yaml.dump(exportManifest, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });
  const metadataJson = generateMetadataJson(config);

  // Base64 encode the files for the backend API
  const manifestB64 = btoa(manifestYaml);
  const metadataB64 = btoa(metadataJson);

  // Prepare icon data if present
  const iconFilename = hasCustomIcon ? getCustomIconFilename(config.iconState as CustomIcon) : '';

  // Determine the icon path for the label (undefined if deleted = no icon label)
  const iconPath = isIconDeleted ? undefined : (hasCustomIcon ? `/icons/${iconFilename}` : '/icons/fleet-icon.svg');

  onProgress?.('Preparing build context...');

  try {
    onProgress?.('Starting Docker build via backend...');

    // Build the request for the backend API
    const buildRequest = {
      imageName,
      baseImage,
      title: extensionTitle,
      extensionId,
      manifest: manifestB64,
      metadata: metadataB64,
      iconPath,
      icon: hasCustomIcon ? {
        filename: iconFilename,
        data: (config.iconState as CustomIcon).data,
      } : undefined,
      bundledImages: bundledImages.length > 0 ? bundledImages.map(img => ({
        path: img.path,
        data: img.data,
      })) : undefined,
    };

    // Call the backend API to build the image
    const result = await backendService.buildImage(buildRequest);

    if (result.success) {
      onProgress?.('Build completed!');
    } else {
      onProgress?.(`Build failed: ${result.error}`);
    }

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    return {
      success: false,
      imageName,
      output: '',
      error: errorMessage,
    };
  }
}

// List local Docker images that are Fleet extensions (have the fleet label)
export async function listFleetExtensionImages(): Promise<FleetExtensionImage[]> {
  try {
    // First, get image IDs that have the fleet label
    const listResult = await ddClient.docker.cli.exec('images', [
      '--filter', 'label=io.rancher-desktop.fleet.type',
      '--format', '{{.ID}}',
    ]);

    const imageIds = (listResult.stdout || '').split('\n').filter(id => id.trim());
    if (imageIds.length === 0) {
      return [];
    }

    // Then inspect those images to get full details including labels
    const inspectResult = await ddClient.docker.cli.exec('inspect', imageIds);
    const inspectData = JSON.parse(inspectResult.stdout || '[]');

    const images: FleetExtensionImage[] = [];

    for (const img of inspectData) {
      const labels = img.Config?.Labels || {};
      const fleetType = labels['io.rancher-desktop.fleet.type'];

      if (fleetType) {
        // Get repository and tag from RepoTags
        const repoTag = img.RepoTags?.[0] || '';
        const [repository, tag] = repoTag.includes(':')
          ? [repoTag.substring(0, repoTag.lastIndexOf(':')), repoTag.substring(repoTag.lastIndexOf(':') + 1)]
          : [repoTag, 'latest'];

        images.push({
          id: img.Id?.substring(7, 19) || '', // Short ID (remove sha256: prefix)
          repository,
          tag,
          type: fleetType as 'base' | 'custom',
          title: labels['org.opencontainers.image.title'],
          baseImage: labels['io.rancher-desktop.fleet.base-image'],
          fleetName: labels['io.rancher-desktop.fleet.name'],
        });
      }
    }

    return images;
  } catch (err) {
    console.error('Failed to list Fleet extension images:', err);
    return [];
  }
}

// Extract configuration from a Fleet extension Docker image
export async function importConfigFromImage(imageName: string): Promise<ImportResult> {
  try {
    // Run the export-config command in the image
    const result = await ddClient.docker.cli.exec('run', [
      '--rm',
      imageName,
      'export-config',
    ]);

    const output = result.stdout || '';

    // Parse the JSON output from export-config
    let exportData: { version: string; files: Record<string, string> };
    try {
      exportData = JSON.parse(output);
    } catch {
      return {
        success: false,
        error: 'Failed to parse export-config output as JSON',
      };
    }

    // Decode the base64 files
    let manifest: Manifest | undefined;
    let metadata: Record<string, unknown> | undefined;
    const icons = new Map<string, string>();
    const images = new Map<string, string>();

    for (const [filename, base64Content] of Object.entries(exportData.files)) {
      if (filename === 'manifest.yaml') {
        try {
          const content = atob(base64Content);
          manifest = yaml.load(content) as Manifest;
        } catch (e) {
          return {
            success: false,
            error: `Failed to parse manifest.yaml: ${e}`,
          };
        }
      } else if (filename === 'metadata.json') {
        try {
          const content = atob(base64Content);
          metadata = JSON.parse(content);
        } catch (e) {
          return {
            success: false,
            error: `Failed to parse metadata.json: ${e}`,
          };
        }
      } else if (filename.startsWith('icons/')) {
        // Keep icons as base64 for later use
        icons.set(filename, base64Content);
      } else if (filename.startsWith('images/')) {
        // Keep bundled images as base64 for later use
        images.set(filename, base64Content);
      }
    }

    if (!manifest) {
      return {
        success: false,
        error: 'No manifest.yaml found in exported config',
      };
    }

    return {
      success: true,
      manifest,
      metadata,
      icons,
      images,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    // Try to extract useful output from the error (Docker SDK errors have stderr/stdout)
    const errorOutput = (err as { stderr?: string; stdout?: string })?.stderr ||
                        (err as { stderr?: string; stdout?: string })?.stdout ||
                        errorMessage;
    return {
      success: false,
      error: `Failed to extract config from image: ${errorOutput}`,
    };
  }
}

// Restore bundledImage data to image cards based on imported images
// This matches card src paths (e.g., "/images/my-image.png") to image files
export function restoreBundledImages(
  cards: CardDefinition[],
  images: Map<string, string>
): void {
  for (const card of cards) {
    if (card.type === 'image' && card.settings) {
      const settings = card.settings as ImageCardSettings;
      // Check if src points to a bundled image path
      if (settings.src?.startsWith('/images/')) {
        // Convert src path to the key format used in the map (without leading /)
        const imagePath = settings.src.substring(1);  // Remove leading /
        const base64Data = images.get(imagePath);

        if (base64Data) {
          // Determine MIME type from filename
          const filename = imagePath.split('/').pop() || 'image.png';
          const ext = filename.split('.').pop()?.toLowerCase() || 'png';
          const mimeType = ext === 'svg' ? 'image/svg+xml'
            : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
            : ext === 'gif' ? 'image/gif'
            : ext === 'webp' ? 'image/webp'
            : 'image/png';

          // Restore the bundledImage data
          const restoredImage: BundledImage = {
            data: base64Data,
            filename,
            mimeType,
          };
          settings.bundledImage = restoredImage;
        }
      }
    }
  }
}

// Import configuration from an uploaded ZIP file
export async function importConfigFromZip(file: File): Promise<ImportResult> {
  try {
    const zip = await JSZip.loadAsync(file);

    let manifest: Manifest | undefined;
    let metadata: Record<string, unknown> | undefined;
    const icons = new Map<string, string>();
    const images = new Map<string, string>();

    // Look for manifest.yaml
    const manifestFile = zip.file('manifest.yaml');
    if (manifestFile) {
      const content = await manifestFile.async('string');
      try {
        manifest = yaml.load(content) as Manifest;
      } catch (e) {
        return {
          success: false,
          error: `Failed to parse manifest.yaml: ${e}`,
        };
      }
    }

    // Look for metadata.json
    const metadataFile = zip.file('metadata.json');
    if (metadataFile) {
      const content = await metadataFile.async('string');
      try {
        metadata = JSON.parse(content);
      } catch (e) {
        return {
          success: false,
          error: `Failed to parse metadata.json: ${e}`,
        };
      }
    }

    // Look for icons in icons/ directory
    const iconFiles = zip.file(/^icons\/.+/);
    for (const iconFile of iconFiles) {
      if (!iconFile.dir) {
        const base64Content = await iconFile.async('base64');
        icons.set(iconFile.name, base64Content);
      }
    }

    // Look for bundled images in images/ directory
    const imageFiles = zip.file(/^images\/.+/);
    for (const imageFile of imageFiles) {
      if (!imageFile.dir) {
        const base64Content = await imageFile.async('base64');
        images.set(imageFile.name, base64Content);
      }
    }

    if (!manifest) {
      return {
        success: false,
        error: 'No manifest.yaml found in ZIP file',
      };
    }

    return {
      success: true,
      manifest,
      metadata,
      icons,
      images,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Failed to read ZIP file: ${errorMessage}`,
    };
  }
}
