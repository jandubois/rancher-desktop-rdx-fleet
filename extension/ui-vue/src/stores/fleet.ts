/**
 * Fleet Store - Manages Fleet installation status.
 * Demonstrates idiomatic Vue patterns with polling via watchEffect.
 */

import { defineStore } from 'pinia';
import { ref, computed, onUnmounted } from 'vue';
import { backendService } from '../services/BackendService';

export type FleetStatus = 'checking' | 'not-installed' | 'installing' | 'running' | 'error';

export const useFleetStore = defineStore('fleet', () => {
  // State
  const status = ref<FleetStatus>('checking');
  const version = ref<string | undefined>();
  const error = ref<string | undefined>();
  const message = ref<string | undefined>();
  const isPolling = ref(false);
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  // Computed
  const isRunning = computed(() => status.value === 'running');
  const isInstalling = computed(() => status.value === 'installing');
  const isError = computed(() => status.value === 'error');
  const needsInstall = computed(() => status.value === 'not-installed');

  // Actions
  async function checkStatus() {
    try {
      const state = await backendService.getFleetState();
      status.value = state.status;
      version.value = state.version;
      error.value = state.error;
      message.value = state.message;
    } catch (e) {
      status.value = 'error';
      error.value = e instanceof Error ? e.message : 'Failed to check Fleet status';
    }
  }

  function startPolling(intervalMs = 5000) {
    if (isPolling.value) return;

    isPolling.value = true;
    checkStatus(); // Initial check

    pollInterval = setInterval(() => {
      checkStatus();
    }, intervalMs);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    isPolling.value = false;
  }

  // Cleanup on store disposal
  onUnmounted(() => {
    stopPolling();
  });

  return {
    // State
    status,
    version,
    error,
    message,
    isPolling,

    // Computed
    isRunning,
    isInstalling,
    isError,
    needsInstall,

    // Actions
    checkStatus,
    startPolling,
    stopPolling,
  };
});
