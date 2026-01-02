<script setup lang="ts">
/**
 * AuthAppCoCard - SUSE Application Collection Authentication Card Component.
 *
 * Provides UI for authenticating with AppCo to access the application catalog
 * and pull Helm charts/container images from dp.apps.rancher.io.
 */

import { ref, computed } from 'vue';
import CardWrapper from './CardWrapper.vue';
import type { AppCoCardSettings } from '../../types/manifest';

defineProps<{
  id: string;
  title?: string;
  settings?: AppCoCardSettings;
}>();

const emit = defineEmits<{
  duplicate: [];
  delete: [];
}>();

// Auth state types
type AuthState = 'unauthenticated' | 'authenticated' | 'error';

// State
const authState = ref<AuthState>('unauthenticated');
const user = ref<{ username: string; email?: string; accountType?: string } | null>(null);
const error = ref<string | null>(null);
const isLoading = ref(false);
const usernameInput = ref('');
const passwordInput = ref('');

// Computed
const isAuthenticated = computed(() => authState.value === 'authenticated');

// AppCo catalog URL
const APPCO_CATALOG_URL = 'https://apps.rancher.io';

// Handle credential submission
async function handleSubmitCredentials() {
  if (!usernameInput.value.trim() || !passwordInput.value.trim()) {
    error.value = 'Please enter both username and password';
    return;
  }

  isLoading.value = true;
  error.value = null;

  try {
    // In a full implementation, this would:
    // 1. Validate credentials with AppCo API
    // 2. Store credentials in credential helper
    // 3. Configure Docker registry auth for dp.apps.rancher.io

    // For now, simulate authentication
    // A real implementation would use backend services

    // Simulated delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // For demo purposes, accept any non-empty credentials
    user.value = {
      username: usernameInput.value.trim(),
      email: usernameInput.value.includes('@') ? usernameInput.value.trim() : undefined,
    };
    authState.value = 'authenticated';
    usernameInput.value = '';
    passwordInput.value = '';
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to authenticate';
  } finally {
    isLoading.value = false;
  }
}

// Handle disconnect
function handleDisconnect() {
  user.value = null;
  authState.value = 'unauthenticated';
}

// Open catalog URL
function openCatalog() {
  window.open(APPCO_CATALOG_URL, '_blank', 'noopener,noreferrer');
}
</script>

<template>
  <CardWrapper
    :title="title ?? 'SUSE Application Collection'"
    :card-id="id"
    @duplicate="emit('duplicate')"
    @delete="emit('delete')"
  >
    <!-- Error state -->
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-3" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <!-- Authenticated state -->
    <template v-if="isAuthenticated">
      <v-alert type="success" variant="tonal" density="compact" class="mb-3">
        <div class="d-flex align-center">
          <v-icon icon="mdi-check-circle" class="mr-2" />
          <div>
            <div>Authenticated as <strong>{{ user?.username }}</strong></div>
            <div v-if="user?.email && user.email !== user.username" class="text-caption text-grey">
              ({{ user.email }})
            </div>
            <div v-if="user?.accountType" class="text-caption text-grey">
              Account type: {{ user.accountType }}
            </div>
          </div>
        </div>
      </v-alert>

      <p class="text-body-2 text-grey mb-3">
        You can now pull Helm charts and container images from <code>dp.apps.rancher.io</code>
      </p>

      <div class="d-flex gap-2">
        <v-btn variant="outlined" size="small" @click="openCatalog">
          <v-icon icon="mdi-open-in-new" start />
          Browse Application Catalog
        </v-btn>
        <v-btn color="error" variant="outlined" size="small" @click="handleDisconnect">
          Disconnect
        </v-btn>
      </div>
    </template>

    <!-- Unauthenticated state -->
    <template v-else>
      <p class="text-body-2 text-grey mb-4">
        Authenticate with SUSE Application Collection to access Helm charts and container images.
      </p>

      <v-text-field
        v-model="usernameInput"
        label="Username or Email"
        variant="outlined"
        density="compact"
        class="mb-2"
        hide-details
      />

      <v-text-field
        v-model="passwordInput"
        type="password"
        label="Password"
        variant="outlined"
        density="compact"
        class="mb-3"
        hide-details
        @keyup.enter="handleSubmitCredentials"
      />

      <div class="d-flex gap-2 align-center">
        <v-btn
          color="primary"
          :loading="isLoading"
          :disabled="!usernameInput.trim() || !passwordInput.trim()"
          @click="handleSubmitCredentials"
        >
          Connect
        </v-btn>
        <v-btn variant="text" size="small" @click="openCatalog">
          Create Account
          <v-icon icon="mdi-open-in-new" end size="small" />
        </v-btn>
      </div>
    </template>
  </CardWrapper>
</template>

<style scoped>
code {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}
</style>
