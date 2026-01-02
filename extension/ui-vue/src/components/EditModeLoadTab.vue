<script setup lang="ts">
/**
 * EditModeLoadTab - Load configuration from image or ZIP file.
 * Supports loading from both Docker images and ZIP files.
 */

import { ref, onMounted } from 'vue';
import JSZip from 'jszip';
import yaml from 'js-yaml';
import { useManifestStore } from '../stores/manifest';
import { backendService, type FleetImageWithIcon } from '../services/BackendService';
import { ddClient } from '../lib/ddClient';
import type { Manifest } from '../types/manifest';

interface ImportResult {
  success: boolean;
  manifest?: Manifest;
  metadata?: Record<string, unknown>;
  icons?: Map<string, string>;
  images?: Map<string, string>;
  error?: string;
}

const emit = defineEmits<{
  (e: 'importSuccess', manifest: Manifest, source: string): void;
  (e: 'importError', error: string): void;
}>();

const manifestStore = useManifestStore();

// State
const fleetImages = ref<FleetImageWithIcon[]>([]);
const selectedImage = ref('');
const loadingImages = ref(false);
const importing = ref(false);
const importError = ref<string | null>(null);
const importSuccess = ref<string | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

// Load fleet images on mount
onMounted(async () => {
  await refreshFleetImages();
});

async function refreshFleetImages() {
  loadingImages.value = true;
  try {
    const response = await backendService.getFleetIcons();
    // Filter to only custom images (not base images)
    fleetImages.value = response.images.filter(img => img.type === 'custom');
  } catch (err) {
    console.error('Failed to load fleet images:', err);
    fleetImages.value = [];
  } finally {
    loadingImages.value = false;
  }
}

function getImageDisplayName(img: FleetImageWithIcon): string {
  return img.title || `${img.repository}:${img.tag}`;
}

function getImageValue(img: FleetImageWithIcon): string {
  return `${img.repository}:${img.tag}`;
}

/**
 * Import configuration from a Docker image by running export-config command
 */
async function importConfigFromImage(imageName: string): Promise<ImportResult> {
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
    console.error('Failed to import from image:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to run export-config on image',
    };
  }
}

async function handleImportResult(result: ImportResult, source: string) {
  if (result.success && result.manifest) {
    manifestStore.loadManifest(result.manifest);
    importSuccess.value = `Configuration loaded from ${source}`;
    emit('importSuccess', result.manifest, source);
  } else {
    importError.value = result.error || 'Failed to load configuration';
    emit('importError', importError.value);
  }
}

async function handleLoadFromImage() {
  if (!selectedImage.value) return;

  importing.value = true;
  importError.value = null;
  importSuccess.value = null;

  try {
    const result = await importConfigFromImage(selectedImage.value);
    await handleImportResult(result, selectedImage.value);
  } catch (err) {
    importError.value = err instanceof Error ? err.message : 'Failed to load from image';
    emit('importError', importError.value);
  } finally {
    importing.value = false;
  }
}

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  importing.value = true;
  importError.value = null;
  importSuccess.value = null;

  try {
    const result = await importConfigFromZip(file);
    await handleImportResult(result, file.name);
  } catch (err) {
    importError.value = err instanceof Error ? err.message : 'Failed to load from ZIP';
    emit('importError', importError.value);
  } finally {
    importing.value = false;
    if (fileInputRef.value) {
      fileInputRef.value.value = '';
    }
  }
}

async function importConfigFromZip(file: File): Promise<ImportResult> {
  try {
    const zip = await JSZip.loadAsync(file);

    // Look for manifest.yaml or config.yaml
    let manifestContent: string | null = null;
    const manifestFile = zip.file('manifest.yaml') || zip.file('config.yaml');
    if (manifestFile) {
      manifestContent = await manifestFile.async('string');
    }

    if (!manifestContent) {
      return { success: false, error: 'No manifest.yaml or config.yaml found in ZIP' };
    }

    const manifest = yaml.load(manifestContent) as Manifest;
    if (!manifest || typeof manifest !== 'object') {
      return { success: false, error: 'Invalid manifest format' };
    }

    // Extract metadata.json if present
    let metadata: Record<string, unknown> | undefined;
    const metadataFile = zip.file('metadata.json');
    if (metadataFile) {
      try {
        const metadataContent = await metadataFile.async('string');
        metadata = JSON.parse(metadataContent);
      } catch {
        // Ignore metadata parse errors
      }
    }

    // Extract icons if present
    const icons = new Map<string, string>();
    const iconFiles = zip.file(/^icons\//);
    for (const iconFile of iconFiles) {
      try {
        const base64 = await iconFile.async('base64');
        icons.set(iconFile.name, base64);
      } catch {
        // Ignore icon extraction errors
      }
    }

    return { success: true, manifest, metadata, icons };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to parse ZIP file',
    };
  }
}
</script>

<template>
  <div>
    <p class="text-body-2 text-medium-emphasis mb-4">
      Load an existing configuration from a custom extension image or a ZIP file.
    </p>

    <!-- Status messages -->
    <v-alert v-if="importSuccess" type="success" density="compact" closable class="mb-4" @click:close="importSuccess = null">
      {{ importSuccess }}
    </v-alert>
    <v-alert v-if="importError" type="error" density="compact" closable class="mb-4" @click:close="importError = null">
      {{ importError }}
    </v-alert>

    <!-- Image selector -->
    <div class="d-flex align-start flex-wrap ga-2 mb-4">
      <v-select
        v-model="selectedImage"
        :items="fleetImages"
        :item-title="getImageDisplayName"
        :item-value="getImageValue"
        label="Custom Extension Image"
        density="compact"
        :disabled="loadingImages || importing"
        :loading="loadingImages"
        class="flex-grow-1"
        style="min-width: 250px"
        clearable
      >
        <template #prepend-item v-if="fleetImages.length > 0">
          <v-list-subheader>Available custom extensions</v-list-subheader>
        </template>
        <template #item="{ item, props: itemProps }">
          <v-list-item v-bind="itemProps">
            <template #prepend>
              <v-avatar v-if="item.raw.iconData" size="24" class="mr-2">
                <v-img :src="`data:${item.raw.iconMimeType || 'image/png'};base64,${item.raw.iconData}`" />
              </v-avatar>
              <v-icon v-else icon="mdi-docker" size="24" class="mr-2" />
            </template>
          </v-list-item>
        </template>
        <template #no-data>
          <v-list-item>
            <v-list-item-title class="text-grey">No custom extension images found</v-list-item-title>
            <v-list-item-subtitle class="text-caption">
              Build a custom extension first using the Build tab
            </v-list-item-subtitle>
          </v-list-item>
        </template>
      </v-select>

      <v-btn
        icon="mdi-refresh"
        size="small"
        variant="outlined"
        :loading="loadingImages"
        title="Refresh image list"
        @click="refreshFleetImages"
      />

      <v-btn
        color="primary"
        :prepend-icon="importing ? undefined : 'mdi-upload'"
        :loading="importing"
        :disabled="!selectedImage || importing"
        @click="handleLoadFromImage"
      >
        Load
      </v-btn>
    </div>

    <!-- ZIP file upload -->
    <v-divider class="my-4">
      <span class="text-caption text-medium-emphasis px-2">OR</span>
    </v-divider>

    <div class="d-flex align-center flex-wrap ga-2">
      <span class="text-body-2 text-medium-emphasis">Upload a ZIP file:</span>
      <input
        ref="fileInputRef"
        type="file"
        accept=".zip"
        style="display: none"
        @change="handleFileUpload"
      />
      <v-btn
        variant="outlined"
        :prepend-icon="importing ? undefined : 'mdi-folder-open'"
        :loading="importing"
        :disabled="importing"
        @click="fileInputRef?.click()"
      >
        Browse...
      </v-btn>
    </div>

    <p class="text-caption text-medium-emphasis mt-2">
      ZIP files should contain a manifest.yaml file at the root.
    </p>
  </div>
</template>
