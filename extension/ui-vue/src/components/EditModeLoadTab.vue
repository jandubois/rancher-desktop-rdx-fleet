<script setup lang="ts">
/**
 * EditModeLoadTab - Load configuration from image or ZIP file.
 */

import { ref, onMounted } from 'vue';
import JSZip from 'jszip';
import yaml from 'js-yaml';
import { useManifestStore } from '../stores/manifest';
import type { Manifest } from '../types/manifest';

const manifestStore = useManifestStore();

// State
const fleetImages = ref<Array<{ id: string; repository: string; tag: string; title?: string }>>([]);
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
    // Try to get images from backend service
    // For now, this is a placeholder - in production this would call the backend
    fleetImages.value = [];
  } catch (err) {
    console.error('Failed to load fleet images:', err);
  } finally {
    loadingImages.value = false;
  }
}

function getImageDisplayName(img: { repository: string; tag: string; title?: string }): string {
  return img.title || `${img.repository}:${img.tag}`;
}

function getImageValue(img: { repository: string; tag: string }): string {
  return `${img.repository}:${img.tag}`;
}

async function handleLoadFromImage() {
  if (!selectedImage.value) return;

  importing.value = true;
  importError.value = null;
  importSuccess.value = null;

  try {
    // Placeholder for loading from image
    // This would require backend integration
    importError.value = 'Loading from images requires backend integration (not yet implemented in Vue)';
  } catch (err) {
    importError.value = err instanceof Error ? err.message : 'Failed to load from image';
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
    if (result.success && result.manifest) {
      manifestStore.loadManifest(result.manifest);
      importSuccess.value = `Configuration loaded from ${file.name}`;
    } else {
      importError.value = result.error || 'Failed to load configuration';
    }
  } catch (err) {
    importError.value = err instanceof Error ? err.message : 'Failed to load from ZIP';
  } finally {
    importing.value = false;
    if (fileInputRef.value) {
      fileInputRef.value.value = '';
    }
  }
}

async function importConfigFromZip(file: File): Promise<{ success: boolean; manifest?: Manifest; error?: string }> {
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

    return { success: true, manifest };
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
        <template #no-data>
          <v-list-item>
            <v-list-item-title>No custom extension images found</v-list-item-title>
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
    <div class="d-flex align-center flex-wrap ga-2">
      <span class="text-body-2 text-medium-emphasis">Or upload a ZIP file:</span>
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
  </div>
</template>
