<script setup lang="ts">
/**
 * DynamicCard - Renders the appropriate card component based on type.
 * Uses Vue's dynamic component feature.
 */
import { computed } from 'vue';
import { getCardComponent } from './cards';
import CardWrapper from './cards/CardWrapper.vue';
import type { CardDefinition } from '../types/manifest';

const props = defineProps<{
  card: CardDefinition;
}>();

const emit = defineEmits<{
  duplicate: [id: string];
  delete: [id: string];
}>();

// Get the component for this card type
const cardComponent = computed(() => getCardComponent(props.card.type));

// Check if card type is supported
const isSupported = computed(() => !!cardComponent.value);
</script>

<template>
  <!-- Render the dynamic component if supported -->
  <component
    :is="cardComponent"
    v-if="isSupported"
    :id="card.id"
    :title="card.title"
    :settings="card.settings"
    @duplicate="emit('duplicate', card.id)"
    @delete="emit('delete', card.id)"
  />

  <!-- Fallback for unsupported types -->
  <CardWrapper v-else :title="card.title ?? 'Unknown Card'">
    <v-alert type="warning" variant="tonal" density="compact">
      Unsupported card type: {{ card.type }}
    </v-alert>
  </CardWrapper>
</template>
