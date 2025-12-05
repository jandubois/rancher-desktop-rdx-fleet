/**
 * Icons Service - Extract icons from Docker images.
 *
 * Uses Dockerode to extract icon files from images without starting a container.
 * Creates a temporary container, copies the file, then removes the container.
 */

import Dockerode from 'dockerode';
import * as tar from 'tar-stream';
import { Readable } from 'stream';

/** Icon extraction result */
export interface IconResult {
  data: string;      // Base64 encoded icon data
  mimeType: string;  // MIME type of the icon
}

/** Full Fleet image info including icon data */
export interface FleetImageWithIcon {
  id: string;
  repository: string;
  tag: string;
  type: 'base' | 'custom';
  title?: string;
  baseImage?: string;
  iconPath?: string;
  iconData?: string;
  iconMimeType?: string;
}

/**
 * Service for extracting icons from Docker images.
 */
export class IconsService {
  private docker: Dockerode;
  private debugLog: string[] = [];

  constructor(socketPath: string = '/var/run/docker.sock') {
    this.docker = new Dockerode({ socketPath });
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}`;
    console.log(`[Icons] ${message}`);
    this.debugLog.push(entry);
    if (this.debugLog.length > 50) {
      this.debugLog = this.debugLog.slice(-50);
    }
  }

  /**
   * Get the debug log.
   */
  getDebugLog(): string[] {
    return [...this.debugLog];
  }

  /**
   * Get MIME type from file extension.
   */
  private getMimeType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || 'png';
    switch (ext) {
      case 'svg': return 'image/svg+xml';
      case 'png': return 'image/png';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'gif': return 'image/gif';
      case 'webp': return 'image/webp';
      default: return 'image/png';
    }
  }

  /**
   * Extract icon from a Docker image.
   *
   * Creates a temporary container (without starting it), copies the icon file,
   * then removes the container.
   *
   * @param imageName - Full image name (e.g., "ghcr.io/rancher-sandbox/fleet-gitops-extension:latest")
   * @param iconPath - Path to the icon inside the image (e.g., "/icons/fleet-icon.svg")
   * @returns Icon data and MIME type, or null if extraction fails
   */
  async extractIcon(imageName: string, iconPath: string): Promise<IconResult | null> {
    this.log(`Extracting icon from ${imageName}: ${iconPath}`);

    let container: Dockerode.Container | null = null;

    try {
      // Create a container without starting it
      container = await this.docker.createContainer({
        Image: imageName,
        Entrypoint: ['true'],  // Override entrypoint to prevent any startup
      });

      const containerId = container.id.substring(0, 12);
      this.log(`Created temporary container: ${containerId} from image ${imageName}`);

      // Copy the icon file from the container - ensure path starts with /
      const normalizedPath = iconPath.startsWith('/') ? iconPath : `/${iconPath}`;

      this.log(`Getting archive for path: ${normalizedPath}`);
      const archiveStream = await container.getArchive({ path: normalizedPath });

      // Parse the tar archive to extract the file content
      const iconData = await this.extractFileFromTar(archiveStream as unknown as Readable, normalizedPath);

      if (!iconData) {
        this.log(`Icon file not found in archive: ${normalizedPath}`);
        return null;
      }

      const mimeType = this.getMimeType(iconPath);
      this.log(`Extracted icon from ${imageName}: ${iconData.length} bytes, ${mimeType}`);

      return {
        data: iconData.toString('base64'),
        mimeType,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log(`Failed to extract icon from ${imageName}: ${message}`);
      return null;
    } finally {
      // Clean up the temporary container
      if (container) {
        try {
          await container.remove({ force: true });
          this.log(`Removed temporary container for ${imageName}`);
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Extract a file from a tar archive stream.
   */
  private async extractFileFromTar(stream: Readable, targetPath: string): Promise<Buffer | null> {
    return new Promise((resolve, reject) => {
      const extract = tar.extract();
      const chunks: Buffer[] = [];
      const targetName = targetPath.split('/').pop() || '';
      let found = false;
      const allEntries: string[] = [];

      this.log(`Looking for file: ${targetName} in tar archive (full path: ${targetPath})`);

      extract.on('entry', (header, entryStream, next) => {
        allEntries.push(`${header.name} (${header.size} bytes)`);

        // Check if this is the file we're looking for
        if (!found && (header.name === targetName || header.name.endsWith(`/${targetName}`))) {
          found = true;
          this.log(`Found matching entry: ${header.name}`);
          entryStream.on('data', (chunk: Buffer) => chunks.push(chunk));
          entryStream.on('end', () => {
            const data = Buffer.concat(chunks);
            this.log(`Read ${data.length} bytes from ${header.name}`);
            // Log first few bytes to help identify the file content
            const preview = data.slice(0, 100).toString('utf-8').replace(/[\x00-\x1F]/g, '.');
            this.log(`Content preview: ${preview}...`);
            next();
          });
        } else {
          entryStream.resume();
          entryStream.on('end', next);
        }
      });

      extract.on('finish', () => {
        this.log(`Tar archive entries: [${allEntries.join(', ')}]`);
        if (found && chunks.length > 0) {
          resolve(Buffer.concat(chunks));
        } else {
          this.log(`File not found in tar: ${targetName}`);
          resolve(null);
        }
      });

      extract.on('error', (err) => {
        this.log(`Tar extraction error: ${err.message}`);
        reject(err);
      });

      stream.pipe(extract);
    });
  }

  /**
   * Read metadata.json from a Docker image and extract the icon path.
   * This matches Rancher Desktop's algorithm for determining extension icons.
   */
  private async getIconPathFromMetadata(imageName: string): Promise<string | null> {
    let container: Dockerode.Container | null = null;

    try {
      container = await this.docker.createContainer({
        Image: imageName,
        Entrypoint: ['true'],
      });

      // Extract /metadata.json from the container
      const archiveStream = await container.getArchive({ path: '/metadata.json' });
      const metadataContent = await this.extractFileFromTar(archiveStream as unknown as Readable, '/metadata.json');

      if (!metadataContent) {
        this.log(`  No metadata.json found in ${imageName}`);
        return null;
      }

      // Parse the metadata.json
      const metadata = JSON.parse(metadataContent.toString('utf-8'));
      const iconPath = metadata.icon || null;

      this.log(`  Icon path from metadata.json: ${iconPath || '(none)'}`);
      return iconPath;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log(`  Failed to read metadata.json from ${imageName}: ${message}`);
      return null;
    } finally {
      if (container) {
        try {
          await container.remove({ force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * List all Fleet extension images with their metadata and icons.
   * This is the main entry point for getting all extension icons at once.
   *
   * Icon path is read from metadata.json, matching Rancher Desktop's algorithm.
   */
  async listFleetImagesWithIcons(): Promise<FleetImageWithIcon[]> {
    this.log('Listing Fleet extension images with icons');

    try {
      // List images with Fleet label
      const images = await this.docker.listImages({
        filters: {
          label: ['io.rancher-desktop.fleet.type'],
        },
      });

      this.log(`Found ${images.length} Fleet extension images`);

      const results: FleetImageWithIcon[] = [];

      // Process each image
      for (const image of images) {
        const imageInfo = await this.docker.getImage(image.Id).inspect();
        const labels = imageInfo.Config?.Labels || {};

        // Get repository and tag from RepoTags
        const repoTag = image.RepoTags?.[0] || '';
        if (!repoTag) {
          this.log(`Skipping image ${image.Id} - no RepoTags`);
          continue;
        }

        const lastColon = repoTag.lastIndexOf(':');
        const repository = lastColon > 0 ? repoTag.substring(0, lastColon) : repoTag;
        const tag = lastColon > 0 ? repoTag.substring(lastColon + 1) : 'latest';
        const imageName = `${repository}:${tag}`;

        const fleetType = labels['io.rancher-desktop.fleet.type'] as 'base' | 'custom';
        const baseImageLabel = labels['io.rancher-desktop.fleet.base-image'];
        const title = labels['org.opencontainers.image.title'];

        // Detailed logging for debugging
        this.log(`=== Processing image: ${imageName} ===`);
        this.log(`  Type: ${fleetType}`);
        this.log(`  Title: ${title || '(none)'}`);

        if (fleetType === 'custom') {
          this.log(`  Base image: ${baseImageLabel || '(none)'}`);
        }

        // Get icon path from metadata.json (matches RD's algorithm)
        const iconPath = await this.getIconPathFromMetadata(imageName);

        const result: FleetImageWithIcon = {
          id: image.Id.replace('sha256:', '').substring(0, 12),
          repository,
          tag,
          type: fleetType,
          title,
          baseImage: baseImageLabel,
          iconPath: iconPath || undefined,
        };

        // Extract icon if path is available
        if (iconPath) {
          this.log(`  Extracting icon from path: ${iconPath}`);
          const iconResult = await this.extractIcon(imageName, iconPath);
          if (iconResult) {
            result.iconData = iconResult.data;
            result.iconMimeType = iconResult.mimeType;
            this.log(`  Icon extracted: ${iconResult.data.length} bytes (base64), type: ${iconResult.mimeType}`);
          } else {
            this.log(`  Icon extraction FAILED for path: ${iconPath}`);
          }
        } else {
          this.log(`  No icon path in metadata.json - skipping extraction`);
        }

        results.push(result);
      }

      this.log(`=== Summary: Processed ${results.length} Fleet images ===`);
      for (const r of results) {
        const iconStatus = r.iconData ? `✓ icon (${r.iconData.length} bytes)` : '✗ no icon';
        this.log(`  ${r.repository}:${r.tag} [${r.type}] - ${r.iconPath || 'no path'} - ${iconStatus}`);
      }

      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log(`Failed to list Fleet images: ${message}`);
      return [];
    }
  }

  /**
   * Get raw Docker labels for all Fleet images.
   * This is useful for debugging icon path issues.
   */
  async getFleetImageLabels(): Promise<Array<{
    imageName: string;
    type: string;
    iconPath: string | null;
    title: string | null;
    baseImage: string | null;
    allLabels: Record<string, string>;
  }>> {
    try {
      const images = await this.docker.listImages({
        filters: {
          label: ['io.rancher-desktop.fleet.type'],
        },
      });

      const results = [];

      for (const image of images) {
        const imageInfo = await this.docker.getImage(image.Id).inspect();
        const labels = imageInfo.Config?.Labels || {};

        const repoTag = image.RepoTags?.[0] || '';
        if (!repoTag) continue;

        const lastColon = repoTag.lastIndexOf(':');
        const repository = lastColon > 0 ? repoTag.substring(0, lastColon) : repoTag;
        const tag = lastColon > 0 ? repoTag.substring(lastColon + 1) : 'latest';

        results.push({
          imageName: `${repository}:${tag}`,
          type: labels['io.rancher-desktop.fleet.type'] || 'unknown',
          iconPath: labels['com.docker.desktop.extension.icon'] || null,
          title: labels['org.opencontainers.image.title'] || null,
          baseImage: labels['io.rancher-desktop.fleet.base-image'] || null,
          allLabels: labels,
        });
      }

      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log(`Failed to get Fleet image labels: ${message}`);
      return [];
    }
  }

}

// Singleton instance
export const iconsService = new IconsService();
