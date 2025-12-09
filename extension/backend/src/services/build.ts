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

  /**
   * Generate Dockerfile content for the custom extension.
   */
  private generateDockerfile(request: BuildRequest): string {
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
   */
  private async createBuildContext(request: BuildRequest): Promise<Buffer> {
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
        const dockerfile = this.generateDockerfile(request);
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
      const buildContext = await this.createBuildContext(request);
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
}

// Singleton instance
export const buildService = new BuildService();
