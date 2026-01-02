<script setup lang="ts">
/**
 * EditModeBuildTab - Build or download extension as Docker image or ZIP.
 */

import { ref } from 'vue';
import JSZip from 'jszip';
import yaml from 'js-yaml';
import { storeToRefs } from 'pinia';
import { useManifestStore } from '../stores/manifest';

const manifestStore = useManifestStore();
const { manifest, manifestCards, cardOrder } = storeToRefs(manifestStore);

// State
const imageName = ref('my-fleet-extension:dev');
const downloading = ref(false);
const building = ref(false);
const buildOutput = ref<string | null>(null);
const buildError = ref<string | null>(null);

// Download extension as ZIP
async function handleDownload() {
  downloading.value = true;

  try {
    const zip = new JSZip();

    // Create manifest.yaml
    const manifestData = {
      version: manifest.value.version || '1.0',
      app: manifest.value.app,
      branding: manifest.value.branding,
      layout: manifest.value.layout,
      cards: manifestCards.value.map((card) => ({
        id: card.id,
        type: card.type,
        title: card.title,
        visible: card.visible,
        enabled: card.enabled,
        settings: card.settings,
      })),
    };

    zip.file('manifest.yaml', yaml.dump(manifestData, { indent: 2 }));

    // Add card order file
    zip.file('card-order.json', JSON.stringify(cardOrder.value, null, 2));

    // Generate ZIP file
    const blob = await zip.generateAsync({ type: 'blob' });

    // Download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${manifest.value.app?.name || 'fleet-extension'}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Download failed:', err);
    buildError.value = err instanceof Error ? err.message : 'Download failed';
  } finally {
    downloading.value = false;
  }
}

// Build Docker image (requires backend integration)
async function handleBuild() {
  building.value = true;
  buildOutput.value = null;
  buildError.value = null;

  try {
    // This would require backend integration in Docker Desktop
    buildOutput.value = 'Building Docker images requires the Docker Desktop backend integration.\n\nFor now, please use the "Download ZIP" option and build manually:\n\n1. Extract the ZIP file\n2. Create a Dockerfile based on the base Fleet extension\n3. Build with: docker build -t ' + imageName.value + ' .';
  } catch (err) {
    buildError.value = err instanceof Error ? err.message : 'Build failed';
  } finally {
    building.value = false;
  }
}
</script>

<template>
  <div>
    <p class="text-body-2 text-medium-emphasis mb-4">
      Build or download your custom extension as a Docker image or ZIP file.
    </p>

    <!-- Output image name input -->
    <v-text-field
      v-model="imageName"
      label="Output Image Name"
      hint="Tag for the built Docker image"
      persistent-hint
      density="compact"
      class="mb-4"
    />

    <!-- Action buttons -->
    <div class="d-flex flex-wrap ga-2 mb-4">
      <v-btn
        color="primary"
        :prepend-icon="downloading ? undefined : 'mdi-download'"
        :loading="downloading"
        :disabled="downloading"
        @click="handleDownload"
      >
        {{ downloading ? 'Downloading...' : 'Download ZIP' }}
      </v-btn>

      <v-btn
        variant="outlined"
        :prepend-icon="building ? undefined : 'mdi-hammer'"
        :loading="building"
        :disabled="building"
        @click="handleBuild"
      >
        {{ building ? 'Building...' : 'Build Image' }}
      </v-btn>
    </div>

    <!-- Build output -->
    <v-alert v-if="buildOutput" type="info" class="mb-2">
      <pre class="build-output">{{ buildOutput }}</pre>
    </v-alert>

    <!-- Build error -->
    <v-alert v-if="buildError" type="error">
      <pre class="build-output">{{ buildError }}</pre>
    </v-alert>
  </div>
</template>

<style scoped>
.build-output {
  margin: 0;
  font-family: monospace;
  font-size: 0.8rem;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
}
</style>
