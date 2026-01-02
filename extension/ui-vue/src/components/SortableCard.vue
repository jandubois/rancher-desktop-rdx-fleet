<script setup lang="ts">
/**
 * SortableCard - Wrapper for cards with edit mode controls.
 *
 * Provides:
 * - Drag handle for reordering (works with vuedraggable)
 * - Visibility toggle button
 * - Delete button
 */

import { inject } from 'vue';

defineProps<{
  id: string;
  isVisible?: boolean;
}>();

const emit = defineEmits<{
  (e: 'delete'): void;
  (e: 'visibilityToggle'): void;
}>();

// Get edit mode from parent
const editMode = inject<boolean>('editMode', false);
</script>

<template>
  <div class="sortable-card" :data-testid="`card-${id}`">
    <!-- Edit mode control bar -->
    <div v-if="editMode" class="control-bar">
      <!-- Drag handle - the 'handle' class is used by vuedraggable -->
      <div class="drag-handle handle" :data-testid="`drag-handle-${id}`">
        <v-icon icon="mdi-drag" size="small" color="grey" />
      </div>

      <!-- Visibility toggle -->
      <v-btn
        icon
        size="x-small"
        variant="text"
        :title="isVisible !== false ? 'Hide card' : 'Show card'"
        @click="emit('visibilityToggle')"
      >
        <v-icon
          :icon="isVisible !== false ? 'mdi-eye' : 'mdi-eye-off'"
          size="small"
        />
      </v-btn>

      <!-- Delete button -->
      <v-btn
        icon
        size="x-small"
        variant="text"
        color="error"
        title="Delete card"
        @click="emit('delete')"
      >
        <v-icon icon="mdi-delete" size="small" />
      </v-btn>
    </div>

    <!-- Card content -->
    <slot />
  </div>
</template>

<style scoped>
.sortable-card {
  position: relative;
}

.control-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 0;
  margin-bottom: -4px;
  border-radius: 4px 4px 0 0;
}

.drag-handle {
  display: flex;
  align-items: center;
  cursor: grab;
  padding: 2px 8px;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.drag-handle:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.drag-handle:active {
  cursor: grabbing;
}

/* When being dragged by vuedraggable */
.sortable-card.sortable-ghost {
  opacity: 0.5;
}

.sortable-card.sortable-drag {
  opacity: 0.8;
}
</style>
