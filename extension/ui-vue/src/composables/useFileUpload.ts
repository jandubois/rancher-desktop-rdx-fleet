/**
 * useFileUpload - Composable for file upload validation and processing.
 *
 * Provides shared file upload logic for icon and image uploads.
 */

import { ref } from 'vue';

/** Processed file result */
export interface ProcessedFile {
  /** Base64 encoded file data (without data URL prefix) */
  data: string;
  /** Original filename */
  filename: string;
  /** MIME type */
  mimeType: string;
}

/** Options for file upload validation */
export interface FileUploadOptions {
  /** Accepted MIME types */
  acceptedTypes?: string[];
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Auto-clear error after this many milliseconds (0 to disable) */
  errorAutoClearMs?: number;
}

/** Map MIME type suffixes to user-friendly names */
const MIME_TYPE_DISPLAY_NAMES: Record<string, string> = {
  'png': 'PNG',
  'svg+xml': 'SVG',
  'jpeg': 'JPEG',
  'gif': 'GIF',
  'webp': 'WebP',
};

/** Format a MIME type for user display */
function formatMimeType(mimeType: string): string {
  const suffix = mimeType.split('/')[1];
  return MIME_TYPE_DISPLAY_NAMES[suffix] || suffix.toUpperCase();
}

/** Format a list of MIME types as a readable string with "or" before the last item */
function formatTypeList(types: string[]): string {
  const names = types.map(formatMimeType);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} or ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]}`;
}

/** Default accepted image types */
export const DEFAULT_ACCEPTED_TYPES = [
  'image/png',
  'image/svg+xml',
  'image/jpeg',
  'image/gif',
  'image/webp',
];

/** Default max file size (512KB) */
export const DEFAULT_MAX_SIZE = 512 * 1024;

/**
 * Composable for validating and processing file uploads.
 *
 * @example
 * ```ts
 * const { error, validateAndProcessFile } = useFileUpload({
 *   acceptedTypes: ['image/png', 'image/svg+xml'],
 *   maxSize: 512 * 1024,
 * });
 *
 * const handleFile = async (file: File) => {
 *   const result = await validateAndProcessFile(file);
 *   if (result) {
 *     onFileProcessed(result);
 *   }
 * };
 * ```
 */
export function useFileUpload(options: FileUploadOptions = {}) {
  const {
    acceptedTypes = DEFAULT_ACCEPTED_TYPES,
    maxSize = DEFAULT_MAX_SIZE,
    errorAutoClearMs = 0,
  } = options;

  const error = ref<string | null>(null);
  let errorClearTimeout: ReturnType<typeof setTimeout> | null = null;

  function clearError() {
    error.value = null;
    if (errorClearTimeout) {
      clearTimeout(errorClearTimeout);
      errorClearTimeout = null;
    }
  }

  function setError(errorMessage: string | null) {
    error.value = errorMessage;
    if (errorClearTimeout) {
      clearTimeout(errorClearTimeout);
      errorClearTimeout = null;
    }
    if (errorMessage && errorAutoClearMs > 0) {
      errorClearTimeout = setTimeout(() => {
        error.value = null;
      }, errorAutoClearMs);
    }
  }

  async function validateAndProcessFile(file: File): Promise<ProcessedFile | null> {
    clearError();

    // Validate type
    if (!acceptedTypes.includes(file.type)) {
      setError(`Invalid file type. Please use ${formatTypeList(acceptedTypes)}.`);
      return null;
    }

    // Validate size
    if (file.size > maxSize) {
      const maxSizeKB = Math.round(maxSize / 1024);
      setError(`File too large. Maximum size is ${maxSizeKB}KB.`);
      return null;
    }

    // Read file as base64
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        // Remove the data:mime/type;base64, prefix to store just the data
        const base64Data = base64.split(',')[1];
        resolve({
          data: base64Data,
          filename: file.name,
          mimeType: file.type,
        });
      };
      reader.onerror = () => {
        setError('Failed to read file.');
        resolve(null);
      };
      reader.readAsDataURL(file);
    });
  }

  return {
    error,
    setError,
    validateAndProcessFile,
    clearError,
  };
}

export default useFileUpload;
