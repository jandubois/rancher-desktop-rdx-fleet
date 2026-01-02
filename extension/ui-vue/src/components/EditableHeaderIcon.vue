<script setup lang="ts">
/**
 * EditableHeaderIcon component - Header icon with edit mode support.
 * Supports drag-and-drop upload, resize, and delete.
 */

import { ref, computed, onUnmounted, inject } from 'vue';
import { useFileUpload, DEFAULT_ACCEPTED_TYPES, DEFAULT_MAX_SIZE } from '../composables/useFileUpload';

// Icon state: CustomIcon object, null (default), or 'deleted' (explicitly removed)
export interface CustomIcon {
  data: string;
  filename: string;
  mimeType: string;
}

export type IconState = CustomIcon | null | 'deleted';

// Default icon height and limits
const DEFAULT_ICON_HEIGHT = 48;
const MIN_ICON_HEIGHT = 24;
const MAX_ICON_HEIGHT = 96;

const props = withDefaults(defineProps<{
  iconState: IconState;
  iconHeight?: number;
}>(), {
  iconHeight: DEFAULT_ICON_HEIGHT,
});

const emit = defineEmits<{
  (e: 'update:iconState', state: IconState): void;
  (e: 'update:iconHeight', height: number): void;
}>();

// Get edit mode from parent
const editMode = inject<boolean>('editMode', false);

// Local state
const isDragging = ref(false);
const isHovering = ref(false);
const isResizing = ref(false);
const resizeButtonOffset = ref(0);
const isAtLimit = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const justFinishedResizing = ref(false);
let resizeStartY = 0;
let resizeStartHeight = 0;

// File upload validation
const { error, validateAndProcessFile } = useFileUpload({
  acceptedTypes: DEFAULT_ACCEPTED_TYPES,
  maxSize: DEFAULT_MAX_SIZE,
  errorAutoClearMs: 3000,
});

// Computed
const hasCustomIcon = computed(() => props.iconState !== null && props.iconState !== 'deleted');
const isDeleted = computed(() => props.iconState === 'deleted');
const showDefaultIcon = computed(() => props.iconState === null);

const customIconUrl = computed(() => {
  if (hasCustomIcon.value && props.iconState && typeof props.iconState === 'object') {
    const icon = props.iconState as CustomIcon;
    return `data:${icon.mimeType};base64,${icon.data}`;
  }
  return null;
});

// Resize handlers
function handleResizeStart(e: MouseEvent) {
  e.stopPropagation();
  e.preventDefault();
  resizeStartY = e.clientY;
  resizeStartHeight = props.iconHeight;
  resizeButtonOffset.value = 0;
  isAtLimit.value = false;
  isResizing.value = true;

  document.addEventListener('mousemove', handleResizeMove);
  document.addEventListener('mouseup', handleResizeEnd);
}

function handleResizeMove(e: MouseEvent) {
  // Moving up = larger icon, moving down = smaller icon
  const cursorDeltaY = e.clientY - resizeStartY;
  const rawHeight = resizeStartHeight - cursorDeltaY;
  const newHeight = Math.min(MAX_ICON_HEIGHT, Math.max(MIN_ICON_HEIGHT, rawHeight));
  const heightDelta = newHeight - resizeStartHeight;

  emit('update:iconHeight', newHeight);

  // Check if at min/max limit
  isAtLimit.value = rawHeight < MIN_ICON_HEIGHT || rawHeight > MAX_ICON_HEIGHT;

  // Button offset for smooth following
  resizeButtonOffset.value = cursorDeltaY - heightDelta;
}

function handleResizeEnd() {
  isResizing.value = false;
  resizeButtonOffset.value = 0;
  isAtLimit.value = false;

  document.removeEventListener('mousemove', handleResizeMove);
  document.removeEventListener('mouseup', handleResizeEnd);

  // Prevent click from opening file picker
  justFinishedResizing.value = true;
  setTimeout(() => {
    justFinishedResizing.value = false;
  }, 100);
}

// Drag and drop handlers
function handleDrop(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  isDragging.value = false;

  if (!editMode) return;

  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    processFile(files[0]);
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  if (editMode) {
    isDragging.value = true;
  }
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  isDragging.value = false;
}

async function processFile(file: File) {
  const result = await validateAndProcessFile(file);
  if (result) {
    emit('update:iconState', result as CustomIcon);
  }
}

function handleClick() {
  if (justFinishedResizing.value) return;
  if (editMode) {
    fileInputRef.value?.click();
  }
}

async function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  if (files && files.length > 0) {
    await processFile(files[0]);
  }
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
}

function handleDelete(e: MouseEvent) {
  e.stopPropagation();
  emit('update:iconState', 'deleted');
}

// Cleanup
onUnmounted(() => {
  document.removeEventListener('mousemove', handleResizeMove);
  document.removeEventListener('mouseup', handleResizeEnd);
});
</script>

<template>
  <!-- In non-edit mode with deleted icon, render nothing -->
  <template v-if="!editMode && isDeleted">
    <!-- Nothing -->
  </template>
  <div
    v-else
    class="header-icon-container"
    :class="{ 'edit-mode': editMode }"
    @mouseenter="isHovering = true"
    @mouseleave="isHovering = false"
    @drop="handleDrop"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @click="handleClick"
  >
    <!-- Icon container -->
    <div
      class="icon-wrapper"
      :class="{
        dragging: isDragging,
        hovering: isHovering && editMode,
        deleted: isDeleted && editMode,
      }"
      :style="{
        height: `${iconHeight}px`,
        minWidth: `${iconHeight}px`,
        transition: isResizing ? 'none' : 'all 0.2s ease',
      }"
    >
      <!-- Custom icon -->
      <img
        v-if="customIconUrl"
        :src="customIconUrl"
        alt="Extension icon"
        class="custom-icon"
        :style="{ height: `${iconHeight}px` }"
      />

      <!-- Default Fleet icon -->
      <svg
        v-else-if="showDefaultIcon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 135.97886 111.362"
        :style="{ height: `${iconHeight}px`, width: 'auto' }"
      >
        <rect fill="#22ad5f" width="135.97886" height="111.362" rx="14.39243"/>
        <path fill="#fff" d="M108.734,68.40666c-.31959-.70715-.62976-1.41735-.95818-2.12167A192.12367,192.12367,0,0,0,87.66084,32.59744q-2.86843-3.84771-5.93119-7.55V74.33785h29.575Q110.07441,71.35528,108.734,68.40666Zm-21.07312,0V42.829a186.742,186.742,0,0,1,14.55423,25.57769Z"/>
        <path fill="#fff" d="M70.04392,14.80415A192.53573,192.53573,0,0,0,41.96357,68.40666c-.6645,1.96876-1.30338,3.94462-1.90258,5.93119H75.97512V7.25412Q72.91337,10.95651,70.04392,14.80415Zm0,53.60251H48.22507a187.12611,187.12611,0,0,1,21.81885-43.371Z"/>
        <path fill="#fff" d="M30.85013,74.33785h6.16628A186.918,186.918,0,0,1,68.31,12.10434L60.8196,16.65309c-1.82193,1.10623-3.634,2.25062-5.42293,3.41521A193.18859,193.18859,0,0,0,30.85013,74.33785Z"/>
        <path fill="#fff" d="M21.74541,74.33785h6.12516A186.4801,186.4801,0,0,1,39.34147,42.4755q3.98814-8.55262,8.77147-16.59091-6.05757,4.39768-11.79853,9.2389Q35.11151,37.528,33.966,39.96893A192.29628,192.29628,0,0,0,21.74541,74.33785Z"/>
        <path fill="#fff" d="M111.5533,86.70839v7.12988l-62.09479.13148-4.46034-7.1406,66.55513-.12076m5.93119-5.94206-83.17239.151L46.17449,99.9079l71.31-.151V80.76633Z"/>
        <path fill="#fff" d="M43.10887,99.9079,31.24652,80.91736H24.25323L36.11561,99.9079Z"/>
        <path fill="#fff" d="M33.15,99.9079,21.28768,80.91736h-6.9933L26.15677,99.9079Z"/>
      </svg>

      <!-- Placeholder when deleted in edit mode -->
      <v-icon
        v-else-if="editMode && isDeleted && !isDragging"
        icon="mdi-image-plus"
        :size="28"
        :color="isHovering ? 'white' : 'grey-lighten-2'"
      />

      <!-- Edit overlay -->
      <div v-if="editMode && isHovering && !isDragging && !isDeleted" class="edit-overlay">
        <v-icon icon="mdi-pencil" size="20" color="white" />
      </div>

      <!-- Drop indicator -->
      <div v-if="editMode && isDragging" class="drop-overlay">
        <span class="drop-text">Drop</span>
      </div>
    </div>

    <!-- Delete button -->
    <v-tooltip v-if="editMode && !isDeleted && isHovering" text="Remove icon" location="top">
      <template #activator="{ props: tooltipProps }">
        <v-btn
          v-bind="tooltipProps"
          icon="mdi-delete"
          size="x-small"
          color="error"
          class="delete-btn"
          @click.stop="handleDelete"
        />
      </template>
    </v-tooltip>

    <!-- Resize button -->
    <v-tooltip v-if="editMode && !isDeleted && (isHovering || isResizing)" text="Drag to resize" location="left">
      <template #activator="{ props: tooltipProps }">
        <v-btn
          v-bind="tooltipProps"
          :icon="isAtLimit ? 'mdi-close' : 'mdi-arrow-expand-vertical'"
          size="x-small"
          :color="isAtLimit ? 'error' : 'primary'"
          class="resize-btn"
          :class="{ resizing: isResizing }"
          :style="{
            transform: `translateY(calc(50% + ${resizeButtonOffset}px))`,
            transition: isResizing ? 'none' : 'transform 0.15s ease-out, background-color 0.15s ease-out',
          }"
          @mousedown="handleResizeStart"
        />
      </template>
    </v-tooltip>

    <!-- Error tooltip -->
    <div v-if="error" class="error-tooltip">
      {{ error }}
    </div>

    <!-- Hidden file input -->
    <input
      ref="fileInputRef"
      type="file"
      :accept="DEFAULT_ACCEPTED_TYPES.join(',')"
      style="display: none"
      @change="handleFileSelect"
    />
  </div>
</template>

<style scoped>
.header-icon-container {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.header-icon-container.edit-mode {
  cursor: pointer;
}

.icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.edit-mode .icon-wrapper {
  border: 2px dashed transparent;
}

.edit-mode .icon-wrapper.dragging {
  border-color: rgba(255, 183, 77, 0.8);
  background-color: rgba(255, 255, 255, 0.1);
}

.edit-mode .icon-wrapper.hovering {
  border-color: rgba(255, 255, 255, 0.5);
}

.edit-mode .icon-wrapper.deleted {
  border-color: rgba(255, 255, 255, 0.3);
}

.custom-icon {
  width: auto;
  object-fit: contain;
  border-radius: 4px;
}

.edit-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drop-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drop-text {
  color: white;
  font-weight: 600;
  font-size: 0.75rem;
}

.delete-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px !important;
  height: 20px !important;
}

.resize-btn {
  position: absolute;
  left: -10px;
  bottom: 0;
  width: 20px !important;
  height: 20px !important;
  cursor: ns-resize;
}

.error-tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 4px;
  padding: 4px 8px;
  background-color: #d32f2f;
  color: white;
  border-radius: 4px;
  font-size: 0.75rem;
  white-space: nowrap;
  z-index: 1000;
}
</style>
