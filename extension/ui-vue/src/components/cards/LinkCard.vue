<script setup lang="ts">
/**
 * LinkCard - Displays a list of links as buttons or list items.
 */
import { computed } from 'vue';
import CardWrapper from './CardWrapper.vue';
import type { LinkCardSettings, LinkItem } from '../../types/manifest';

const props = defineProps<{
  title?: string;
  settings?: LinkCardSettings;
}>();

const links = computed<LinkItem[]>(() => props.settings?.links ?? []);
const variant = computed(() => props.settings?.variant ?? 'buttons');

// Map icon names to MDI icons
function getMdiIcon(iconName?: string): string {
  if (!iconName) return 'mdi-link';

  // Common mappings from MUI to MDI
  const iconMap: Record<string, string> = {
    'GitHub': 'mdi-github',
    'Link': 'mdi-link',
    'OpenInNew': 'mdi-open-in-new',
    'Article': 'mdi-file-document',
    'Book': 'mdi-book',
    'Code': 'mdi-code-tags',
    'Help': 'mdi-help-circle',
    'Info': 'mdi-information',
  };

  return iconMap[iconName] ?? `mdi-${iconName.toLowerCase()}`;
}

function openLink(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}
</script>

<template>
  <CardWrapper :title="title">
    <!-- Button variant -->
    <div v-if="variant === 'buttons'" class="button-links">
      <v-btn
        v-for="link in links"
        :key="link.url"
        variant="outlined"
        class="link-button"
        @click="openLink(link.url)"
      >
        <v-icon :icon="getMdiIcon(link.icon)" start />
        {{ link.label }}
      </v-btn>
    </div>

    <!-- List variant -->
    <v-list v-else density="compact">
      <v-list-item
        v-for="link in links"
        :key="link.url"
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
      >
        <template #prepend>
          <v-icon :icon="getMdiIcon(link.icon)" />
        </template>
        <v-list-item-title>{{ link.label }}</v-list-item-title>
      </v-list-item>
    </v-list>

    <!-- Empty state -->
    <div v-if="links.length === 0" class="no-links">
      <p class="text-grey">No links configured</p>
    </div>
  </CardWrapper>
</template>

<style scoped>
.button-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.link-button {
  text-transform: none;
}

.no-links {
  text-align: center;
  padding: 16px;
}
</style>
