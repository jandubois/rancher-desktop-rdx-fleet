<script setup lang="ts">
/**
 * EditModeEditTab - Edit branding colors and other settings.
 */

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
}>();

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
        You are currently using the Vue implementation. The React implementation has more features.
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
</style>
