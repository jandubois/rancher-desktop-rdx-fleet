<script setup lang="ts">
/**
 * CardWrapper - Base wrapper for all card types.
 * Provides consistent styling and optional title.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useManifestStore } from '../../stores/manifest';

defineProps<{
  title?: string;
  noPadding?: boolean;
  cardId?: string;
  duplicatable?: boolean;
}>();

const emit = defineEmits<{
  duplicate: [];
  delete: [];
  toggleVisibility: [];
}>();

const manifestStore = useManifestStore();
const { editMode } = storeToRefs(manifestStore);

const borderColor = computed(() => manifestStore.palette.card.border);
const titleColor = computed(() => manifestStore.palette.card.title);
</script>

<template>
  <v-card
    class="card-wrapper"
    :style="{ borderColor }"
    variant="outlined"
  >
    <!-- Card header with title and edit controls -->
    <div v-if="title || editMode" class="card-header d-flex align-center justify-space-between">
      <v-card-title
        v-if="title"
        class="card-title flex-grow-1"
        :style="{ color: titleColor }"
      >
        {{ title }}
      </v-card-title>
      <v-spacer v-else />

      <!-- Edit mode controls -->
      <div v-if="editMode" class="card-controls d-flex align-center mr-2">
        <v-btn
          v-if="duplicatable"
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
    </div>

    <v-card-text :class="{ 'pa-0': noPadding }">
      <slot />
    </v-card-text>

    <!-- Optional actions slot -->
    <v-card-actions v-if="$slots.actions">
      <slot name="actions" />
    </v-card-actions>
  </v-card>
</template>

<style scoped>
.card-wrapper {
  margin-bottom: 16px;
}

.card-header {
  min-height: 48px;
}

.card-title {
  font-size: 1rem;
  font-weight: 500;
  padding-bottom: 0;
}

.card-controls {
  opacity: 0.6;
  transition: opacity 0.2s;
}

.card-controls:hover {
  opacity: 1;
}
</style>
