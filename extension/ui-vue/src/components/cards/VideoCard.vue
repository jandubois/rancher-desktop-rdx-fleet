<script setup lang="ts">
/**
 * VideoCard - Embeds video content (YouTube, etc.).
 */
import { computed } from 'vue';
import CardWrapper from './CardWrapper.vue';
import type { VideoCardSettings } from '../../types/manifest';

const props = defineProps<{
  id: string;
  title?: string;
  settings?: VideoCardSettings;
}>();

const emit = defineEmits<{
  duplicate: [];
  delete: [];
}>();

// Convert YouTube URLs to embed format
const embedUrl = computed(() => {
  const src = props.settings?.src ?? '';

  // Handle YouTube URLs
  const youtubeMatch = src.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/
  );
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }

  return src;
});

const videoTitle = computed(() => props.settings?.title ?? props.title ?? 'Video');
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
    <div v-if="embedUrl" class="video-container">
      <iframe
        :src="embedUrl"
        :title="videoTitle"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      />
    </div>
    <div v-else class="no-video">
      <v-icon icon="mdi-video-off" size="48" color="grey" />
      <p class="text-grey">No video configured</p>
    </div>
  </CardWrapper>
</template>

<style scoped>
.video-container {
  position: relative;
  padding-bottom: 56.25%; /* 16:9 aspect ratio */
  height: 0;
  overflow: hidden;
}

.video-container iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.no-video {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
}
</style>
