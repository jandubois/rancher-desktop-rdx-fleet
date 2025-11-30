import yaml from 'js-yaml';
import JSZip from 'jszip';
import { Manifest, CardDefinition } from '../manifest';
import { ddClient } from '../lib/ddClient';
import type { CustomIcon } from '../components/IconUpload';
import type { IconState } from '../components/EditableHeaderIcon';

// Fleet extension image info (from Docker labels)
export interface FleetExtensionImage {
  id: string;           // Image ID
  repository: string;   // Repository name
  tag: string;          // Tag
  type: 'base' | 'custom';  // Fleet extension type
  title?: string;       // Human-readable title from OCI label
  baseImage?: string;   // For custom extensions, the base image used
}

// Import result from image or ZIP
export interface ImportResult {
  success: boolean;
  manifest?: Manifest;
  metadata?: Record<string, unknown>;
  icons?: Map<string, string>;  // filename -> base64 content
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
  // Rancher Desktop Extension interface has:
  // - id: image ID excluding tag
  // - version: image tag
  // - image: should be full image but appears buggy (missing tag)
  const ext = ddClient.extension as { id?: string; version?: string; image?: string };

  // Try combining id + version first
  if (ext.id && ext.version) {
    return `${ext.id}:${ext.version}`;
  }
  // Fall back to image if it has a tag
  if (ext.image?.includes(':')) {
    return ext.image;
  }
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
  const ext = ddClient.extension as { id?: string; version?: string; image?: string };

  // Try combining id + version first (workaround for buggy image property)
  if (ext.id && ext.version) {
    const fullImage = `${ext.id}:${ext.version}`;
    return { image: fullImage, source: 'sdk', details: `id=${ext.id}, version=${ext.version}` };
  }

  // Fall back to image property
  if (ext.image) {
    // Check if tag is missing (Rancher Desktop bug)
    if (!ext.image.includes(':')) {
      return {
        image: ext.image,
        source: 'sdk',
        details: 'WARNING: tag missing - please add manually (e.g., :next or :latest)'
      };
    }
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

  const manifest: Manifest = {
    version: config.manifest.version || '1.0',
    app: {
      name: config.name || config.manifest.app?.name || 'My Fleet Extension',
      icon: config.manifest.app?.icon,
      description: config.manifest.app?.description,
    },
    branding: config.manifest.branding,
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
// Inherits host binaries from base extension for kubectl/helm access
export function generateMetadataJson(config: ExtensionConfig): string {
  const iconPath = getIconPath(config);
  const metadata: Record<string, unknown> = {
    ...(iconPath && { icon: iconPath }),  // Only include icon if not deleted
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
          darwin: [{ path: '/host/darwin/kubectl' }],
          linux: [{ path: '/host/linux/kubectl' }],
          windows: [{ path: '/host/windows/kubectl.cmd' }],
        },
        {
          darwin: [{ path: '/host/darwin/helm' }],
          linux: [{ path: '/host/linux/helm' }],
          windows: [{ path: '/host/windows/helm.cmd' }],
        },
        {
          darwin: [{ path: '/host/darwin/kubectl-apply-json' }],
          linux: [{ path: '/host/linux/kubectl-apply-json' }],
          windows: [{ path: '/host/windows/kubectl-apply-json.cmd' }],
        },
        {
          darwin: [{ path: '/host/darwin/rd-exec' }],
          linux: [{ path: '/host/linux/rd-exec' }],
          windows: [{ path: '/host/windows/rd-exec.cmd' }],
        },
      ],
    },
  };

  return JSON.stringify(metadata, null, 2);
}

// Generate Dockerfile for custom extension
export function generateDockerfile(config: ExtensionConfig): string {
  const baseImage = config.baseImage || 'ghcr.io/rancher-sandbox/fleet-gitops:latest';
  const extensionName = config.name || 'My Fleet Extension';
  const hasCustomIcon = isCustomIcon(config.iconState);
  const iconPath = getIconPath(config);

  let dockerfile = `# Custom Fleet GitOps Extension
# Generated by Fleet GitOps Extension Builder

ARG BASE_IMAGE="${baseImage}"
FROM \${BASE_IMAGE}

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
ARG BASE_IMAGE=ghcr.io/rancher-sandbox/fleet-gitops:v1.0.0
\`\`\`

Or pass it at build time:

\`\`\`bash
docker build --build-arg BASE_IMAGE=ghcr.io/rancher-sandbox/fleet-gitops:v1.0.0 -t my-fleet-extension:dev .
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

// Create a ZIP file with all extension files
export async function createExtensionZip(config: ExtensionConfig): Promise<Blob> {
  const zip = new JSZip();

  // Add manifest.yaml
  zip.file('manifest.yaml', generateManifestYaml(config));

  // Add metadata.json
  zip.file('metadata.json', generateMetadataJson(config));

  // Add Dockerfile
  zip.file('Dockerfile', generateDockerfile(config));

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

// Build extension using Docker
export async function buildExtension(
  config: ExtensionConfig,
  imageName: string,
  onProgress?: (message: string) => void
): Promise<BuildResult> {
  const baseImage = config.baseImage || 'ghcr.io/rancher-sandbox/fleet-gitops:latest';
  const extensionTitle = config.name || 'My Fleet Extension';
  const hasCustomIcon = isCustomIcon(config.iconState);
  const isIconDeleted = config.iconState === 'deleted';

  // Generate the files
  const manifestYaml = generateManifestYaml(config);
  const metadataJson = generateMetadataJson(config);

  // Base64 encode the files for passing as environment variables
  const manifestB64 = btoa(manifestYaml);
  const metadataB64 = btoa(metadataJson);

  // Prepare icon data if present
  const iconB64 = hasCustomIcon ? (config.iconState as CustomIcon).data : '';
  const iconFilename = hasCustomIcon ? getCustomIconFilename(config.iconState as CustomIcon) : '';

  // Base64 encode the title to safely pass it (handles special characters)
  const titleB64 = btoa(extensionTitle);

  // Determine the icon path for the label (empty string if deleted = no icon label)
  const iconPath = isIconDeleted ? '' : (hasCustomIcon ? `/icons/${iconFilename}` : '/icons/fleet-icon.svg');

  onProgress?.('Preparing build context...');

  // Build script that runs inside the helper container
  // This creates the build context and runs docker build
  const buildScript = `
set -e
mkdir -p /build/icons
cd /build

# Decode manifest and metadata from base64
echo "$MANIFEST_B64" | base64 -d > manifest.yaml
echo "$METADATA_B64" | base64 -d > metadata.json

# Decode the extension title from base64
EXT_TITLE_DECODED=$(echo "$TITLE_B64" | base64 -d)

# Decode custom icon if present
if [ -n "$ICON_B64" ] && [ -n "$ICON_FILENAME" ]; then
  echo "$ICON_B64" | base64 -d > "icons/$ICON_FILENAME"
fi

# Create the Dockerfile using unquoted heredoc for variable expansion
# Note: BASE_IMAGE needs to stay as a Docker ARG for build-time substitution
cat > Dockerfile << EOF
ARG BASE_IMAGE=base-image-not-set
FROM \\\${BASE_IMAGE}
LABEL org.opencontainers.image.title="$EXT_TITLE_DECODED"
LABEL org.opencontainers.image.description="Custom Fleet GitOps extension"
LABEL io.rancher-desktop.fleet.type="custom"
LABEL io.rancher-desktop.fleet.base-image="\\\${BASE_IMAGE}"
COPY manifest.yaml /ui/manifest.yaml
COPY metadata.json /metadata.json
EOF

# Add icon label only if ICON_PATH is set (not deleted)
if [ -n "$ICON_PATH" ]; then
  sed -i '/^LABEL org.opencontainers.image.description/a LABEL com.docker.desktop.extension.icon="'"$ICON_PATH"'"' Dockerfile
fi

# Add icon copy instruction if custom icon is present
if [ "$HAS_CUSTOM_ICON" = "true" ]; then
  echo "COPY icons/ /icons/" >> Dockerfile
fi

# Build the image
docker build \\
  --build-arg BASE_IMAGE="$BASE_IMAGE" \\
  -t "$IMAGE_NAME" \\
  .

echo "Build complete: $IMAGE_NAME"
`;

  try {
    onProgress?.('Starting Docker build...');

    // Run the build using a helper container with docker CLI
    // Mount the docker socket so it can build images
    const envVars = [
      '-e', `MANIFEST_B64=${manifestB64}`,
      '-e', `METADATA_B64=${metadataB64}`,
      '-e', `IMAGE_NAME=${imageName}`,
      '-e', `TITLE_B64=${titleB64}`,
      '-e', `ICON_PATH=${iconPath}`,
      '-e', `BASE_IMAGE=${baseImage}`,
      '-e', `HAS_CUSTOM_ICON=${hasCustomIcon}`,
    ];

    // Add icon environment variables if present
    if (hasCustomIcon) {
      envVars.push('-e', `ICON_B64=${iconB64}`);
      envVars.push('-e', `ICON_FILENAME=${iconFilename}`);
    }

    const result = await ddClient.docker.cli.exec('run', [
      '--rm',
      '-v', '/var/run/docker.sock:/var/run/docker.sock',
      ...envVars,
      'docker:cli',
      'sh', '-c', buildScript,
    ]);

    const output = result.stdout || '';
    const stderr = result.stderr || '';

    onProgress?.('Build completed!');

    return {
      success: true,
      imageName,
      output: output + (stderr ? `\n${stderr}` : ''),
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    // Try to extract useful output from the error
    const errorOutput = (err as { stderr?: string; stdout?: string })?.stderr ||
                        (err as { stderr?: string; stdout?: string })?.stdout ||
                        errorMessage;

    return {
      success: false,
      imageName,
      output: '',
      error: errorOutput,
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

      if (fleetType === 'custom') {
        // Get repository and tag from RepoTags
        const repoTag = img.RepoTags?.[0] || '';
        const [repository, tag] = repoTag.includes(':')
          ? [repoTag.substring(0, repoTag.lastIndexOf(':')), repoTag.substring(repoTag.lastIndexOf(':') + 1)]
          : [repoTag, 'latest'];

        images.push({
          id: img.Id?.substring(7, 19) || '', // Short ID (remove sha256: prefix)
          repository,
          tag,
          type: fleetType,
          title: labels['org.opencontainers.image.title'],
          baseImage: labels['io.rancher-desktop.fleet.base-image'],
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

    for (const [filename, base64Content] of Object.entries(exportData.files)) {
      const content = atob(base64Content);

      if (filename === 'manifest.yaml') {
        try {
          manifest = yaml.load(content) as Manifest;
        } catch (e) {
          return {
            success: false,
            error: `Failed to parse manifest.yaml: ${e}`,
          };
        }
      } else if (filename === 'metadata.json') {
        try {
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
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Failed to extract config from image: ${errorMessage}`,
    };
  }
}

// Import configuration from an uploaded ZIP file
export async function importConfigFromZip(file: File): Promise<ImportResult> {
  try {
    const zip = await JSZip.loadAsync(file);

    let manifest: Manifest | undefined;
    let metadata: Record<string, unknown> | undefined;
    const icons = new Map<string, string>();

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
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Failed to read ZIP file: ${errorMessage}`,
    };
  }
}
