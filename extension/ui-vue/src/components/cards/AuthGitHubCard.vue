<script setup lang="ts">
/**
 * AuthGitHubCard - GitHub Authentication Card Component.
 *
 * Provides UI for authenticating with GitHub via gh CLI or Personal Access Token.
 * This is a simplified Vue implementation - full auth logic would require
 * additional services (CredentialService, GitHubService).
 */

import { ref, computed, onMounted } from 'vue';
import CardWrapper from './CardWrapper.vue';
import type { AuthCardSettings } from '../../types/manifest';
import { ddClient } from '../../lib/ddClient';

defineProps<{
  id: string;
  title?: string;
  settings?: AuthCardSettings;
}>();

const emit = defineEmits<{
  duplicate: [];
  delete: [];
}>();

// Auth state types
type AuthState = 'loading' | 'unauthenticated' | 'authenticated' | 'error';

// State
const authState = ref<AuthState>('loading');
const user = ref<{ login: string; name?: string } | null>(null);
const error = ref<string | null>(null);
const isLoading = ref(false);
const patInput = ref('');
const ghCliAvailable = ref(false);
const ghCliAuthenticated = ref(false);

// Rate limit info (simplified)
const rateLimit = ref<{ limit: number; remaining: number; reset: number } | null>(null);

// Computed
const isAuthenticated = computed(() => authState.value === 'authenticated');
const showGhOption = computed(() => ghCliAvailable.value && ghCliAuthenticated.value);

// Check gh CLI status
async function checkGhCli() {
  try {
    const result = await ddClient.extension.host?.cli.exec('gh', ['auth', 'status']);
    ghCliAvailable.value = true;
    ghCliAuthenticated.value = !result?.stderr?.includes('not logged');
  } catch {
    ghCliAvailable.value = false;
    ghCliAuthenticated.value = false;
  }
}

// Validate token with GitHub API
async function validateToken(token: string): Promise<{ login: string; name?: string } | null> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return { login: data.login, name: data.name };
  } catch {
    return null;
  }
}

// Get rate limit from GitHub API
async function fetchRateLimit(token?: string) {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('https://api.github.com/rate_limit', { headers });
    if (response.ok) {
      const data = await response.json();
      rateLimit.value = {
        limit: data.rate.limit,
        remaining: data.rate.remaining,
        reset: data.rate.reset,
      };
    }
  } catch {
    // Ignore rate limit errors
  }
}

// Handle gh CLI token
async function handleUseGhToken() {
  isLoading.value = true;
  error.value = null;

  try {
    const result = await ddClient.extension.host?.cli.exec('gh', ['auth', 'token']);
    const token = result?.stdout?.trim();

    if (!token) {
      error.value = 'Failed to get token from gh CLI';
      return;
    }

    const validatedUser = await validateToken(token);
    if (!validatedUser) {
      error.value = 'Token validation failed';
      return;
    }

    user.value = validatedUser;
    authState.value = 'authenticated';
    await fetchRateLimit(token);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to authenticate with gh CLI';
  } finally {
    isLoading.value = false;
  }
}

// Handle PAT submission
async function handleSubmitPat() {
  if (!patInput.value.trim()) {
    error.value = 'Please enter a token';
    return;
  }

  isLoading.value = true;
  error.value = null;

  try {
    const validatedUser = await validateToken(patInput.value.trim());
    if (!validatedUser) {
      error.value = 'Invalid token. Please check and try again.';
      return;
    }

    user.value = validatedUser;
    authState.value = 'authenticated';
    await fetchRateLimit(patInput.value.trim());
    patInput.value = '';
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to validate token';
  } finally {
    isLoading.value = false;
  }
}

// Handle disconnect
function handleDisconnect() {
  user.value = null;
  authState.value = 'unauthenticated';
  fetchRateLimit();
}

// Initialize
onMounted(async () => {
  await checkGhCli();
  await fetchRateLimit();
  authState.value = 'unauthenticated';
});
</script>

<template>
  <CardWrapper
    :title="title ?? 'GitHub Authentication'"
    :card-id="id"
    @duplicate="emit('duplicate')"
    @delete="emit('delete')"
  >
    <!-- Loading state -->
    <div v-if="authState === 'loading'" class="d-flex align-center justify-center py-4">
      <v-progress-circular indeterminate size="24" />
      <span class="ml-2 text-grey">Checking authentication...</span>
    </div>

    <!-- Error state -->
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-3" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <!-- Authenticated state -->
    <template v-if="isAuthenticated">
      <v-alert type="success" variant="tonal" density="compact" class="mb-3">
        <div class="d-flex align-center">
          <v-icon icon="mdi-github" class="mr-2" />
          <span>Authenticated as <strong>@{{ user?.login }}</strong></span>
        </div>
        <template v-if="user?.name">
          <div class="text-caption text-grey mt-1">({{ user.name }})</div>
        </template>
      </v-alert>

      <!-- Rate limit info -->
      <div v-if="rateLimit" class="d-flex align-center justify-space-between mb-3">
        <span class="text-body-2 text-grey">
          API Rate Limit: {{ rateLimit.remaining }} / {{ rateLimit.limit }} remaining
        </span>
        <v-btn size="x-small" variant="text" @click="fetchRateLimit()">
          <v-icon icon="mdi-refresh" size="small" />
        </v-btn>
      </div>

      <v-btn color="error" variant="outlined" size="small" @click="handleDisconnect">
        Disconnect
      </v-btn>
    </template>

    <!-- Unauthenticated state -->
    <template v-else-if="authState === 'unauthenticated'">
      <p class="text-body-2 text-grey mb-4">
        Authenticate to increase API rate limits (60 → 5,000/hour) and access private repositories.
      </p>

      <!-- gh CLI option -->
      <div v-if="showGhOption" class="mb-4">
        <v-btn
          color="primary"
          variant="outlined"
          :loading="isLoading"
          @click="handleUseGhToken"
        >
          <v-icon icon="mdi-console" start />
          Use gh CLI Token
        </v-btn>
        <p class="text-caption text-grey mt-1">
          Use your existing gh CLI authentication
        </p>
      </div>

      <v-divider v-if="showGhOption" class="my-4">
        <span class="text-caption text-grey px-2">OR</span>
      </v-divider>

      <!-- PAT input -->
      <div class="d-flex gap-2">
        <v-text-field
          v-model="patInput"
          type="password"
          label="Personal Access Token"
          placeholder="ghp_xxxxxxxxxxxx"
          variant="outlined"
          density="compact"
          hide-details
          class="flex-grow-1"
          @keyup.enter="handleSubmitPat"
        />
        <v-btn
          color="primary"
          :loading="isLoading"
          :disabled="!patInput.trim()"
          @click="handleSubmitPat"
        >
          Connect
        </v-btn>
      </div>
      <p class="text-caption text-grey mt-2">
        Create a token at
        <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">
          github.com/settings/tokens
        </a>
      </p>

      <!-- Unauthenticated rate limit -->
      <div v-if="rateLimit" class="mt-4 text-body-2 text-grey">
        Unauthenticated rate limit: {{ rateLimit.remaining }} / {{ rateLimit.limit }}
        <span v-if="rateLimit.remaining < 10" class="text-warning">(Low!)</span>
      </div>
    </template>
  </CardWrapper>
</template>
