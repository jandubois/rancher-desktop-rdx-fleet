/**
 * Unit tests for Build Service
 *
 * Tests the Dockerfile generation and build context creation utilities.
 * These tests import and test the actual exported functions from build.ts.
 */

import { describe, it, expect } from '@jest/globals';
import * as tar from 'tar-stream';
import { Readable } from 'stream';
import {
  generateDockerfile,
  createBuildContext,
  BuildRequest,
} from './build';

describe('generateDockerfile', () => {
  const baseRequest: BuildRequest = {
    imageName: 'test-extension:latest',
    baseImage: 'ghcr.io/rancher-sandbox/fleet-gitops-extension:latest',
    title: 'Test Extension',
    manifest: Buffer.from('name: test').toString('base64'),
    metadata: Buffer.from('{}').toString('base64'),
  };

  it('should generate basic Dockerfile with required labels', () => {
    const dockerfile = generateDockerfile(baseRequest);

    expect(dockerfile).toContain('ARG BASE_IMAGE="ghcr.io/rancher-sandbox/fleet-gitops-extension:latest"');
    expect(dockerfile).toContain('FROM ${BASE_IMAGE}');
    expect(dockerfile).toContain('LABEL org.opencontainers.image.title="Test Extension"');
    expect(dockerfile).toContain('LABEL io.rancher-desktop.fleet.type="custom"');
    expect(dockerfile).toContain('LABEL io.rancher-desktop.fleet.base-image="${BASE_IMAGE}"');
    expect(dockerfile).toContain('COPY manifest.yaml /ui/manifest.yaml');
    expect(dockerfile).toContain('COPY metadata.json /metadata.json');
  });

  it('should include icon label when iconPath is provided', () => {
    const request: BuildRequest = {
      ...baseRequest,
      iconPath: '/icons/custom-icon.svg',
    };

    const dockerfile = generateDockerfile(request);

    expect(dockerfile).toContain('LABEL com.docker.desktop.extension.icon="/icons/custom-icon.svg"');
  });

  it('should not include icon label when iconPath is not provided', () => {
    const dockerfile = generateDockerfile(baseRequest);

    expect(dockerfile).not.toContain('com.docker.desktop.extension.icon');
  });

  it('should include icon COPY instruction when custom icon is provided', () => {
    const request: BuildRequest = {
      ...baseRequest,
      iconPath: '/icons/custom-icon.svg',
      icon: {
        filename: 'custom-icon.svg',
        data: Buffer.from('<svg></svg>').toString('base64'),
      },
    };

    const dockerfile = generateDockerfile(request);

    expect(dockerfile).toContain('# Add custom icon');
    expect(dockerfile).toContain('COPY icons/ /icons/');
  });

  it('should include bundled images COPY instruction when bundled images are provided', () => {
    const request: BuildRequest = {
      ...baseRequest,
      bundledImages: [
        {
          path: 'images/screenshot.png',
          data: Buffer.from('fake-png-data').toString('base64'),
        },
      ],
    };

    const dockerfile = generateDockerfile(request);

    expect(dockerfile).toContain('# Add bundled images for image cards');
    expect(dockerfile).toContain('COPY images/ /images/');
  });

  it('should include both icons and bundled images when both are provided', () => {
    const request: BuildRequest = {
      ...baseRequest,
      iconPath: '/icons/custom-icon.svg',
      icon: {
        filename: 'custom-icon.svg',
        data: Buffer.from('<svg></svg>').toString('base64'),
      },
      bundledImages: [
        {
          path: 'images/screenshot.png',
          data: Buffer.from('fake-png-data').toString('base64'),
        },
      ],
    };

    const dockerfile = generateDockerfile(request);

    expect(dockerfile).toContain('COPY icons/ /icons/');
    expect(dockerfile).toContain('COPY images/ /images/');
  });

  it('should handle special characters in title', () => {
    const request: BuildRequest = {
      ...baseRequest,
      title: 'My "Special" Extension',
    };

    const dockerfile = generateDockerfile(request);

    expect(dockerfile).toContain('LABEL org.opencontainers.image.title="My "Special" Extension"');
  });

  it('should include header background label when provided', () => {
    const request: BuildRequest = {
      ...baseRequest,
      headerBackground: '#336699',
    };

    const dockerfile = generateDockerfile(request);

    expect(dockerfile).toContain('LABEL io.rancher-desktop.fleet.header-background="#336699"');
  });

  it('should not include header background label when not provided', () => {
    const dockerfile = generateDockerfile(baseRequest);

    expect(dockerfile).not.toContain('io.rancher-desktop.fleet.header-background');
  });
});

describe('createBuildContext', () => {
  const baseRequest: BuildRequest = {
    imageName: 'test-extension:latest',
    baseImage: 'ghcr.io/rancher-sandbox/fleet-gitops-extension:latest',
    title: 'Test Extension',
    manifest: Buffer.from('name: test\nversion: 1.0').toString('base64'),
    metadata: Buffer.from('{"title":"Test"}').toString('base64'),
  };

  async function extractTarContents(buffer: Buffer): Promise<Map<string, string>> {
    return new Promise((resolve, reject) => {
      const extract = tar.extract();
      const contents = new Map<string, string>();

      extract.on('entry', (header, stream, next) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => {
          contents.set(header.name, Buffer.concat(chunks).toString('utf-8'));
          next();
        });
      });

      extract.on('finish', () => resolve(contents));
      extract.on('error', reject);

      const readable = Readable.from(buffer);
      readable.pipe(extract);
    });
  }

  it('should create tar archive with Dockerfile', async () => {
    const buffer = await createBuildContext(baseRequest);
    const contents = await extractTarContents(buffer);

    expect(contents.has('Dockerfile')).toBe(true);
    const dockerfile = contents.get('Dockerfile')!;
    expect(dockerfile).toContain('FROM ${BASE_IMAGE}');
  });

  it('should include decoded manifest.yaml', async () => {
    const buffer = await createBuildContext(baseRequest);
    const contents = await extractTarContents(buffer);

    expect(contents.has('manifest.yaml')).toBe(true);
    expect(contents.get('manifest.yaml')).toBe('name: test\nversion: 1.0');
  });

  it('should include decoded metadata.json', async () => {
    const buffer = await createBuildContext(baseRequest);
    const contents = await extractTarContents(buffer);

    expect(contents.has('metadata.json')).toBe(true);
    expect(contents.get('metadata.json')).toBe('{"title":"Test"}');
  });

  it('should include custom icon when provided', async () => {
    const iconData = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>';
    const request: BuildRequest = {
      ...baseRequest,
      iconPath: '/icons/my-icon.svg',
      icon: {
        filename: 'my-icon.svg',
        data: Buffer.from(iconData).toString('base64'),
      },
    };

    const buffer = await createBuildContext(request);
    const contents = await extractTarContents(buffer);

    expect(contents.has('icons/my-icon.svg')).toBe(true);
    expect(contents.get('icons/my-icon.svg')).toBe(iconData);
  });

  it('should include bundled images when provided', async () => {
    const imageData = 'fake-image-data-for-testing';
    const request: BuildRequest = {
      ...baseRequest,
      bundledImages: [
        {
          path: 'images/screenshot1.png',
          data: Buffer.from(imageData).toString('base64'),
        },
        {
          path: 'images/screenshot2.png',
          data: Buffer.from('second-image').toString('base64'),
        },
      ],
    };

    const buffer = await createBuildContext(request);
    const contents = await extractTarContents(buffer);

    expect(contents.has('images/screenshot1.png')).toBe(true);
    expect(contents.has('images/screenshot2.png')).toBe(true);
    expect(contents.get('images/screenshot1.png')).toBe(imageData);
    expect(contents.get('images/screenshot2.png')).toBe('second-image');
  });

  it('should handle empty bundled images array', async () => {
    const request: BuildRequest = {
      ...baseRequest,
      bundledImages: [],
    };

    const buffer = await createBuildContext(request);
    const contents = await extractTarContents(buffer);

    // Should have basic files but no images directory entries
    expect(contents.has('Dockerfile')).toBe(true);
    expect(contents.has('manifest.yaml')).toBe(true);
    expect(contents.has('metadata.json')).toBe(true);
  });

  it('should return a valid tar buffer', async () => {
    const buffer = await createBuildContext(baseRequest);

    // Should be a non-empty buffer
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Should be extractable without error
    const contents = await extractTarContents(buffer);
    expect(contents.size).toBeGreaterThan(0);
  });
});
