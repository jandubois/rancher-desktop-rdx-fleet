<script setup lang="ts">
/**
 * DividerCard - Visual divider with optional label.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useManifestStore } from '../../stores/manifest';
import type { DividerCardSettings } from '../../types/manifest';

const props = defineProps<{
  id: string;
  settings?: DividerCardSettings;
}>();

const emit = defineEmits<{
  duplicate: [];
  delete: [];
}>();

const manifestStore = useManifestStore();
const { editMode } = storeToRefs(manifestStore);

const label = computed(() => props.settings?.label);
const borderStyle = computed(() => props.settings?.style ?? 'solid');
</script>

<template>
  <div class="divider-card" :class="{ 'edit-mode': editMode }">
    <!-- Edit mode controls -->
    <div v-if="editMode" class="divider-controls">
      <v-btn
        icon="mdi-content-copy"
        size="x-small"
        variant="text"
        density="compact"
        title="Duplicate"
        @click="emit('duplicate')"
      />
      <v-btn
        icon="mdi-delete"
        size="x-small"
        variant="text"
        density="compact"
        color="error"
        title="Delete"
        @click="emit('delete')"
      />
    </div>
    <v-divider
      v-if="!label"
      :style="{ borderStyle }"
      class="my-4"
    />
    <div v-else class="labeled-divider">
      <v-divider :style="{ borderStyle }" />
      <span class="divider-label">{{ label }}</span>
      <v-divider :style="{ borderStyle }" />
    </div>
  </div>
</template>

<style scoped>
.divider-card {
  position: relative;
  padding: 8px 0;
}

.divider-card.edit-mode {
  padding-right: 80px;
}

.divider-controls {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 4px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.divider-controls:hover {
  opacity: 1;
}

.labeled-divider {
  display: flex;
  align-items: center;
  gap: 16px;
}

.labeled-divider .v-divider {
  flex: 1;
}

.divider-label {
  color: #757575;
  font-size: 0.875rem;
  white-space: nowrap;
}
</style>
