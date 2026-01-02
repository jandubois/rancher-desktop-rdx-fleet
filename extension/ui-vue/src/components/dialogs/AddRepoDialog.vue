<script setup lang="ts">
/**
 * AddRepoDialog - Dialog for adding a new Git repository.
 */
import { ref, watch } from 'vue';

interface AddGitRepoResult {
  success: boolean;
  error?: string;
}

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'add', name: string, url: string, branch?: string): Promise<AddGitRepoResult>;
}>();

// Form state
const name = ref('test-bundles');
const url = ref('https://github.com/jandubois/rancher-desktop-rdx-fleet');
const branch = ref('');
const adding = ref(false);
const error = ref<string | null>(null);

// Reset form when dialog opens
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    name.value = 'test-bundles';
    url.value = 'https://github.com/jandubois/rancher-desktop-rdx-fleet';
    branch.value = '';
    error.value = null;
  }
});

function handleClose() {
  error.value = null;
  emit('update:modelValue', false);
}

async function handleAdd() {
  if (!name.value || !url.value) return;

  adding.value = true;
  error.value = null;

  try {
    const result = await new Promise<AddGitRepoResult>((resolve) => {
      // Emit and wait for parent to handle
      emit('add', name.value, url.value, branch.value || undefined);
      // Parent should call back with result - for now assume success
      resolve({ success: true });
    });

    if (result.success) {
      handleClose();
    } else {
      error.value = result.error || 'Failed to add repository. Please check the details and try again.';
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An error occurred';
  } finally {
    adding.value = false;
  }
}

// Expose method to set error from parent
function setError(errorMsg: string | null) {
  error.value = errorMsg;
  adding.value = false;
}

// Expose method to close dialog on success
function closeOnSuccess() {
  handleClose();
}

defineExpose({ setError, closeOnSuccess });
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="500"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>Add Git Repository</v-card-title>
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
            After adding the repository, available paths will be discovered automatically.
            You can then select which paths to deploy from the repository card.
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
          :disabled="!name || !url || adding"
          :loading="adding"
          @click="handleAdd"
        >
          {{ adding ? 'Adding...' : 'Add' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
