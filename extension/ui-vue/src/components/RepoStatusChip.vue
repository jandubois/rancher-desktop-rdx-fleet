<script setup lang="ts">
/**
 * RepoStatusChip - Displays GitRepo status as a colored chip.
 */
import { computed } from 'vue';
import type { GitRepoStatus } from '../services/BackendService';

const props = defineProps<{
  status?: GitRepoStatus;
}>();

const chipColor = computed(() => {
  if (!props.status) return 'grey';
  if (props.status.display?.error) return 'error';
  if (props.status.ready) return 'success';
  return 'warning';
});

const chipIcon = computed(() => {
  if (!props.status) return 'mdi-help-circle';
  if (props.status.display?.error) return 'mdi-alert-circle';
  if (props.status.ready) return 'mdi-check-circle';
  return 'mdi-clock-outline';
});

const statusText = computed(() => {
  if (!props.status) return 'Unknown';
  if (props.status.display?.state) return props.status.display.state;
  if (props.status.ready) return 'Ready';
  return 'Pending';
});
</script>

<template>
  <v-chip
    :color="chipColor"
    size="small"
    label
  >
    <v-icon :icon="chipIcon" size="small" start />
    {{ statusText }}
  </v-chip>
</template>
