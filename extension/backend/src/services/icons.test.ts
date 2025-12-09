/**
 * Unit tests for Icons Service
 *
 * Tests the MIME type detection and tar entry matching utilities.
 * These tests import and test the actual exported functions from icons.ts.
 */

import { describe, it, expect } from '@jest/globals';
import {
  getMimeType,
  matchesTarEntry,
} from './icons';

describe('getMimeType', () => {
  it('should return image/svg+xml for .svg files', () => {
    expect(getMimeType('/icons/logo.svg')).toBe('image/svg+xml');
    expect(getMimeType('icon.svg')).toBe('image/svg+xml');
    expect(getMimeType('/path/to/deep/file.SVG')).toBe('image/svg+xml');
  });

  it('should return image/png for .png files', () => {
    expect(getMimeType('/images/screenshot.png')).toBe('image/png');
    expect(getMimeType('icon.PNG')).toBe('image/png');
  });

  it('should return image/jpeg for .jpg and .jpeg files', () => {
    expect(getMimeType('/images/photo.jpg')).toBe('image/jpeg');
    expect(getMimeType('photo.jpeg')).toBe('image/jpeg');
    expect(getMimeType('PHOTO.JPG')).toBe('image/jpeg');
    expect(getMimeType('file.JPEG')).toBe('image/jpeg');
  });

  it('should return image/gif for .gif files', () => {
    expect(getMimeType('/images/animation.gif')).toBe('image/gif');
    expect(getMimeType('icon.GIF')).toBe('image/gif');
  });

  it('should return image/webp for .webp files', () => {
    expect(getMimeType('/images/modern.webp')).toBe('image/webp');
    expect(getMimeType('icon.WEBP')).toBe('image/webp');
  });

  it('should return image/png as default for unknown extensions', () => {
    expect(getMimeType('/icons/icon.ico')).toBe('image/png');
    expect(getMimeType('file.bmp')).toBe('image/png');
    expect(getMimeType('unknown.xyz')).toBe('image/png');
  });

  it('should return image/png for files without extension', () => {
    expect(getMimeType('/icons/icon')).toBe('image/png');
    expect(getMimeType('noextension')).toBe('image/png');
  });

  it('should handle files with multiple dots', () => {
    expect(getMimeType('/icons/my.custom.icon.svg')).toBe('image/svg+xml');
    expect(getMimeType('file.backup.png')).toBe('image/png');
  });

  it('should handle empty string', () => {
    expect(getMimeType('')).toBe('image/png');
  });
});

describe('matchesTarEntry', () => {
  it('should match exact file names', () => {
    expect(matchesTarEntry('fleet-icon.svg', '/icons/fleet-icon.svg')).toBe(true);
    expect(matchesTarEntry('metadata.json', '/metadata.json')).toBe(true);
  });

  it('should match when entry ends with target filename', () => {
    expect(matchesTarEntry('icons/fleet-icon.svg', '/icons/fleet-icon.svg')).toBe(true);
    expect(matchesTarEntry('./icons/fleet-icon.svg', '/icons/fleet-icon.svg')).toBe(true);
  });

  it('should not match partial filenames', () => {
    expect(matchesTarEntry('icon.svg', '/icons/fleet-icon.svg')).toBe(false);
    expect(matchesTarEntry('other-icon.svg', '/icons/fleet-icon.svg')).toBe(false);
  });

  it('should handle target paths without leading slash', () => {
    expect(matchesTarEntry('metadata.json', 'metadata.json')).toBe(true);
    expect(matchesTarEntry('icons/logo.svg', 'icons/logo.svg')).toBe(true);
  });

  it('should match nested paths correctly', () => {
    expect(matchesTarEntry('deep/nested/path/file.png', '/deep/nested/path/file.png')).toBe(true);
    expect(matchesTarEntry('path/file.png', '/other/path/file.png')).toBe(true); // ends with match
  });

  it('should handle paths with special characters', () => {
    expect(matchesTarEntry('my-icon_v2.svg', '/icons/my-icon_v2.svg')).toBe(true);
    expect(matchesTarEntry('icon (1).png', '/images/icon (1).png')).toBe(true);
  });

  it('should not match when filenames are different', () => {
    expect(matchesTarEntry('different.svg', '/icons/icon.svg')).toBe(false);
    expect(matchesTarEntry('icon.png', '/icons/icon.svg')).toBe(false);
  });

  it('should handle empty strings', () => {
    expect(matchesTarEntry('', '/icons/icon.svg')).toBe(false);
    expect(matchesTarEntry('icon.svg', '')).toBe(false); // empty target path doesn't match any entry
  });

  it('should be case-sensitive', () => {
    expect(matchesTarEntry('Icon.svg', '/icons/icon.svg')).toBe(false);
    expect(matchesTarEntry('ICON.SVG', '/icons/icon.svg')).toBe(false);
  });
});
