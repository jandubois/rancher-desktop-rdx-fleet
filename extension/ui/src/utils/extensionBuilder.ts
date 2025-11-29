import yaml from 'js-yaml';
import JSZip from 'jszip';
import { Manifest, CardDefinition } from '../manifest';
import { ddClient } from '../lib/ddClient';

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

// Generate metadata.json for the extension
// Inherits host binaries from base extension for kubectl/helm access
export function generateMetadataJson(config: ExtensionConfig): string {
  const metadata = {
    icon: '/icons/fleet-icon.svg',
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

  return `# Custom Fleet GitOps Extension
# Generated by Fleet GitOps Extension Builder

ARG BASE_IMAGE="${baseImage}"
FROM \${BASE_IMAGE}

# Extension metadata
LABEL org.opencontainers.image.title="${extensionName}"
LABEL org.opencontainers.image.description="Custom Fleet GitOps extension"

# Mark this as a custom Fleet extension (enables config extraction)
LABEL io.rancher-desktop.fleet.type="custom"
LABEL io.rancher-desktop.fleet.base-image="\${BASE_IMAGE}"

# Override manifest with custom configuration
COPY manifest.yaml /ui/manifest.yaml

# Override metadata for custom title
COPY metadata.json /metadata.json

# Add custom icon (optional - uncomment if you have a custom icon)
# COPY icons/ /icons/
`;
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

  // Add a placeholder icon directory with a note
  zip.file('icons/.gitkeep', '# Add your custom icons here\n');

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

  // Generate the files
  const manifestYaml = generateManifestYaml(config);
  const metadataJson = generateMetadataJson(config);

  // Base64 encode the files for passing as environment variables
  const manifestB64 = btoa(manifestYaml);
  const metadataB64 = btoa(metadataJson);

  onProgress?.('Preparing build context...');

  // Build script that runs inside the helper container
  // This creates the build context and runs docker build
  // Note: Using quoted heredoc delimiter means no escaping needed for ${}
  const buildScript = `
set -e
mkdir -p /build
cd /build

# Decode manifest and metadata from base64
echo "$MANIFEST_B64" | base64 -d > manifest.yaml
echo "$METADATA_B64" | base64 -d > metadata.json

# Create the Dockerfile (quoted heredoc - content is literal)
cat > Dockerfile << 'DOCKERFILE'
ARG BASE_IMAGE=base-image-not-set
FROM \${BASE_IMAGE}
ARG EXT_TITLE
LABEL org.opencontainers.image.title="\${EXT_TITLE}"
LABEL org.opencontainers.image.description="Custom Fleet GitOps extension"
COPY manifest.yaml /ui/manifest.yaml
COPY metadata.json /metadata.json
DOCKERFILE

# Build the image
docker build \\
  --build-arg BASE_IMAGE="$BASE_IMAGE" \\
  --build-arg EXT_TITLE="$EXT_TITLE" \\
  -t "$IMAGE_NAME" \\
  .

echo "Build complete: $IMAGE_NAME"
`;

  try {
    onProgress?.('Starting Docker build...');

    // Run the build using a helper container with docker CLI
    // Mount the docker socket so it can build images
    const result = await ddClient.docker.cli.exec('run', [
      '--rm',
      '-v', '/var/run/docker.sock:/var/run/docker.sock',
      '-e', `MANIFEST_B64=${manifestB64}`,
      '-e', `METADATA_B64=${metadataB64}`,
      '-e', `IMAGE_NAME=${imageName}`,
      '-e', `EXT_TITLE=${extensionTitle}`,
      '-e', `BASE_IMAGE=${baseImage}`,
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
    // Use docker images with filter and format to get Fleet extension images
    const result = await ddClient.docker.cli.exec('images', [
      '--filter', 'label=io.rancher-desktop.fleet.type',
      '--format', '{{.ID}}|{{.Repository}}|{{.Tag}}|{{json .Labels}}',
    ]);

    const output = result.stdout || '';
    const images: FleetExtensionImage[] = [];

    for (const line of output.split('\n')) {
      if (!line.trim()) continue;

      const parts = line.split('|');
      if (parts.length < 4) continue;

      const [id, repository, tag, labelsJson] = parts;

      try {
        // Parse the labels JSON - Docker outputs it as a JSON object
        // Handle the case where it might be escaped or have issues
        let labels: Record<string, string> = {};
        try {
          labels = JSON.parse(labelsJson);
        } catch {
          // If JSON parsing fails, try to extract just what we need
          continue;
        }

        const fleetType = labels['io.rancher-desktop.fleet.type'];
        if (fleetType === 'base' || fleetType === 'custom') {
          images.push({
            id,
            repository,
            tag,
            type: fleetType,
            title: labels['org.opencontainers.image.title'],
            baseImage: labels['io.rancher-desktop.fleet.base-image'],
          });
        }
      } catch {
        // Skip images with unparseable labels
        continue;
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
