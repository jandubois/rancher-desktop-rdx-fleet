/**
 * Build Service - Build Docker images using the Docker API.
 *
 * Uses Dockerode to build images directly through the Docker socket,
 * eliminating the need for a separate docker:cli container.
 */

import Dockerode from 'dockerode';
import * as tar from 'tar-stream';
import { PassThrough, Readable } from 'stream';

/** Build request from the UI */
export interface BuildRequest {
  imageName: string;
  baseImage: string;
  title: string;
  manifest: string;      // Base64 encoded manifest.yaml content
  metadata: string;      // Base64 encoded metadata.json content
  iconPath?: string;     // Path for icon label (e.g., "/icons/custom-icon.svg")
  headerBackground?: string;  // Header background color for the extension
  icon?: {               // Custom icon data
    filename: string;    // e.g., "custom-icon.svg"
    data: string;        // Base64 encoded icon data
  };
  bundledImages?: Array<{  // Bundled images for image cards
    path: string;        // e.g., "images/my-image.png"
    data: string;        // Base64 encoded image data
  }>;
}

/** Build progress event */
export interface BuildProgress {
  type: 'progress' | 'error' | 'complete';
  message: string;
  stream?: string;       // Raw Docker build stream output
}

/** Build result */
export interface BuildResult {
  success: boolean;
  imageName: string;
  output: string;
  error?: string;
}

/** Push result */
export interface PushResult {
  success: boolean;
  imageName: string;
  output: string;
  error?: string;
}

/** Push progress event */
export interface PushProgress {
  type: 'progress' | 'error' | 'complete';
  message: string;
}

// ============================================================
// Exported utility functions for testing
// ============================================================

/**
 * Check if an image name is pushable to a registry.
 *
 * Returns true if:
 * - The image contains a registry (e.g., "ghcr.io/org/repo", "registry.example.com/repo")
 * - The image has an org/repo format (e.g., "myorg/my-extension")
 *
 * Returns false if:
 * - It's just a simple name like "my-extension" (maps to "library/my-extension" on Docker Hub)
 *
 * @param imageName - The image name to check (may include tag)
 * @returns true if the image can be pushed
 */
export function isPushableImageName(imageName: string): boolean {
  // Docker image naming: [registry[:port]/][namespace/]repository[:tag]
  // A tag is only the part after the last colon that comes after all slashes
  // Example: registry.example.com:5000/my-extension:dev
  //   - registry.example.com:5000 is the registry with port
  //   - my-extension is the repository
  //   - dev is the tag

  // First check if there's a slash - if not, it's definitely a simple name
  if (!imageName.includes('/')) {
    return false;
  }

  // Has at least one slash - could be "org/repo" or "registry/org/repo"
  // Either way, it's pushable as long as it's not just a simple name
  return true;
}

/**
 * Generate Dockerfile content for the custom extension.
 * Creates a multi-stage Dockerfile that extends a base image with custom configuration.
 */
export function generateDockerfile(request: BuildRequest): string {
  const hasCustomIcon = !!request.icon;
  const hasBundledImages = request.bundledImages && request.bundledImages.length > 0;

  // Note: BASE_IMAGE ARG must be declared before FROM (for FROM instruction)
  // and again after FROM (to use in labels, since ARGs reset after FROM)
  let dockerfile = `# Custom Fleet GitOps Extension
# Built via Docker API

ARG BASE_IMAGE="${request.baseImage}"
FROM \${BASE_IMAGE}
ARG BASE_IMAGE

# Extension metadata - override base image labels
LABEL org.opencontainers.image.title="${request.title}"
LABEL org.opencontainers.image.description="Custom Fleet GitOps extension"
`;

  // Only add icon label if there's an icon path
  if (request.iconPath) {
    dockerfile += `LABEL com.docker.desktop.extension.icon="${request.iconPath}"
`;
  }

  dockerfile += `
# Mark this as a custom Fleet extension (enables config extraction)
LABEL io.rancher-desktop.fleet.type="custom"
LABEL io.rancher-desktop.fleet.base-image="\${BASE_IMAGE}"`;

  // Add header background color label if provided
  if (request.headerBackground) {
    dockerfile += `
LABEL io.rancher-desktop.fleet.header-background="${request.headerBackground}"`;
  }

  dockerfile += `

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

/**
 * Create a tar archive containing the build context.
 * Includes Dockerfile, manifest, metadata, and optional icons/images.
 */
export async function createBuildContext(request: BuildRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pack = tar.pack();
    const chunks: Buffer[] = [];

    // Collect the tar output
    const passThrough = new PassThrough();
    pack.pipe(passThrough);
    passThrough.on('data', (chunk: Buffer) => chunks.push(chunk));
    passThrough.on('end', () => resolve(Buffer.concat(chunks)));
    passThrough.on('error', reject);

    try {
      // Add Dockerfile
      const dockerfile = generateDockerfile(request);
      pack.entry({ name: 'Dockerfile' }, dockerfile);

      // Add manifest.yaml (decode from base64)
      const manifestContent = Buffer.from(request.manifest, 'base64').toString('utf-8');
      pack.entry({ name: 'manifest.yaml' }, manifestContent);

      // Add metadata.json (decode from base64)
      const metadataContent = Buffer.from(request.metadata, 'base64').toString('utf-8');
      pack.entry({ name: 'metadata.json' }, metadataContent);

      // Add custom icon if present
      if (request.icon) {
        const iconData = Buffer.from(request.icon.data, 'base64');
        pack.entry({ name: `icons/${request.icon.filename}` }, iconData);
      }

      // Add bundled images if present
      if (request.bundledImages) {
        for (const img of request.bundledImages) {
          const imageData = Buffer.from(img.data, 'base64');
          pack.entry({ name: img.path }, imageData);
        }
      }

      // Finalize the tar archive
      pack.finalize();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Service for building Docker images via the Docker API.
 */
export class BuildService {
  private docker: Dockerode;
  private debugLog: string[] = [];

  constructor(socketPath: string = '/var/run/docker.sock') {
    this.docker = new Dockerode({ socketPath });
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}`;
    console.log(`[Build] ${message}`);
    this.debugLog.push(entry);
    if (this.debugLog.length > 100) {
      this.debugLog = this.debugLog.slice(-100);
    }
  }

  /**
   * Get the debug log.
   */
  getDebugLog(): string[] {
    return [...this.debugLog];
  }

  // generateDockerfile and createBuildContext are now exported functions at module level

  /**
   * Build a Docker image from the provided configuration.
   *
   * @param request - The build request containing all necessary data
   * @param onProgress - Optional callback for progress updates
   * @returns Build result with success status and output
   */
  async buildImage(
    request: BuildRequest,
    onProgress?: (progress: BuildProgress) => void
  ): Promise<BuildResult> {
    this.log(`Starting build for image: ${request.imageName}`);
    this.log(`Base image: ${request.baseImage}`);

    const output: string[] = [];

    try {
      // Create the build context tar archive
      onProgress?.({ type: 'progress', message: 'Creating build context...' });
      const buildContext = await createBuildContext(request);
      this.log(`Build context created: ${buildContext.length} bytes`);

      // Start the build
      onProgress?.({ type: 'progress', message: 'Starting Docker build...' });

      // Convert Buffer to a readable stream for Dockerode
      const contextStream = Readable.from(buildContext);

      const buildStream = await this.docker.buildImage(contextStream, {
        t: request.imageName,
        buildargs: {
          BASE_IMAGE: request.baseImage,
        },
      });

      // Process the build output stream
      await new Promise<void>((resolve, reject) => {
        this.docker.modem.followProgress(
          buildStream,
          (err: Error | null, result: Array<{ stream?: string; error?: string; errorDetail?: { message: string } }>) => {
            if (err) {
              this.log(`Build error: ${err.message}`);
              reject(err);
            } else {
              // Check for errors in the final result
              const errorResult = result.find(r => r.error);
              if (errorResult) {
                const errorMsg = errorResult.errorDetail?.message || errorResult.error || 'Unknown build error';
                this.log(`Build failed: ${errorMsg}`);
                reject(new Error(errorMsg));
              } else {
                this.log('Build completed successfully');
                resolve();
              }
            }
          },
          (event: { stream?: string; status?: string; progress?: string; error?: string }) => {
            // Progress callback - called for each build step
            if (event.stream) {
              const line = event.stream.trim();
              if (line) {
                output.push(line);
                onProgress?.({
                  type: 'progress',
                  message: line,
                  stream: event.stream,
                });
              }
            } else if (event.status) {
              const statusLine = event.progress
                ? `${event.status}: ${event.progress}`
                : event.status;
              output.push(statusLine);
              onProgress?.({
                type: 'progress',
                message: statusLine,
              });
            } else if (event.error) {
              output.push(`ERROR: ${event.error}`);
              onProgress?.({
                type: 'error',
                message: event.error,
              });
            }
          }
        );
      });

      onProgress?.({ type: 'complete', message: `Build complete: ${request.imageName}` });

      return {
        success: true,
        imageName: request.imageName,
        output: output.join('\n'),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`Build failed: ${errorMessage}`);

      onProgress?.({ type: 'error', message: errorMessage });

      return {
        success: false,
        imageName: request.imageName,
        output: output.join('\n'),
        error: errorMessage,
      };
    }
  }

  /**
   * Push a Docker image to a registry.
   *
   * @param imageName - The image name to push (including tag)
   * @param onProgress - Optional callback for progress updates
   * @returns Push result with success status and output
   */
  async pushImage(
    imageName: string,
    onProgress?: (progress: PushProgress) => void
  ): Promise<PushResult> {
    this.log(`Starting push for image: ${imageName}`);

    // Check if the image name is pushable
    if (!isPushableImageName(imageName)) {
      const error = `Image name "${imageName}" cannot be pushed. Use a name with an org/repo format (e.g., "myorg/my-extension") or include a registry (e.g., "ghcr.io/myorg/my-extension").`;
      this.log(`Push rejected: ${error}`);
      return {
        success: false,
        imageName,
        output: '',
        error,
      };
    }

    const output: string[] = [];

    try {
      // Get the image
      onProgress?.({ type: 'progress', message: 'Preparing to push...' });
      const image = this.docker.getImage(imageName);

      // Start the push
      onProgress?.({ type: 'progress', message: `Pushing ${imageName}...` });

      const pushStream = await image.push({});

      // Process the push output stream
      await new Promise<void>((resolve, reject) => {
        this.docker.modem.followProgress(
          pushStream,
          (err: Error | null, result: Array<{ error?: string; errorDetail?: { message: string } }>) => {
            if (err) {
              this.log(`Push error: ${err.message}`);
              reject(err);
            } else {
              // Check for errors in the final result
              const errorResult = result.find(r => r.error);
              if (errorResult) {
                const errorMsg = errorResult.errorDetail?.message || errorResult.error || 'Unknown push error';
                this.log(`Push failed: ${errorMsg}`);
                reject(new Error(errorMsg));
              } else {
                this.log('Push completed successfully');
                resolve();
              }
            }
          },
          (event: { status?: string; progress?: string; error?: string; id?: string }) => {
            // Progress callback - called for each push step
            if (event.status) {
              const statusLine = event.id
                ? `${event.id}: ${event.status}${event.progress ? ' ' + event.progress : ''}`
                : event.status;
              output.push(statusLine);
              onProgress?.({
                type: 'progress',
                message: statusLine,
              });
            } else if (event.error) {
              output.push(`ERROR: ${event.error}`);
              onProgress?.({
                type: 'error',
                message: event.error,
              });
            }
          }
        );
      });

      onProgress?.({ type: 'complete', message: `Push complete: ${imageName}` });

      return {
        success: true,
        imageName,
        output: output.join('\n'),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`Push failed: ${errorMessage}`);

      onProgress?.({ type: 'error', message: errorMessage });

      return {
        success: false,
        imageName,
        output: output.join('\n'),
        error: errorMessage,
      };
    }
  }
}

// Singleton instance
export const buildService = new BuildService();
