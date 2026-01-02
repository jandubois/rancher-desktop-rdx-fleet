<script setup lang="ts">
/**
 * FleetStatusCard - Shows Fleet installation status.
 * Uses Pinia store with storeToRefs for reactive access.
 */
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import CardWrapper from './CardWrapper.vue';
import { useFleetStore } from '../../stores/fleet';

const fleetStore = useFleetStore();
const { status, version, error, message, isRunning, isInstalling, isError, needsInstall } = storeToRefs(fleetStore);

// Start polling on mount
onMounted(() => {
  fleetStore.startPolling();
});

// Status display helpers
function getStatusColor(): string {
  if (isRunning.value) return 'success';
  if (isError.value) return 'error';
  if (isInstalling.value) return 'warning';
  return 'grey';
}

function getStatusIcon(): string {
  if (isRunning.value) return 'mdi-check-circle';
  if (isError.value) return 'mdi-alert-circle';
  if (isInstalling.value) return 'mdi-loading mdi-spin';
  if (needsInstall.value) return 'mdi-download';
  return 'mdi-clock-outline';
}

function getStatusText(): string {
  switch (status.value) {
    case 'running': return `Fleet ${version.value ?? ''} Running`;
    case 'installing': return 'Installing Fleet...';
    case 'not-installed': return 'Fleet Not Installed';
    case 'error': return 'Fleet Error';
    case 'checking': return 'Checking Status...';
    default: return 'Unknown';
  }
}
</script>

<template>
  <CardWrapper title="Fleet Status">
    <div class="fleet-status">
      <v-chip
        :color="getStatusColor()"
        size="large"
        label
      >
        <v-icon :icon="getStatusIcon()" start />
        {{ getStatusText() }}
      </v-chip>

      <!-- Error message -->
      <v-alert
        v-if="isError && error"
        type="error"
        density="compact"
        variant="tonal"
        class="mt-3"
      >
        {{ error }}
      </v-alert>

      <!-- Info message -->
      <p v-if="message && !isError" class="text-body-2 text-grey mt-3">
        {{ message }}
      </p>

      <!-- Install button -->
      <v-btn
        v-if="needsInstall"
        color="primary"
        class="mt-4"
        @click="fleetStore.checkStatus"
      >
        <v-icon icon="mdi-download" start />
        Install Fleet
      </v-btn>

      <!-- Refresh button -->
      <v-btn
        variant="text"
        size="small"
        class="mt-2"
        @click="fleetStore.checkStatus"
      >
        <v-icon icon="mdi-refresh" start />
        Refresh Status
      </v-btn>
    </div>
  </CardWrapper>
</template>

<style scoped>
.fleet-status {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
</style>
