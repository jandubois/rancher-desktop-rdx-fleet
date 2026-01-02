<script setup lang="ts">
/**
 * CardWrapper - Base wrapper for all card types.
 * Provides consistent styling and optional title.
 */
import { computed } from 'vue';
import { useManifestStore } from '../../stores/manifest';

defineProps<{
  title?: string;
  noPadding?: boolean;
}>();

const manifestStore = useManifestStore();

const borderColor = computed(() => manifestStore.palette.card.border);
const titleColor = computed(() => manifestStore.palette.card.title);
</script>

<template>
  <v-card
    class="card-wrapper"
    :style="{ borderColor }"
    variant="outlined"
  >
    <v-card-title
      v-if="title"
      class="card-title"
      :style="{ color: titleColor }"
    >
      {{ title }}
    </v-card-title>

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

.card-title {
  font-size: 1rem;
  font-weight: 500;
  padding-bottom: 0;
}
</style>
