<script setup lang="ts">
/**
 * DividerCard - Visual divider with optional label.
 */
import { computed } from 'vue';
import type { DividerCardSettings } from '../../types/manifest';

const props = defineProps<{
  settings?: DividerCardSettings;
}>();

const label = computed(() => props.settings?.label);
const borderStyle = computed(() => props.settings?.style ?? 'solid');
</script>

<template>
  <div class="divider-card">
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
  padding: 8px 0;
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
