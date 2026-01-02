<script setup lang="ts">
/**
 * HtmlCard - Renders raw HTML content including <script> elements.
 *
 * Uses an iframe with document.write to allow scripts to execute with full network access.
 * Unlike MarkdownCard which sanitizes HTML, this card allows arbitrary JavaScript.
 *
 * SECURITY MODEL:
 * This component intentionally allows arbitrary JavaScript execution.
 * Content comes from the manifest (controlled by extension author) or
 * is entered by the user in edit mode.
 */

import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import CardWrapper from './CardWrapper.vue';
import { useManifestStore } from '../../stores/manifest';
import type { HtmlCardSettings } from '../../types/manifest';

const props = defineProps<{
  id: string;
  title?: string;
  settings?: HtmlCardSettings;
}>();

const emit = defineEmits<{
  duplicate: [];
  delete: [];
  settingsChange: [settings: HtmlCardSettings];
}>();

const manifestStore = useManifestStore();
const { editMode } = storeToRefs(manifestStore);

// Local state
const iframeRef = ref<HTMLIFrameElement | null>(null);
const iframeHeight = ref(200);
const localContent = ref(props.settings?.content ?? '');

// Computed content
const content = computed(() => props.settings?.content ?? '');

// Generate unique key for iframe to force recreation
const iframeKey = computed(() => {
  return `${editMode.value}-${content.value.length}-${content.value.slice(0, 50)}`;
});

// Build the full HTML document for the iframe
function buildIframeDocument(htmlContent: string): string {
  // Check if content already has html/body tags
  const hasHtmlStructure = /<html|<body/i.test(htmlContent);

  if (hasHtmlStructure) {
    return htmlContent;
  }

  // Wrap content in a basic HTML document with sensible defaults
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      margin: 0;
      padding: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #333;
    }
    * { box-sizing: border-box; }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
}

// Write content to iframe
function writeToIframe() {
  const iframe = iframeRef.value;
  const contentToWrite = editMode.value ? localContent.value : content.value;

  if (!iframe || !contentToWrite) return;

  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(buildIframeDocument(contentToWrite));
      doc.close();

      // Auto-resize after content loads
      const checkHeight = () => {
        try {
          const height = doc.body?.scrollHeight || 200;
          iframeHeight.value = Math.max(height + 20, 100);
        } catch {
          iframeHeight.value = 200;
        }
      };

      // Check height after scripts have a chance to run
      setTimeout(checkHeight, 100);
      setTimeout(checkHeight, 500);
      setTimeout(checkHeight, 1500);
    }
  } catch (e) {
    console.error('Failed to write to iframe:', e);
  }
}

// Handle content change in edit mode
function handleContentChange(value: string) {
  localContent.value = value;
  emit('settingsChange', { ...props.settings, content: value });
}

// Watch for content changes and update iframe
watch([content, iframeKey], () => {
  nextTick(() => {
    setTimeout(writeToIframe, 50);
  });
});

// Sync local content with props
watch(() => props.settings?.content, (newContent) => {
  localContent.value = newContent ?? '';
});

onMounted(() => {
  nextTick(() => {
    setTimeout(writeToIframe, 50);
  });
});
</script>

<template>
  <CardWrapper
    :title="title"
    :card-id="id"
    duplicatable
    @duplicate="emit('duplicate')"
    @delete="emit('delete')"
  >
    <!-- Edit mode: textarea + preview -->
    <template v-if="editMode">
      <v-textarea
        v-model="localContent"
        placeholder="Enter HTML content (scripts allowed)..."
        variant="outlined"
        density="compact"
        rows="5"
        auto-grow
        class="html-editor mb-3"
        @update:model-value="handleContentChange"
      />

      <div v-if="localContent" class="preview-container">
        <div class="preview-label text-caption text-grey pa-2">
          Preview:
        </div>
        <iframe
          :key="iframeKey"
          ref="iframeRef"
          class="preview-iframe"
          :style="{ height: `${iframeHeight}px` }"
          :title="title || 'HTML preview'"
        />
      </div>
    </template>

    <!-- Display mode -->
    <template v-else>
      <iframe
        v-if="content"
        :key="iframeKey"
        ref="iframeRef"
        class="content-iframe"
        :style="{ height: `${iframeHeight}px` }"
        :title="title || 'HTML content'"
      />
    </template>
  </CardWrapper>
</template>

<style scoped>
.html-editor :deep(.v-field__input) {
  font-family: monospace;
  font-size: 0.85rem;
}

.preview-container {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  overflow: hidden;
}

.preview-label {
  background-color: rgba(0, 0, 0, 0.04);
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.preview-iframe,
.content-iframe {
  width: 100%;
  border: none;
  display: block;
  border-radius: 4px;
}
</style>
