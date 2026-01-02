<script setup lang="ts">
/**
 * EditableTitle - An inline-editable title component.
 * Shows an input when in edit mode, text otherwise.
 * Includes length validation and contrast-aware warning colors.
 */

import { computed, inject } from 'vue';

const MAX_LENGTH_WARNING = 20;

// Calculate luminance of a color (returns 0-1, where 0=black, 1=white)
function getLuminance(hex: string): number {
  const color = hex.replace('#', '');

  let r: number, g: number, b: number;
  if (color.length === 3) {
    r = parseInt(color[0] + color[0], 16) / 255;
    g = parseInt(color[1] + color[1], 16) / 255;
    b = parseInt(color[2] + color[2], 16) / 255;
  } else {
    r = parseInt(color.substring(0, 2), 16) / 255;
    g = parseInt(color.substring(2, 4), 16) / 255;
    b = parseInt(color.substring(4, 6), 16) / 255;
  }

  // Apply gamma correction
  const rsRGB = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const gsRGB = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const bsRGB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  return 0.2126 * rsRGB + 0.7152 * gsRGB + 0.0722 * bsRGB;
}

// Calculate WCAG contrast ratio (1-21)
function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Get high-contrast warning color based on background
function getContrastWarningColor(backgroundColor?: string, titleTextColor?: string): string {
  if (!backgroundColor || !backgroundColor.startsWith('#')) {
    return '#ff3333';
  }

  const MIN_CONTRAST = 3.0; // WCAG AA Large Text
  const FALLBACK_THRESHOLD = 4.0;

  const coloredCandidates = ['#ff3333', '#cc0000', '#ffcc00', '#ff6600'];
  const fallbackCandidates = ['#ffffff', '#000000'];

  // Try colored candidates first
  let bestColoredOption = '';
  let bestColoredContrast = 0;

  for (const candidate of coloredCandidates) {
    const contrast = getContrastRatio(backgroundColor, candidate);
    let tooSimilarToTitle = false;

    if (titleTextColor?.startsWith('#')) {
      const contrastWithTitle = getContrastRatio(candidate, titleTextColor);
      tooSimilarToTitle = contrastWithTitle < 2.0;
    }

    if (contrast >= MIN_CONTRAST && !tooSimilarToTitle && contrast > bestColoredContrast) {
      bestColoredContrast = contrast;
      bestColoredOption = candidate;
    }
  }

  if (bestColoredOption) return bestColoredOption;

  // Fall back to black or white
  let bestFallback = '';
  let bestFallbackContrast = 0;

  for (const candidate of fallbackCandidates) {
    const contrast = getContrastRatio(backgroundColor, candidate);
    let tooSimilarToTitle = false;

    if (titleTextColor?.startsWith('#')) {
      const contrastWithTitle = getContrastRatio(candidate, titleTextColor);
      tooSimilarToTitle = contrastWithTitle < 2.0;
    }

    if (contrast >= FALLBACK_THRESHOLD && !tooSimilarToTitle && contrast > bestFallbackContrast) {
      bestFallbackContrast = contrast;
      bestFallback = candidate;
    }
  }

  if (bestFallback) return bestFallback;

  // Last resort
  bestFallback = fallbackCandidates[0];
  bestFallbackContrast = getContrastRatio(backgroundColor, fallbackCandidates[0]);

  for (let i = 1; i < fallbackCandidates.length; i++) {
    const contrast = getContrastRatio(backgroundColor, fallbackCandidates[i]);
    if (contrast > bestFallbackContrast) {
      bestFallbackContrast = contrast;
      bestFallback = fallbackCandidates[i];
    }
  }

  return bestFallback;
}

const props = withDefaults(defineProps<{
  modelValue: string;
  placeholder?: string;
  variant?: 'h6' | 'subtitle1' | 'subtitle2';
  bold?: boolean;
  validationWarning?: string | null;
  backgroundColor?: string;
  textColor?: string;
}>(), {
  placeholder: 'Enter title...',
  variant: 'h6',
  bold: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

// Get edit mode from parent
const editMode = inject<boolean>('editMode', false);

const isTooLong = computed(() => props.modelValue.length > MAX_LENGTH_WARNING);
const warningColor = computed(() => getContrastWarningColor(props.backgroundColor, props.textColor));

const typographyClass = computed(() => {
  switch (props.variant) {
    case 'h6': return 'text-h6';
    case 'subtitle1': return 'text-subtitle-1';
    case 'subtitle2': return 'text-subtitle-2';
    default: return 'text-h6';
  }
});
</script>

<template>
  <div v-if="editMode" class="editable-title-container">
    <input
      :value="modelValue"
      :placeholder="placeholder"
      :class="[typographyClass, { 'font-weight-bold': bold }]"
      class="editable-title-input"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span
      v-if="isTooLong"
      class="warning-text"
      :style="{ color: warningColor }"
    >
      Long names may wrap in the sidebar ({{ modelValue.length }} characters)
    </span>
    <span
      v-if="validationWarning"
      class="warning-text"
      :class="{ 'mt-1': isTooLong }"
      :style="{ color: warningColor }"
    >
      {{ validationWarning }}
    </span>
  </div>
  <span
    v-else
    :class="[typographyClass, { 'font-weight-bold': bold }]"
  >
    {{ modelValue }}
    <slot />
  </span>
</template>

<style scoped>
.editable-title-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.editable-title-input {
  background: transparent;
  border: none;
  outline: none;
  padding: 0;
  color: inherit;
  width: 100%;
}

.editable-title-input::placeholder {
  opacity: 0.5;
  color: inherit;
}

.warning-text {
  font-size: 0.75rem;
  font-weight: 600;
  display: block;
}
</style>
