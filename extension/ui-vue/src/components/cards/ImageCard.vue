<script setup lang="ts">
/**
 * ImageCard - Displays an image from URL or bundled data.
 */
import { computed } from 'vue';
import CardWrapper from './CardWrapper.vue';
import type { ImageCardSettings } from '../../types/manifest';

const props = defineProps<{
  id: string;
  title?: string;
  settings?: ImageCardSettings;
}>();

const emit = defineEmits<{
  duplicate: [];
  delete: [];
}>();

const imageSrc = computed(() => {
  // If bundled image data exists, use it as data URL
  if (props.settings?.bundledImage?.data) {
    const { data, mimeType } = props.settings.bundledImage;
    return `data:${mimeType};base64,${data}`;
  }
  // Otherwise use the URL
  return props.settings?.src ?? '';
});

const altText = computed(() => props.settings?.alt ?? props.title ?? 'Image');
</script>

<template>
  <CardWrapper
    :title="title"
    :card-id="id"
    no-padding
    duplicatable
    @duplicate="emit('duplicate')"
    @delete="emit('delete')"
  >
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
</style>
