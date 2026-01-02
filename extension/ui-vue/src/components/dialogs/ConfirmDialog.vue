<script setup lang="ts">
/**
 * ConfirmDialog - Generic confirmation dialog.
 * Reusable for multiple actions throughout the app.
 */

type ConfirmColor = 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';

defineProps<{
  modelValue: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: ConfirmColor;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

function handleCancel() {
  emit('update:modelValue', false);
  emit('cancel');
}

function handleConfirm() {
  emit('update:modelValue', false);
  emit('confirm');
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="400"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>{{ title }}</v-card-title>
      <v-card-text>{{ message }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="handleCancel"
        >
          {{ cancelLabel || 'Cancel' }}
        </v-btn>
        <v-btn
          variant="flat"
          :color="confirmColor || 'primary'"
          @click="handleConfirm"
        >
          {{ confirmLabel || 'Confirm' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
