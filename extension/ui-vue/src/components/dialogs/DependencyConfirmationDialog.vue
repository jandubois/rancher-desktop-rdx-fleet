<script setup lang="ts">
/**
 * DependencyConfirmationDialog - Confirms enabling paths with dependencies.
 *
 * When a user tries to enable a path that has dependencies, this dialog
 * shows them what other paths will also be enabled and asks for confirmation.
 */

interface BundleInfo {
  bundleName: string;
  path: string;
  gitRepoName: string;
}

export interface DependencyDialogState {
  open: boolean;
  gitRepoName: string;
  path: string;
  willAutoSelect: BundleInfo[];
}

defineProps<{
  state: DependencyDialogState;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm'): void;
}>();
</script>

<template>
  <v-dialog
    :model-value="state.open"
    max-width="500"
    @update:model-value="!$event && emit('close')"
  >
    <v-card>
      <v-card-title>Enable Dependencies</v-card-title>
      <v-card-text>
        <p class="text-body-1 mb-4">
          The path <strong>{{ state.path }}</strong> has dependencies that will also be enabled:
        </p>
        <div class="pl-4">
          <div
            v-for="dep in state.willAutoSelect"
            :key="dep.bundleName"
            class="d-flex align-center ga-2 mb-1"
          >
            <span class="text-body-2 font-mono">{{ dep.path }}</span>
            <v-chip
              v-if="dep.gitRepoName !== state.gitRepoName"
              size="x-small"
              variant="outlined"
            >
              {{ dep.gitRepoName }}
            </v-chip>
          </div>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('close')">
          Cancel
        </v-btn>
        <v-btn variant="flat" color="primary" @click="emit('confirm')">
          Enable All
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.font-mono {
  font-family: monospace;
}
</style>
