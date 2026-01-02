<script setup lang="ts">
/**
 * MarkdownCard - Renders markdown content.
 * Uses vue-markdown-render for markdown parsing.
 * Supports edit mode with side-by-side preview.
 */
import { ref, computed, inject, watch } from 'vue';
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
  settingsChange: [settings: MarkdownCardSettings];
}>();

// Get edit mode from parent
const editMode = inject<boolean>('editMode', false);

// Local state
const contentInput = ref(props.settings?.content ?? '');
const showPreview = ref(true);

// Watch for external changes to settings
watch(() => props.settings?.content, (newContent) => {
  if (newContent !== undefined) {
    contentInput.value = newContent;
  }
});

const content = computed(() => props.settings?.content ?? '');

// Handle content change
function handleContentChange(value: string) {
  contentInput.value = value;
  emit('settingsChange', {
    ...props.settings,
    content: value,
  });
}
</script>

<template>
  <CardWrapper
    :title="title"
    :card-id="id"
    duplicatable
    @duplicate="emit('duplicate')"
    @delete="emit('delete')"
  >
    <!-- Edit mode -->
    <template v-if="editMode">
      <div class="edit-container">
        <!-- Toolbar -->
        <div class="d-flex justify-space-between align-center mb-2">
          <span class="text-caption text-grey">Supports Markdown formatting</span>
          <v-btn
            size="x-small"
            variant="text"
            :color="showPreview ? 'primary' : undefined"
            @click="showPreview = !showPreview"
          >
            <v-icon icon="mdi-eye" class="mr-1" size="small" />
            {{ showPreview ? 'Hide' : 'Show' }} Preview
          </v-btn>
        </div>

        <div class="editor-wrapper" :class="{ 'with-preview': showPreview }">
          <!-- Editor -->
          <v-textarea
            :model-value="contentInput"
            label="Markdown Content"
            placeholder="Enter markdown content here..."
            variant="outlined"
            rows="8"
            auto-grow
            class="markdown-editor"
            @update:model-value="handleContentChange"
          />

          <!-- Preview -->
          <div v-if="showPreview" class="preview-pane">
            <p class="text-caption text-grey mb-1">Preview:</p>
            <div class="markdown-content preview-content">
              <VueMarkdown :source="contentInput || '*No content*'" />
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Display mode -->
    <template v-else>
      <div v-if="content" class="markdown-content">
        <VueMarkdown :source="content" />
      </div>
      <div v-else class="no-content text-grey text-center py-4">
        No content configured
      </div>
    </template>
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

.edit-container {
  padding: 8px;
}

.editor-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.editor-wrapper.with-preview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 768px) {
  .editor-wrapper.with-preview {
    grid-template-columns: 1fr;
  }
}

.markdown-editor {
  font-family: monospace;
}

.preview-pane {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  padding: 8px;
  background-color: #fafafa;
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
}

.preview-content {
  font-size: 0.9rem;
}
</style>
