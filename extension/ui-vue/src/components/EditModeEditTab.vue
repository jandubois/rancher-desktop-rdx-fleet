<script setup lang="ts">
/**
 * EditModeEditTab - Edit branding colors and other settings.
 * Includes palette generation from icon colors.
 */

import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useManifestStore } from '../stores/manifest';
import { backendService } from '../services/BackendService';
import {
  HARMONY_TYPES,
  generatePaletteFromImage,
  type HarmonyType,
  type GeneratedPalette,
} from '../utils/paletteGenerator';
import type { ColorPalette } from '../types/palette';

interface ColorFieldConfig {
  id: string;
  label: string;
  group: 'header' | 'body' | 'card';
  property: string;
  defaultValue: string;
}

const props = defineProps<{
  colorFields: ColorFieldConfig[];
  getColorValue: (field: ColorFieldConfig) => string;
  isAtDefault: (field: ColorFieldConfig) => boolean;
}>();

const emit = defineEmits<{
  (e: 'colorChange', field: ColorFieldConfig, value: string): void;
  (e: 'resetColor', field: ColorFieldConfig): void;
  (e: 'switchToReact'): void;
  (e: 'applyPalette', palette: ColorPalette): void;
}>();

const manifestStore = useManifestStore();
const { manifest } = storeToRefs(manifestStore);

// Palette generation state
const paletteMenuOpen = ref(false);
const generatingPalette = ref(false);
const selectedHarmony = ref<HarmonyType | 'icon' | null>(null);
const iconData = ref<string | null>(null);
const harmonyPreviews = ref<Map<HarmonyType, GeneratedPalette>>(new Map());
const hoveredHarmony = ref<HarmonyType | 'icon' | null>(null);

// Get icon from backend
async function loadIconData() {
  try {
    const result = await backendService.getLocalIcon();
    if (result.data) {
      iconData.value = result.data;
    }
  } catch (error) {
    console.error('Failed to load icon:', error);
  }
}

// Generate palette previews when menu opens
async function handleOpenPaletteMenu() {
  paletteMenuOpen.value = true;

  if (!iconData.value) {
    await loadIconData();
  }

  if (iconData.value && harmonyPreviews.value.size === 0) {
    generatingPalette.value = true;
    try {
      for (const { value: harmony } of HARMONY_TYPES) {
        const palette = await generatePaletteFromImage(iconData.value, { harmony });
        if (palette) {
          harmonyPreviews.value.set(harmony, palette);
        }
      }
    } catch (error) {
      console.error('Failed to generate palettes:', error);
    } finally {
      generatingPalette.value = false;
    }
  }
}

// Apply a harmony type
async function applyHarmony(harmony: HarmonyType | 'icon') {
  selectedHarmony.value = harmony;
  paletteMenuOpen.value = false;

  if (!iconData.value) {
    await loadIconData();
  }

  if (!iconData.value) {
    console.error('No icon data available');
    return;
  }

  generatingPalette.value = true;
  try {
    const effectiveHarmony = harmony === 'icon' ? 'analogous' : harmony;
    const palette = await generatePaletteFromImage(iconData.value, { harmony: effectiveHarmony });

    if (palette) {
      manifestStore.updatePalette(palette.uiPalette);
    }
  } catch (error) {
    console.error('Failed to apply palette:', error);
  } finally {
    generatingPalette.value = false;
  }
}

// Get preview colors for a harmony type
function getPreviewColors(harmony: HarmonyType): { headerBg: string; headerText: string; bodyBg: string; cardBorder: string; cardTitle: string } | null {
  const preview = harmonyPreviews.value.get(harmony);
  if (!preview) return null;

  return {
    headerBg: preview.uiPalette.header?.background || '#22ad5f',
    headerText: preview.uiPalette.header?.text || '#ffffff',
    bodyBg: preview.uiPalette.body?.background || '#f5f5f5',
    cardBorder: preview.uiPalette.card?.border || '#e0e0e0',
    cardTitle: preview.uiPalette.card?.title || 'inherit',
  };
}

// Whether palette can be changed (has logo)
const canChangePalette = computed(() => !!manifest.value.branding?.logo);

// Validate hex color
function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color);
}

// Get picker value for color input
function getPickerValue(field: ColorFieldConfig): string {
  const currentValue = props.getColorValue(field);
  if (isValidHexColor(currentValue)) return currentValue;
  return field.defaultValue !== 'inherit' ? field.defaultValue : '#212121';
}

// Get helper text
function getHelperText(field: ColorFieldConfig): string {
  const currentValue = props.getColorValue(field);
  const isValid = isValidHexColor(currentValue) || currentValue === 'inherit';

  if (!isValid) return 'Enter hex color (e.g., #1976d2) or "inherit"';
  if (currentValue === 'inherit') return 'Inherits from parent';
  if (!props.isAtDefault(field)) return 'Modified';
  return '';
}

function handlePickerChange(field: ColorFieldConfig, event: Event) {
  const target = event.target as HTMLInputElement;
  emit('colorChange', field, target.value);
}
</script>

<template>
  <div>
    <!-- Branding Colors Section -->
    <div class="d-flex align-center justify-space-between mb-4">
      <p class="text-body-2 text-medium-emphasis mb-0">
        Customize the extension appearance. Enter hex color values or use the color picker.
      </p>

      <!-- Auto Palette Button -->
      <v-menu v-model="paletteMenuOpen" :close-on-content-click="false" location="bottom end">
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            size="small"
            variant="outlined"
            :loading="generatingPalette"
            :disabled="!canChangePalette"
            class="ml-4"
            @click="handleOpenPaletteMenu"
          >
            <v-icon icon="mdi-palette" start />
            Auto Palette
          </v-btn>
        </template>

        <v-card min-width="320">
          <v-card-text class="pa-2">
            <p class="text-caption text-grey mb-2">Hover to preview - Click to apply</p>
          </v-card-text>
          <v-divider />

          <!-- Icon Color option -->
          <v-list density="compact">
            <v-list-item
              :class="{ 'v-list-item--active': selectedHarmony === 'icon' }"
              @click="applyHarmony('icon')"
              @mouseenter="hoveredHarmony = 'icon'"
              @mouseleave="hoveredHarmony = null"
            >
              <template #prepend>
                <v-icon v-if="selectedHarmony === 'icon'" icon="mdi-check" size="small" class="mr-2" />
                <div v-else class="mr-2" style="width: 20px" />
              </template>
              <v-list-item-title>Icon Color</v-list-item-title>
              <v-list-item-subtitle class="text-caption">
                Analogous palette from icon
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>

          <v-divider />

          <!-- Harmony type options -->
          <v-list density="compact">
            <v-list-item
              v-for="harmony in HARMONY_TYPES"
              :key="harmony.value"
              :class="{ 'v-list-item--active': selectedHarmony === harmony.value }"
              @click="applyHarmony(harmony.value)"
              @mouseenter="hoveredHarmony = harmony.value"
              @mouseleave="hoveredHarmony = null"
            >
              <template #prepend>
                <v-icon v-if="selectedHarmony === harmony.value" icon="mdi-check" size="small" class="mr-2" />
                <div v-else class="mr-2" style="width: 20px" />

                <!-- Color swatch preview -->
                <div v-if="getPreviewColors(harmony.value)" class="color-preview mr-3">
                  <div class="preview-row">
                    <div
                      class="preview-swatch preview-header-bg"
                      :style="{ backgroundColor: getPreviewColors(harmony.value)!.headerBg }"
                      title="Header Background"
                    />
                    <div
                      class="preview-swatch preview-header-text"
                      :style="{ backgroundColor: getPreviewColors(harmony.value)!.headerText }"
                      title="Header Text"
                    />
                  </div>
                  <div class="preview-row">
                    <div
                      class="preview-swatch preview-body"
                      :style="{ backgroundColor: getPreviewColors(harmony.value)!.bodyBg }"
                      title="Body Background"
                    />
                    <div
                      class="preview-swatch preview-border"
                      :style="{ backgroundColor: getPreviewColors(harmony.value)!.cardBorder }"
                      title="Card Border"
                    />
                    <div
                      class="preview-swatch preview-title"
                      :style="{ backgroundColor: getPreviewColors(harmony.value)!.cardTitle === 'inherit' ? '#212121' : getPreviewColors(harmony.value)!.cardTitle }"
                      title="Card Title"
                    />
                  </div>
                </div>
                <v-progress-circular v-else indeterminate size="20" width="2" class="mr-3" />
              </template>
              <v-list-item-title>{{ harmony.label }}</v-list-item-title>
              <v-list-item-subtitle class="text-caption">
                {{ harmony.description }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card>
      </v-menu>
    </div>

    <v-row>
      <v-col v-for="field in colorFields" :key="field.id" cols="12" sm="6">
        <div class="d-flex align-start ga-2">
          <v-text-field
            :model-value="getColorValue(field)"
            :label="field.label"
            :error="!isValidHexColor(getColorValue(field)) && getColorValue(field) !== 'inherit'"
            :hint="getHelperText(field)"
            persistent-hint
            density="compact"
            class="flex-grow-1"
            @update:model-value="(val: string) => emit('colorChange', field, val)"
          >
            <template #prepend-inner>
              <input
                type="color"
                :value="getPickerValue(field)"
                class="color-picker"
                @input="(e) => handlePickerChange(field, e)"
              />
            </template>
          </v-text-field>
          <v-btn
            v-if="!isAtDefault(field)"
            icon="mdi-restore"
            size="small"
            variant="text"
            title="Reset to default"
            class="mt-1"
            @click="emit('resetColor', field)"
          />
        </div>
      </v-col>
    </v-row>

    <!-- Framework Toggle Section -->
    <v-divider class="my-6" />

    <div>
      <h4 class="text-subtitle-2 mb-2">UI Framework (Experimental)</h4>
      <v-alert type="info" density="compact" class="mb-3">
        You are currently using the Vue implementation.
      </v-alert>
      <v-btn variant="outlined" @click="emit('switchToReact')">
        Switch to React
      </v-btn>
    </div>
  </div>
</template>

<style scoped>
.color-picker {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-picker::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}

.color-preview {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preview-row {
  display: flex;
  gap: 1px;
}

.preview-swatch {
  width: 10px;
  height: 12px;
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.preview-header-bg {
  width: 18px;
  border-radius: 2px 0 0 0;
}

.preview-header-text {
  border-radius: 0 2px 0 0;
}

.preview-body {
  border-radius: 0 0 0 2px;
}

.preview-title {
  border-radius: 0 0 2px 0;
}
</style>
