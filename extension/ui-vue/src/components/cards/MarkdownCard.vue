<script setup lang="ts">
/**
 * MarkdownCard - Renders markdown content.
 * Uses vue-markdown-render for markdown parsing.
 */
import { computed } from 'vue';
import VueMarkdown from 'vue-markdown-render';
import CardWrapper from './CardWrapper.vue';
import type { MarkdownCardSettings } from '../../types/manifest';

const props = defineProps<{
  id: string;
  title?: string;
  settings?: MarkdownCardSettings;
}>();

const emit = defineEmits<{
  duplicate: [];
  delete: [];
}>();

const content = computed(() => props.settings?.content ?? '');
</script>

<template>
  <CardWrapper
    :title="title"
    :card-id="id"
    duplicatable
    @duplicate="emit('duplicate')"
    @delete="emit('delete')"
  >
    <div class="markdown-content">
      <VueMarkdown :source="content" />
    </div>
  </CardWrapper>
</template>

<style scoped>
.markdown-content {
  line-height: 1.6;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3) {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

.markdown-content :deep(p) {
  margin-bottom: 0.75rem;
}

.markdown-content :deep(code) {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.markdown-content :deep(pre) {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
}
</style>
