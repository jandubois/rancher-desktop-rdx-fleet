<script setup lang="ts">
/**
 * EditModeExtensionsTab - Tab content for Fleet extensions management in edit mode.
 *
 * Shows:
 * - List of installed Fleet extensions with their status
 * - List of Fleet extension images (built but not installed)
 * - Which extension currently owns/controls Fleet
 * - Actions to take control if applicable
 */

import { ref, computed, onMounted } from 'vue';
import { backendService, type BackendStatus, type FleetImageWithIcon } from '../services/BackendService';
import { ddClient } from '../lib/ddClient';

// Props
const props = defineProps<{
  ownHeaderBackground?: string;
}>();

// Emits
const emit = defineEmits<{
  clearAllGitRepos: [];
}>();

// State
const loading = ref(false);
const loadingImages = ref(false);
const recheckingOwnership = ref(false);
const status = ref<BackendStatus | null>(null);
const fleetImages = ref<FleetImageWithIcon[]>([]);
const operatingImage = ref<{ image: string; op: 'uninstall' | 'activate' | 'delete' } | null>(null);
const operationError = ref<string | null>(null);

// Computed values
const connected = computed(() => status.value?.connected ?? false);
const initStatus = computed(() => status.value?.initStatus);
const ownership = computed(() => status.value?.ownership);
const kubernetesReady = computed(() => initStatus.value?.kubernetesReady ?? false);
const isOwner = computed(() => ownership.value?.isOwner ?? false);
const currentOwner = computed(() => ownership.value?.currentOwner);

const ownershipDetermined = computed(() => {
  return ownership.value &&
    kubernetesReady.value &&
    ownership.value.status !== 'pending' &&
    ownership.value.status !== 'waiting' &&
    ownership.value.status !== 'error';
});

const allInstalledExtensions = computed(() => initStatus.value?.installedExtensions ?? []);

// Normalize image reference to full form: repository:tag (lowercase)
function normalizeImageRef(name: string): string {
  const lower = name.toLowerCase();
  return lower.includes(':') ? lower : `${lower}:latest`;
}

// Unified image info interface
interface UnifiedImageInfo {
  imageName: string;
  id: string;
  repository: string;
  tag: string;
  type: 'base' | 'custom';
  title?: string;
  baseImage?: string;
  headerBackground?: string;
  isInstalled: boolean;
  isActive: boolean;
  isThisExtension: boolean;
  iconData?: string;
  iconMimeType?: string;
}

// Create unified list of images with status
const unifiedImages = computed<UnifiedImageInfo[]>(() => {
  return fleetImages.value.map(img => {
    const imageName = img.repository + (img.tag ? `:${img.tag}` : ':latest');
    const normalizedImageName = normalizeImageRef(imageName);

    // Check if installed
    const installedExt = allInstalledExtensions.value.find(ext => {
      const extFullName = ext.tag ? `${ext.name}:${ext.tag}` : ext.name;
      const normalizedExtName = normalizeImageRef(extFullName);
      return normalizedExtName === normalizedImageName;
    });

    // Check if this is the extension we're running in
    const isThisExtension = !!installedExt && initStatus.value?.ownIdentity.extensionName === installedExt.name;

    // Check if active
    const onlyInstalledExtension = allInstalledExtensions.value.length === 1 && isThisExtension;
    const isActive = !!installedExt && (
      currentOwner.value === imageName ||
      currentOwner.value === normalizedImageName ||
      (isThisExtension && isOwner.value) ||
      onlyInstalledExtension
    );

    // Determine header background color
    const defaultIconColor = '#22ad5f';
    const headerBackground = isThisExtension && props.ownHeaderBackground
      ? props.ownHeaderBackground
      : (img.headerBackground || defaultIconColor);

    return {
      imageName,
      id: img.id,
      repository: img.repository,
      tag: img.tag,
      type: img.type,
      title: img.title,
      baseImage: img.baseImage,
      headerBackground,
      isInstalled: !!installedExt,
      isActive: !!isActive,
      isThisExtension: !!isThisExtension,
      iconData: img.iconData,
      iconMimeType: img.iconMimeType,
    };
  });
});

// Sort so base extension always comes first
const sortedUnifiedImages = computed(() => {
  return [...unifiedImages.value].sort((a, b) => {
    if (a.type === 'base' && b.type !== 'base') return -1;
    if (a.type !== 'base' && b.type === 'base') return 1;
    return 0;
  });
});

// Find base image for fallback
const baseImage = computed(() => sortedUnifiedImages.value.find(img => img.type === 'base'));

// Extension count text
const extensionCountText = computed(() => {
  const installed = sortedUnifiedImages.value.filter(i => i.isInstalled).length;
  const total = sortedUnifiedImages.value.length;
  return `${installed} installed, ${total} images`;
});

// Execute rdctl command
async function rdExec(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  const result = await ddClient.extension.host?.cli.exec(command, args);
  return {
    stdout: result?.stdout ?? '',
    stderr: result?.stderr ?? '',
  };
}

// Fetch backend status
async function fetchStatus() {
  loading.value = true;
  try {
    status.value = await backendService.getStatus();
  } catch (error) {
    console.error('Failed to fetch status:', error);
    status.value = {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString(),
    };
  } finally {
    loading.value = false;
  }
}

// Fetch fleet images
async function fetchImages() {
  loadingImages.value = true;
  try {
    const response = await backendService.getFleetIcons();
    fleetImages.value = response.images;
  } catch (error) {
    console.error('Failed to fetch images:', error);
    fleetImages.value = [];
  } finally {
    loadingImages.value = false;
  }
}

// Refresh installed extensions list
async function refreshInstalledExtensions() {
  try {
    const result = await rdExec('rdctl', ['api', '/v1/extensions']);
    if (result.stdout) {
      const apiResponse = JSON.parse(result.stdout) as Record<string, { version?: string; labels?: Record<string, string> }>;
      const installedExtensions = Object.entries(apiResponse).map(([name, info]) => ({
        name,
        tag: info.version || 'latest',
        labels: info.labels,
      }));
      await backendService.initialize({ installedExtensions });
    }
  } catch (error) {
    console.error('Failed to refresh extensions list:', error);
  }
}

// Handle uninstall
async function handleUninstall(img: UnifiedImageInfo) {
  operatingImage.value = { image: img.imageName, op: 'uninstall' };
  operationError.value = null;

  try {
    const result = await rdExec('rdctl', ['extension', 'uninstall', img.imageName]);

    if (result.stderr?.includes('Error')) {
      throw new Error(result.stderr);
    }

    // If this was active and there's a base image, activate base
    if (img.isActive && baseImage.value && baseImage.value.imageName !== img.imageName) {
      if (!baseImage.value.isInstalled) {
        await rdExec('rdctl', ['extension', 'install', baseImage.value.imageName]);
      }
      // Transfer ownership to base would require backend API
    }

    await fetchImages();
    await refreshInstalledExtensions();
    await fetchStatus();
  } catch (error) {
    console.error('Failed to uninstall extension:', error);
    operationError.value = error instanceof Error ? error.message : 'Failed to uninstall extension';
  } finally {
    operatingImage.value = null;
  }
}

// Handle activate
async function handleActivate(img: UnifiedImageInfo) {
  operatingImage.value = { image: img.imageName, op: 'activate' };
  operationError.value = null;

  try {
    // Install if not installed
    if (!img.isInstalled) {
      const result = await rdExec('rdctl', ['extension', 'install', img.imageName]);
      if (result.stderr?.includes('Error')) {
        throw new Error(result.stderr);
      }
      await refreshInstalledExtensions();
    }

    // Clear GitRepos before switching
    emit('clearAllGitRepos');

    // Transfer ownership (would need backend API)
    console.log(`Activating extension: ${img.imageName}`);

    await fetchImages();
    await fetchStatus();
  } catch (error) {
    console.error('Failed to activate extension:', error);
    operationError.value = error instanceof Error ? error.message : 'Failed to activate extension';
  } finally {
    operatingImage.value = null;
  }
}

// Handle delete
async function handleDelete(img: UnifiedImageInfo) {
  operatingImage.value = { image: img.imageName, op: 'delete' };
  operationError.value = null;

  try {
    // Uninstall first if installed
    if (img.isInstalled) {
      const uninstallResult = await rdExec('rdctl', ['extension', 'uninstall', img.imageName]);
      if (uninstallResult.stderr?.includes('Error')) {
        throw new Error(uninstallResult.stderr);
      }

      // Activate base if this was active
      if (img.isActive && baseImage.value && baseImage.value.imageName !== img.imageName) {
        if (!baseImage.value.isInstalled) {
          await rdExec('rdctl', ['extension', 'install', baseImage.value.imageName]);
        }
      }
    }

    // Delete Docker image
    const deleteResult = await rdExec('docker', ['rmi', img.imageName]);
    if (deleteResult.stderr?.includes('Error')) {
      throw new Error(deleteResult.stderr);
    }

    await fetchImages();
    await refreshInstalledExtensions();
    await fetchStatus();
  } catch (error) {
    console.error('Failed to delete image:', error);
    operationError.value = error instanceof Error ? error.message : 'Failed to delete image';
  } finally {
    operatingImage.value = null;
  }
}

// Handle refresh
async function handleRefresh() {
  recheckingOwnership.value = true;
  try {
    await fetchStatus();
    await fetchImages();
  } finally {
    recheckingOwnership.value = false;
  }
}

// Get list item background style
function getListItemStyle(img: UnifiedImageInfo): Record<string, string> {
  const headerColor = img.headerBackground || '#22ad5f';

  if (!img.isActive) {
    // Diagonal stripes for inactive
    return {
      background: `repeating-linear-gradient(
        -45deg,
        ${hexToRgba(headerColor, 0.35)},
        ${hexToRgba(headerColor, 0.35)} 6px,
        ${hexToRgba(headerColor, 0.15)} 6px,
        ${hexToRgba(headerColor, 0.15)} 12px
      )`,
      borderRadius: '4px',
      marginBottom: '4px',
    };
  }

  // Solid background for active
  return {
    backgroundColor: hexToRgba(headerColor, 0.2),
    borderRadius: '4px',
    marginBottom: '4px',
  };
}

// Convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Initialize on mount
onMounted(async () => {
  await fetchStatus();
  await fetchImages();
});
</script>

<template>
  <div class="extensions-tab">
    <!-- Header with status and refresh -->
    <div class="d-flex align-center mb-4">
      <span class="text-subtitle-2 font-weight-bold flex-grow-1">
        Fleet Extensions Status
      </span>

      <!-- Extension count chip -->
      <v-chip size="small" color="primary" variant="outlined" class="mr-2">
        {{ extensionCountText }}
      </v-chip>

      <!-- Initializing chip -->
      <v-chip
        v-if="connected && !ownershipDetermined"
        size="small"
        color="default"
        variant="outlined"
        class="mr-2"
      >
        {{ !kubernetesReady ? 'K8s not ready' : 'Initializing...' }}
      </v-chip>

      <!-- Refresh button -->
      <v-btn
        icon
        size="small"
        :loading="loading || loadingImages || recheckingOwnership"
        @click="handleRefresh"
      >
        <v-icon icon="mdi-refresh" />
      </v-btn>
    </div>

    <!-- Connection error message -->
    <v-alert
      v-if="!connected"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-4"
    >
      <div class="d-flex align-center">
        <v-icon icon="mdi-alert-circle" class="mr-2" />
        Backend service not connected. Extension ownership cannot be determined.
      </div>
    </v-alert>

    <!-- K8s not ready message -->
    <v-alert
      v-else-if="!kubernetesReady"
      type="info"
      variant="tonal"
      density="compact"
      class="mb-4"
    >
      <div class="d-flex align-center">
        <v-progress-circular indeterminate size="16" width="2" class="mr-2" />
        Waiting for Kubernetes to be ready...
      </div>
    </v-alert>

    <!-- Ownership status -->
    <v-alert
      v-if="ownershipDetermined"
      :type="isOwner ? 'success' : 'warning'"
      variant="tonal"
      density="compact"
      class="mb-4"
    >
      <div class="d-flex align-center">
        <v-icon :icon="isOwner ? 'mdi-check-circle' : 'mdi-alert'" class="mr-2" />
        <span class="font-weight-bold">
          {{ isOwner
            ? 'This extension controls Fleet'
            : `Another extension controls Fleet: ${ownership?.currentOwner}`
          }}
        </span>
      </div>
    </v-alert>

    <!-- Operation error -->
    <v-alert
      v-if="operationError"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-4"
      closable
      @click:close="operationError = null"
    >
      {{ operationError }}
    </v-alert>

    <!-- Extensions list -->
    <v-list v-if="sortedUnifiedImages.length > 0" density="compact" class="pa-0">
      <v-list-item
        v-for="img in sortedUnifiedImages"
        :key="img.id"
        :style="getListItemStyle(img)"
        class="pr-1"
      >
        <!-- Prepend: Radio button + Extension icon -->
        <template #prepend>
          <div class="d-flex align-center">
            <v-progress-circular
              v-if="operatingImage?.image === img.imageName && operatingImage?.op === 'activate'"
              indeterminate
              size="20"
              width="2"
              class="mr-2"
            />
            <v-radio-group
              v-else
              :model-value="img.isActive ? img.imageName : null"
              hide-details
              class="ma-0 pa-0 mr-1"
            >
              <v-radio
                :value="img.imageName"
                :disabled="!!operatingImage || !ownershipDetermined"
                density="compact"
                @click="!img.isActive && handleActivate(img)"
              />
            </v-radio-group>

            <v-icon
              v-if="!img.iconData"
              icon="mdi-puzzle"
              :color="img.isInstalled ? 'primary' : 'grey'"
              size="20"
              class="mr-2"
            />
            <v-avatar v-else size="20" class="mr-2">
              <v-img :src="`data:${img.iconMimeType};base64,${img.iconData}`" />
            </v-avatar>
          </div>
        </template>

        <!-- Content -->
        <v-list-item-title class="d-flex align-center flex-wrap">
          <code class="text-body-2 mr-2">{{ img.imageName }}</code>
          <v-chip
            v-if="img.isThisExtension"
            size="x-small"
            color="primary"
            variant="outlined"
            class="mr-1"
          >
            This
          </v-chip>
          <v-chip
            v-if="img.type"
            size="x-small"
            :color="img.type === 'base' ? 'info' : 'default'"
            variant="outlined"
            class="mr-1"
          >
            {{ img.type }}
          </v-chip>
          <v-chip
            v-if="!img.isInstalled"
            size="x-small"
            color="default"
            variant="outlined"
          >
            not installed
          </v-chip>
        </v-list-item-title>

        <!-- Actions -->
        <template #append>
          <div class="d-flex align-center">
            <!-- Uninstall button -->
            <v-btn
              v-if="img.isInstalled && img.type !== 'base'"
              size="x-small"
              variant="outlined"
              color="warning"
              :loading="operatingImage?.image === img.imageName && operatingImage?.op === 'uninstall'"
              :disabled="!!operatingImage"
              class="mr-1"
              @click="handleUninstall(img)"
            >
              Uninstall
            </v-btn>

            <!-- Delete button -->
            <v-btn
              v-if="img.type !== 'base'"
              icon
              size="x-small"
              color="error"
              variant="text"
              :loading="operatingImage?.image === img.imageName && operatingImage?.op === 'delete'"
              :disabled="!!operatingImage"
              :title="img.isInstalled ? 'Uninstall and delete image' : 'Delete image'"
              @click="handleDelete(img)"
            >
              <v-icon icon="mdi-delete" size="18" />
            </v-btn>
          </div>
        </template>
      </v-list-item>
    </v-list>

    <!-- Empty state -->
    <div v-else-if="connected && !loadingImages" class="text-body-2 text-grey">
      No Fleet extension images found.
    </div>

    <!-- Loading state -->
    <div v-else-if="loadingImages" class="d-flex align-center justify-center py-4">
      <v-progress-circular indeterminate size="24" />
      <span class="ml-2 text-grey">Loading extensions...</span>
    </div>
  </div>
</template>

<style scoped>
.extensions-tab code {
  font-family: monospace;
  font-size: 0.875rem;
}
</style>
