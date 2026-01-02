<script setup lang="ts">
/**
 * EditModeBuildTab - Build or download extension as Docker image or ZIP.
 * Supports building to Docker image and pushing to registry.
 */

import { ref, computed, watch } from 'vue';
import JSZip from 'jszip';
import yaml from 'js-yaml';
import { storeToRefs } from 'pinia';
import { useManifestStore } from '../stores/manifest';
import { backendService, type BuildResult, type PushResult } from '../services/BackendService';
import { getDockerCredentials, getRegistryHost } from '../services/DockerCredentialsService';
import type { Manifest } from '../types/manifest';

const manifestStore = useManifestStore();
const { manifest, manifestCards, cardOrder } = storeToRefs(manifestStore);

// State
const imageName = ref('my-fleet-extension:dev');
const baseImage = ref('ghcr.io/rancher-sandbox/fleet-gitops-extension:latest');
const downloading = ref(false);
const building = ref(false);
const buildOutput = ref<string | null>(null);
const buildError = ref<string | null>(null);
const buildSuccess = ref(false);
const pushing = ref(false);
const pushOutput = ref<string | null>(null);
const pushError = ref<string | null>(null);

// Computed
const canPush = computed(() => buildSuccess.value && imageName.value.includes('/'));
const imageNameWarning = computed(() => {
  const name = imageName.value.trim();
  if (!name) return 'Image name is required';
  if (name.includes(' ')) return 'Image name cannot contain spaces';
  return null;
});
const titleWarning = computed(() => {
  const title = manifest.value.app?.name?.trim();
  if (!title) return 'Extension title is required in the Edit tab';
  return null;
});

// Watch for base image changes from backend
async function detectBaseImage() {
  try {
    const status = await backendService.getInitStatus();
    if (status.ownIdentity?.extensionName) {
      baseImage.value = status.ownIdentity.extensionName;
    }
  } catch {
    // Keep default base image
  }
}
detectBaseImage();

// Download extension as ZIP
async function handleDownload() {
  downloading.value = true;

  try {
    const zip = new JSZip();

    // Create manifest.yaml with export format
    const exportManifest = createExportManifest();
    zip.file('manifest.yaml', yaml.dump(exportManifest, { indent: 2 }));

    // Add metadata.json
    const metadata = {
      version: '1.0',
      buildDate: new Date().toISOString(),
      generator: 'Fleet Extension Builder (Vue)',
    };
    zip.file('metadata.json', JSON.stringify(metadata, null, 2));

    // Add card order file
    zip.file('card-order.json', JSON.stringify(cardOrder.value, null, 2));

    // Generate ZIP file
    const blob = await zip.generateAsync({ type: 'blob' });

    // Download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = (manifest.value.app?.name || 'fleet-extension')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    link.download = `${safeName}.zip`;
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

// Create export manifest for build
function createExportManifest(): Manifest {
  return {
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
}

// Build Docker image using backend
async function handleBuild() {
  if (imageNameWarning.value || titleWarning.value) return;

  building.value = true;
  buildOutput.value = null;
  buildError.value = null;
  buildSuccess.value = false;
  pushOutput.value = null;
  pushError.value = null;

  try {
    buildOutput.value = 'Preparing build context...';

    const exportManifest = createExportManifest();
    const manifestYaml = yaml.dump(exportManifest, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });
    const metadataJson = JSON.stringify({
      version: '1.0',
      buildDate: new Date().toISOString(),
      generator: 'Fleet Extension Builder (Vue)',
    });

    // Base64 encode the files for the backend API
    const manifestB64 = btoa(manifestYaml);
    const metadataB64 = btoa(metadataJson);

    buildOutput.value = 'Starting Docker build...';

    // Build request for the backend API
    const buildRequest = {
      imageName: imageName.value,
      baseImage: baseImage.value,
      title: manifest.value.app?.name || 'My Fleet Extension',
      manifest: manifestB64,
      metadata: metadataB64,
    };

    const result: BuildResult = await backendService.buildImage(buildRequest);

    if (result.success) {
      buildSuccess.value = true;
      buildOutput.value =
        `Build successful!\n\n` +
        `Image: ${result.imageName}\n\n` +
        `To install the extension, run:\n` +
        `  rdctl extension install ${result.imageName}\n\n` +
        (result.output ? `Build output:\n${result.output}` : '');
    } else {
      buildSuccess.value = false;
      buildError.value = result.error || 'Build failed';
      if (result.output) {
        buildOutput.value = result.output;
      }
    }
  } catch (err) {
    buildSuccess.value = false;
    buildError.value = err instanceof Error ? err.message : 'Build failed';
  } finally {
    building.value = false;
  }
}

// Push Docker image to registry
async function handlePush() {
  if (!canPush.value) return;

  pushing.value = true;
  pushOutput.value = null;
  pushError.value = null;

  try {
    const registry = getRegistryHost(imageName.value);
    pushOutput.value = `Getting credentials for ${registry}...`;

    const credentials = await getDockerCredentials(imageName.value);
    if (credentials) {
      pushOutput.value = `Authenticating as ${credentials.username}...`;
    } else {
      pushOutput.value = `No credentials found for ${registry}, attempting anonymous push...`;
    }

    const result: PushResult = await backendService.pushImage(imageName.value, credentials);

    if (result.success) {
      pushOutput.value =
        `Push successful!\n\n` +
        `Image: ${result.imageName}\n\n` +
        (result.output ? `Push output:\n${result.output}` : '');
    } else {
      pushError.value = result.error || 'Push failed';
      if (result.output) {
        pushOutput.value = result.output;
      }
    }
  } catch (err) {
    pushError.value = err instanceof Error ? err.message : 'Push failed';
  } finally {
    pushing.value = false;
  }
}

// Auto-scroll output
const buildOutputRef = ref<HTMLPreElement | null>(null);
const buildErrorRef = ref<HTMLPreElement | null>(null);
const pushOutputRef = ref<HTMLPreElement | null>(null);
const pushErrorRef = ref<HTMLPreElement | null>(null);

watch(buildOutput, () => {
  if (buildOutputRef.value) {
    buildOutputRef.value.scrollTop = buildOutputRef.value.scrollHeight;
  }
});
watch(buildError, () => {
  if (buildErrorRef.value) {
    buildErrorRef.value.scrollTop = buildErrorRef.value.scrollHeight;
  }
});
watch(pushOutput, () => {
  if (pushOutputRef.value) {
    pushOutputRef.value.scrollTop = pushOutputRef.value.scrollHeight;
  }
});
watch(pushError, () => {
  if (pushErrorRef.value) {
    pushErrorRef.value.scrollTop = pushErrorRef.value.scrollHeight;
  }
});
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
      :error="!!imageNameWarning"
      :class="{ 'mb-1': imageNameWarning || titleWarning, 'mb-4': !imageNameWarning && !titleWarning }"
    />

    <!-- Image name validation warning -->
    <v-alert v-if="imageNameWarning" type="error" density="compact" class="mb-2">
      {{ imageNameWarning }}
    </v-alert>

    <!-- Title validation warning -->
    <v-alert v-if="titleWarning && !imageNameWarning" type="error" density="compact" class="mb-2">
      {{ titleWarning }}
    </v-alert>

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
        :disabled="building || !baseImage || !!imageNameWarning || !!titleWarning"
        :title="!baseImage ? 'Base image is required for building' : undefined"
        @click="handleBuild"
      >
        {{ building ? 'Building...' : 'Build Image' }}
      </v-btn>

      <v-btn
        v-if="canPush"
        variant="outlined"
        color="secondary"
        :prepend-icon="pushing ? undefined : 'mdi-cloud-upload'"
        :loading="pushing"
        :disabled="pushing"
        @click="handlePush"
      >
        {{ pushing ? 'Pushing...' : 'Push to Registry' }}
      </v-btn>
    </div>

    <!-- Build output -->
    <v-alert v-if="buildOutput" type="info" class="mb-2">
      <pre ref="buildOutputRef" class="build-output">{{ buildOutput }}</pre>
    </v-alert>

    <!-- Build error -->
    <v-alert v-if="buildError" type="error" class="mb-2">
      <pre ref="buildErrorRef" class="build-output">{{ buildError }}</pre>
    </v-alert>

    <!-- Push output -->
    <v-alert v-if="pushOutput" type="success" class="mb-2">
      <pre ref="pushOutputRef" class="build-output">{{ pushOutput }}</pre>
    </v-alert>

    <!-- Push error -->
    <v-alert v-if="pushError" type="error">
      <pre ref="pushErrorRef" class="build-output">{{ pushError }}</pre>
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
