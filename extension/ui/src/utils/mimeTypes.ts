/**
 * MIME type utilities for image handling.
 */

/** Supported image MIME types */
export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/svg+xml',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const;

export type SupportedImageMimeType = typeof SUPPORTED_IMAGE_MIME_TYPES[number];

/** Map of MIME types to file extensions */
const MIME_TO_EXTENSION: Record<string, string> = {
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/** Map of file extensions to MIME types */
const EXTENSION_TO_MIME: Record<string, string> = {
  'svg': 'image/svg+xml',
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'webp': 'image/webp',
};

/**
 * Get file extension for a MIME type.
 * @param mimeType - The MIME type (e.g., 'image/png')
 * @returns The file extension without dot (e.g., 'png'), or 'png' as default
 */
export function getExtensionForMimeType(mimeType: string): string {
  return MIME_TO_EXTENSION[mimeType] ?? 'png';
}

/**
 * Get MIME type for a file extension.
 * @param extension - The file extension without dot (e.g., 'png')
 * @returns The MIME type (e.g., 'image/png'), or 'image/png' as default
 */
export function getMimeTypeForExtension(extension: string): string {
  const ext = extension.toLowerCase().replace(/^\./, '');
  return EXTENSION_TO_MIME[ext] ?? 'image/png';
}

/**
 * Check if a MIME type is SVG.
 * @param mimeType - The MIME type to check
 * @returns true if the MIME type is SVG
 */
export function isSvgMimeType(mimeType: string): boolean {
  return mimeType === 'image/svg+xml';
}

/**
 * Check if a data URL contains SVG data.
 * @param dataUrl - The data URL to check
 * @returns true if the data URL contains SVG data
 */
export function isSvgDataUrl(dataUrl: string): boolean {
  return dataUrl.includes('data:image/svg+xml');
}
