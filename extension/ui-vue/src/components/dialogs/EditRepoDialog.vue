<script setup lang="ts">
/**
 * EditRepoDialog - Dialog for editing an existing Git repository.
 */
import { ref, computed, watch } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  currentName: string;
  currentUrl: string;
  currentBranch?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'save', oldName: string, newName: string, url: string, branch?: string): void;
}>();

// Form state
const name = ref(props.currentName);
const url = ref(props.currentUrl);
const branch = ref(props.currentBranch || '');
const saving = ref(false);
const error = ref<string | null>(null);

// Reset form when dialog opens with new repo
watch(() => [props.modelValue, props.currentName, props.currentUrl, props.currentBranch], () => {
  if (props.modelValue) {
    name.value = props.currentName;
    url.value = props.currentUrl;
    branch.value = props.currentBranch || '';
    error.value = null;
  }
}, { immediate: true });

const hasChanges = computed(() =>
  name.value !== props.currentName ||
  url.value !== props.currentUrl ||
  branch.value !== (props.currentBranch || '')
);

function handleClose() {
  error.value = null;
  emit('update:modelValue', false);
}

async function handleSave() {
  if (!name.value || !url.value) return;

  saving.value = true;
  error.value = null;

  try {
    emit('save', props.currentName, name.value, url.value, branch.value || undefined);
    handleClose();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An error occurred';
  } finally {
    saving.value = false;
  }
}

// Expose method to set error from parent
function setError(errorMsg: string | null) {
  error.value = errorMsg;
  saving.value = false;
}

defineExpose({ setError });
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="500"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>Edit Repository</v-card-title>
      <v-card-text>
        <v-alert
          v-if="error"
          type="error"
          closable
          class="mb-4"
          style="white-space: pre-wrap; font-family: monospace;"
          @click:close="error = null"
        >
          {{ error }}
        </v-alert>

        <div class="d-flex flex-column ga-3">
          <v-text-field
            v-model="name"
            label="Name"
            placeholder="my-app"
            hint="Unique name for this GitRepo resource"
            persistent-hint
            required
          />

          <v-text-field
            v-model="url"
            label="Repository URL"
            placeholder="https://github.com/org/repo"
            hint="Git repository URL (HTTPS)"
            persistent-hint
            required
          />

          <v-text-field
            v-model="branch"
            label="Branch"
            placeholder="main"
            hint="Branch to track (leave empty for default)"
            persistent-hint
          />

          <p class="text-body-2 text-medium-emphasis">
            Changing the repository URL will clear all selected paths. You will need to
            rediscover and select paths from the new repository.
          </p>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="handleClose">
          Cancel
        </v-btn>
        <v-btn
          variant="flat"
          color="primary"
          :disabled="!name || !url || !hasChanges || saving"
          :loading="saving"
          @click="handleSave"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
