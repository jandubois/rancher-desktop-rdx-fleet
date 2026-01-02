<script setup lang="ts">
/**
 * EditModePanel - Extension builder panel with tabs for editing, loading, and building.
 * Vue implementation matching the React EditModePanel functionality.
 */

import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useManifestStore } from '../stores/manifest';
import { defaultPalette, type ColorPalette } from '../types/palette';
import { setUIFramework } from '../utils/storage';
import EditModeEditTab from './EditModeEditTab.vue';
import EditModeLoadTab from './EditModeLoadTab.vue';
import EditModeBuildTab from './EditModeBuildTab.vue';
import EditModeExtensionsTab from './EditModeExtensionsTab.vue';

const manifestStore = useManifestStore();
const { manifest } = storeToRefs(manifestStore);

// Panel state
const expanded = ref(true);
const activeTab = ref(0);

// Color field definitions for the Edit tab
const colorFields = [
  { id: 'header-bg', label: 'Header Background', group: 'header' as const, property: 'background', defaultValue: defaultPalette.header.background },
  { id: 'header-text', label: 'Header Text', group: 'header' as const, property: 'text', defaultValue: defaultPalette.header.text },
  { id: 'body-bg', label: 'Body Background', group: 'body' as const, property: 'background', defaultValue: defaultPalette.body.background },
  { id: 'card-border', label: 'Card Border', group: 'card' as const, property: 'border', defaultValue: defaultPalette.card.border },
  { id: 'card-title', label: 'Card Title', group: 'card' as const, property: 'title', defaultValue: defaultPalette.card.title },
];

// Get current color value from manifest palette
function getColorValue(field: typeof colorFields[number]): string {
  const pal = manifest.value.branding?.palette;
  if (!pal) return field.defaultValue;
  const group = pal[field.group];
  if (!group) return field.defaultValue;
  return (group as Record<string, string | undefined>)[field.property] ?? field.defaultValue;
}

// Handle color change
function handleColorChange(field: typeof colorFields[number], value: string) {
  const currentPalette = manifest.value.branding?.palette || {};
  const updatedPalette: ColorPalette = {
    ...currentPalette,
    [field.group]: {
      ...(currentPalette[field.group] || {}),
      [field.property]: value || undefined,
    },
  };
  manifestStore.updatePalette(updatedPalette);
}

// Reset color to default
function handleResetColor(field: typeof colorFields[number]) {
  const currentPalette = manifest.value.branding?.palette || {};
  const groupData = { ...(currentPalette[field.group] || {}) };
  delete (groupData as Record<string, string | undefined>)[field.property];

  const updatedPalette: ColorPalette = {
    ...currentPalette,
    [field.group]: Object.keys(groupData).length > 0 ? groupData : undefined,
  };

  // Clean up empty groups
  if (!updatedPalette.header || Object.keys(updatedPalette.header).length === 0) {
    delete updatedPalette.header;
  }
  if (!updatedPalette.body || Object.keys(updatedPalette.body).length === 0) {
    delete updatedPalette.body;
  }
  if (!updatedPalette.card || Object.keys(updatedPalette.card).length === 0) {
    delete updatedPalette.card;
  }

  manifestStore.updatePalette(updatedPalette);
}

// Check if color is at default value
function isAtDefault(field: typeof colorFields[number]): boolean {
  return getColorValue(field) === field.defaultValue;
}

// Framework switching
function switchToReact() {
  setUIFramework('react');
  window.location.reload();
}
</script>

<template>
  <v-card class="edit-mode-panel mb-4" variant="outlined" color="warning">
    <!-- Header -->
    <v-card-title
      class="d-flex align-center justify-space-between cursor-pointer"
      @click="expanded = !expanded"
    >
      <div class="d-flex align-center">
        <v-icon icon="mdi-hammer-wrench" class="mr-2" color="warning-darken-2" />
        <span class="text-warning-darken-2 font-weight-bold">Edit Mode - Extension Builder</span>
      </div>
      <v-icon :icon="expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'" />
    </v-card-title>

    <!-- Expandable content -->
    <v-expand-transition>
      <div v-show="expanded">
        <v-card-text class="pt-0">
          <!-- Tabs -->
          <v-tabs v-model="activeTab" color="primary">
            <v-tab :value="0">Edit</v-tab>
            <v-tab :value="1">Load</v-tab>
            <v-tab :value="2">Build</v-tab>
            <v-tab :value="3">Extensions</v-tab>
          </v-tabs>

          <v-divider />

          <v-tabs-window v-model="activeTab" class="pt-4">
            <!-- Edit Tab -->
            <v-tabs-window-item :value="0">
              <EditModeEditTab
                :color-fields="colorFields"
                :get-color-value="getColorValue"
                :is-at-default="isAtDefault"
                @color-change="handleColorChange"
                @reset-color="handleResetColor"
                @switch-to-react="switchToReact"
              />
            </v-tabs-window-item>

            <!-- Load Tab -->
            <v-tabs-window-item :value="1">
              <EditModeLoadTab />
            </v-tabs-window-item>

            <!-- Build Tab -->
            <v-tabs-window-item :value="2">
              <EditModeBuildTab />
            </v-tabs-window-item>

            <!-- Extensions Tab -->
            <v-tabs-window-item :value="3">
              <EditModeExtensionsTab
                :own-header-background="manifest.branding?.palette?.header?.background"
              />
            </v-tabs-window-item>
          </v-tabs-window>
        </v-card-text>
      </div>
    </v-expand-transition>
  </v-card>
</template>

<style scoped>
.edit-mode-panel {
  border-width: 2px;
}

.cursor-pointer {
  cursor: pointer;
}

.cursor-pointer:hover {
  background-color: rgba(0, 0, 0, 0.04);
}
</style>
