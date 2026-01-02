/**
 * useBackendStatus - Composable for monitoring backend health.
 * Uses Vue's reactivity with interval-based polling.
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { backendService, type BackendStatus, type BackendHealth, type ExtensionIdentity } from '../services/BackendService';

export function useBackendStatus(pollInterval = 10000) {
  // Reactive state
  const status = ref<BackendStatus | null>(null);
  const isPolling = ref(false);
  let intervalId: ReturnType<typeof setInterval> | null = null;

  // Computed properties - idiomatic Vue derived state
  const isConnected = computed(() => status.value?.connected ?? false);

  const health = computed<BackendHealth | undefined>(() => status.value?.health);

  const identity = computed<ExtensionIdentity | undefined>(() => status.value?.identity);

  const isHealthy = computed(() => health.value?.status === 'healthy');

  const error = computed(() => status.value?.error);

  const lastChecked = computed(() => status.value?.lastChecked);

  const containerId = computed(() => identity.value?.containerId);

  const extensionName = computed(() => identity.value?.extensionName);

  // Actions
  async function checkStatus() {
    try {
      status.value = await backendService.getStatus();
    } catch (e) {
      status.value = {
        connected: false,
        error: e instanceof Error ? e.message : 'Unknown error',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  function startPolling() {
    if (isPolling.value) return;

    isPolling.value = true;
    checkStatus(); // Initial check

    intervalId = setInterval(checkStatus, pollInterval);
  }

  function stopPolling() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    isPolling.value = false;
  }

  // Lifecycle hooks - idiomatic Vue pattern
  onMounted(() => {
    startPolling();
  });

  onUnmounted(() => {
    stopPolling();
  });

  return {
    // State
    status,
    isPolling,

    // Computed
    isConnected,
    health,
    identity,
    isHealthy,
    error,
    lastChecked,
    containerId,
    extensionName,

    // Actions
    checkStatus,
    startPolling,
    stopPolling,
  };
}
