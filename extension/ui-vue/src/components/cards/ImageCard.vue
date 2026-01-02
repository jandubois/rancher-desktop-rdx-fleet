<script setup lang="ts">
/**
 * ImageCard - Displays an image from URL or bundled data.
 * Supports edit mode with file upload (drag & drop) or URL input.
 */
import { ref, computed, inject } from 'vue';
import CardWrapper from './CardWrapper.vue';
import type { ImageCardSettings, BundledImage } from '../../types/manifest';

// Max size for card images (2MB)
const IMAGE_MAX_SIZE = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/gif', 'image/webp'];

type ImageSourceMode = 'upload' | 'url';

const props = defineProps<{
  id: string;
  title?: string;
  settings?: ImageCardSettings;
}>();

const emit = defineEmits<{
  duplicate: [];
  delete: [];
  settingsChange: [settings: ImageCardSettings];
}>();

// Get edit mode from parent (App.vue provides this)
const editMode = inject<boolean>('editMode', false);

// Local state
const sourceMode = ref<ImageSourceMode>(
  props.settings?.src && !props.settings?.bundledImage && !props.settings?.src.startsWith('/images/')
    ? 'url'
    : 'upload'
);
const isDragging = ref(false);
const error = ref<string | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const urlInput = ref(props.settings?.src || '');
const altInput = ref(props.settings?.alt || '');

// Computed
const imageSrc = computed(() => {
  if (props.settings?.bundledImage?.data) {
    const { data, mimeType } = props.settings.bundledImage;
    return `data:${mimeType};base64,${data}`;
  }
  return props.settings?.src ?? '';
});

const altText = computed(() => props.settings?.alt ?? props.title ?? 'Image');

// File validation
function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'Invalid file type. Please upload PNG, SVG, JPEG, GIF, or WebP.';
  }
  if (file.size > IMAGE_MAX_SIZE) {
    return 'File too large. Maximum size is 2MB.';
  }
  return null;
}

// Read file as base64
async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Process uploaded file
async function processFile(file: File) {
  const validationError = validateFile(file);
  if (validationError) {
    error.value = validationError;
    return;
  }

  error.value = null;

  try {
    const data = await readFileAsBase64(file);
    const newBundledImage: BundledImage = {
      data,
      filename: file.name,
      mimeType: file.type,
    };
    emit('settingsChange', {
      ...props.settings,
      src: `/images/${file.name}`,
      bundledImage: newBundledImage,
    });
  } catch {
    error.value = 'Failed to read file';
  }
}

// Handle file drop
async function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;

  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    await processFile(files[0]);
  }
}

// Handle file selection
async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  if (files && files.length > 0) {
    await processFile(files[0]);
  }
  // Reset input so same file can be selected again
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
}

// Handle drag events
function handleDragOver(event: DragEvent) {
  event.preventDefault();
  isDragging.value = true;
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;
}

// Handle click on drop zone
function handleClick() {
  fileInputRef.value?.click();
}

// Handle mode change
function handleModeChange(newMode: ImageSourceMode) {
  sourceMode.value = newMode;
  if (newMode === 'url' && props.settings?.bundledImage) {
    emit('settingsChange', {
      ...props.settings,
      src: '',
      bundledImage: undefined,
    });
  }
}

// Handle delete image
function handleDeleteImage() {
  emit('settingsChange', {
    ...props.settings,
    src: '',
    bundledImage: undefined,
  });
  error.value = null;
}

// Handle URL change
function handleUrlChange(value: string) {
  urlInput.value = value;
  emit('settingsChange', {
    ...props.settings,
    src: value,
    bundledImage: undefined,
  });
}

// Handle alt text change
function handleAltChange(value: string) {
  altInput.value = value;
  emit('settingsChange', {
    ...props.settings,
    alt: value,
  });
}
</script>

<template>
  <CardWrapper
    :title="title"
    :card-id="id"
    :no-padding="!editMode"
    duplicatable
    @duplicate="emit('duplicate')"
    @delete="emit('delete')"
  >
    <!-- Edit mode -->
    <template v-if="editMode">
      <div class="pa-2">
        <!-- Source mode toggle -->
        <v-btn-toggle
          :model-value="sourceMode"
          mandatory
          color="primary"
          density="compact"
          class="mb-3 w-100"
        >
          <v-btn value="upload" class="flex-grow-1" @click="handleModeChange('upload')">
            <v-icon icon="mdi-cloud-upload" class="mr-1" size="small" />
            Upload Image
          </v-btn>
          <v-btn value="url" class="flex-grow-1" @click="handleModeChange('url')">
            <v-icon icon="mdi-link" class="mr-1" size="small" />
            Image URL
          </v-btn>
        </v-btn-toggle>

        <!-- Upload mode -->
        <template v-if="sourceMode === 'upload'">
          <div
            class="drop-zone"
            :class="{ dragging: isDragging, 'has-error': error }"
            @drop="handleDrop"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @click="handleClick"
          >
            <!-- Preview if image exists -->
            <template v-if="settings?.bundledImage">
              <v-img
                :src="imageSrc"
                :alt="altText"
                max-height="200"
                contain
                class="preview-image"
              />
              <p class="text-body-2 text-grey mt-2">Drop or click to replace</p>
              <p class="text-caption text-primary font-weight-medium">
                {{ settings.bundledImage.filename }}
              </p>
            </template>
            <template v-else>
              <v-icon icon="mdi-cloud-upload" size="48" color="grey-lighten-1" />
              <p class="text-body-2 text-grey mt-2">
                {{ isDragging ? 'Drop image here' : 'Drop or click to upload' }}
              </p>
              <p class="text-caption text-grey">
                PNG, SVG, JPEG, GIF, WebP (max 2MB)
              </p>
            </template>

            <input
              ref="fileInputRef"
              type="file"
              :accept="ACCEPTED_TYPES.join(',')"
              style="display: none"
              @change="handleFileSelect"
              @click.stop
            />
          </div>

          <!-- Error message -->
          <v-alert v-if="error" type="error" density="compact" class="mt-2">
            {{ error }}
          </v-alert>

          <!-- Delete button -->
          <div v-if="settings?.bundledImage" class="d-flex justify-end mt-2">
            <v-btn
              size="small"
              color="error"
              variant="text"
              @click.stop="handleDeleteImage"
            >
              <v-icon icon="mdi-delete" class="mr-1" />
              Remove image
            </v-btn>
          </div>
        </template>

        <!-- URL mode -->
        <template v-else>
          <v-text-field
            :model-value="urlInput"
            label="Image URL"
            placeholder="https://example.com/image.png"
            density="compact"
            class="mb-2"
            @update:model-value="handleUrlChange"
          />

          <!-- Preview for URL mode -->
          <div v-if="settings?.src && !settings?.bundledImage" class="url-preview mb-2">
            <p class="text-caption text-grey mb-1">Preview:</p>
            <v-img
              :src="settings.src"
              :alt="altText"
              max-height="200"
              contain
            />
          </div>
        </template>

        <!-- Alt text field (common to both modes) -->
        <v-text-field
          :model-value="altInput"
          label="Alt Text"
          placeholder="Description of the image"
          density="compact"
          class="mt-2"
          @update:model-value="handleAltChange"
        />
      </div>
    </template>

    <!-- Display mode -->
    <template v-else>
      <v-img
        v-if="imageSrc"
        :src="imageSrc"
        :alt="altText"
        class="card-image"
        cover
      />
      <div v-else class="no-image">
        <v-icon icon="mdi-image-off" size="48" color="grey" />
        <p class="text-grey">No image configured</p>
      </div>
    </template>
  </CardWrapper>
</template>

<style scoped>
.card-image {
  max-height: 300px;
}

.no-image {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  color: #9e9e9e;
}

.drop-zone {
  border: 2px dashed #9e9e9e;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.drop-zone:hover,
.drop-zone.dragging {
  border-color: #1976d2;
  background-color: rgba(25, 118, 210, 0.04);
}

.drop-zone.has-error {
  border-color: #d32f2f;
}

.preview-image {
  max-width: 100%;
  border-radius: 4px;
}

.url-preview {
  padding: 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
}
</style>
