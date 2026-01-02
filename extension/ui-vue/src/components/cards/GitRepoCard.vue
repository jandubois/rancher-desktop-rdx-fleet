<script setup lang="ts">
/**
 * GitRepoCard - Manages a GitRepo resource.
 * Demonstrates v-model for two-way binding and Vue reactivity.
 */
import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import CardWrapper from './CardWrapper.vue';
import RepoStatusChip from '../RepoStatusChip.vue';
import { useGitReposStore } from '../../stores/gitrepos';
import { usePathDiscovery } from '../../composables/usePathDiscovery';
import type { GitRepoCardSettings } from '../../types/manifest';
import type { GitRepo } from '../../services/BackendService';

const props = defineProps<{
  id: string;
  title?: string;
  settings?: GitRepoCardSettings;
  repoName?: string;
}>();

const emit = defineEmits<{
  duplicate: [];
  delete: [];
}>();

// Store access
const gitReposStore = useGitReposStore();
const { repos, loading } = storeToRefs(gitReposStore);

// Path discovery composable
const { discoverPaths, isDiscovering } = usePathDiscovery();

// Local state with v-model pattern
const repoUrl = ref('');
const branch = ref('');
const selectedPaths = ref<string[]>([]);
const availablePaths = ref<string[]>([]);
const showAddDialog = ref(false);
const isEditing = ref(false);

// Find the matching repo from the store
const repo = computed<GitRepo | undefined>(() =>
  repos.value.find(r => r.name === props.repoName)
);

// Sync local state when repo changes - Vue watch pattern
watch(repo, (newRepo) => {
  if (newRepo) {
    repoUrl.value = newRepo.repo;
    branch.value = newRepo.branch ?? '';
    selectedPaths.value = newRepo.paths ?? [];
  }
}, { immediate: true });

// Computed status
const repoStatus = computed(() => repo.value?.status);
const isReady = computed(() => repoStatus.value?.ready === true);
const hasError = computed(() => repoStatus.value?.display?.error === true);
const statusMessage = computed(() => repoStatus.value?.display?.message ?? repoStatus.value?.display?.state);

// Settings
const canDuplicate = computed(() => props.settings?.duplicatable !== false);
const maxVisiblePaths = computed(() => props.settings?.max_visible_paths ?? 6);

// Discover paths when URL changes
async function onDiscoverPaths() {
  if (!repoUrl.value) return;

  try {
    const paths = await discoverPaths(repoUrl.value, branch.value || undefined);
    availablePaths.value = paths.map(p => p.path);
  } catch (e) {
    console.error('Failed to discover paths:', e);
  }
}

// Save changes
async function saveRepo() {
  if (!props.repoName || !repoUrl.value) return;

  try {
    await gitReposStore.updateRepo({
      name: props.repoName,
      repo: repoUrl.value,
      branch: branch.value || undefined,
      paths: selectedPaths.value,
    });
    isEditing.value = false;
  } catch (e) {
    console.error('Failed to save repo:', e);
  }
}
</script>

<template>
  <CardWrapper
    :title="title"
    :card-id="id"
    :duplicatable="canDuplicate"
    @duplicate="emit('duplicate')"
    @delete="emit('delete')"
  >
    <!-- Loading state -->
    <div v-if="loading" class="loading-state">
      <v-progress-circular indeterminate size="24" />
      <span class="ml-2">Loading repository...</span>
    </div>

    <!-- Empty state -->
    <div v-else-if="!repo" class="empty-state">
      <v-icon icon="mdi-source-repository" size="48" color="grey" />
      <p class="text-grey mt-2">No repository configured</p>
      <v-btn
        color="primary"
        variant="outlined"
        class="mt-4"
        @click="showAddDialog = true"
      >
        <v-icon icon="mdi-plus" start />
        Add Repository
      </v-btn>
    </div>

    <!-- Repository display -->
    <div v-else class="repo-content">
      <!-- Status header -->
      <div class="repo-header">
        <RepoStatusChip :status="repoStatus" />
        <div class="repo-actions">
          <v-btn
            icon="mdi-pencil"
            size="small"
            variant="text"
            title="Edit repository"
            @click="isEditing = !isEditing"
          />
        </div>
      </div>

      <!-- Repository URL -->
      <div class="repo-url">
        <v-icon icon="mdi-git" size="small" class="mr-2" />
        <a :href="repo.repo" target="_blank" rel="noopener noreferrer">
          {{ repo.repo }}
        </a>
      </div>

      <!-- Branch -->
      <div v-if="repo.branch" class="repo-branch">
        <v-icon icon="mdi-source-branch" size="small" class="mr-2" />
        {{ repo.branch }}
      </div>

      <!-- Paths -->
      <div v-if="repo.paths?.length" class="repo-paths">
        <v-icon icon="mdi-folder-outline" size="small" class="mr-2" />
        <v-chip-group>
          <v-chip
            v-for="path in repo.paths.slice(0, maxVisiblePaths)"
            :key="path"
            size="small"
            label
          >
            {{ path }}
          </v-chip>
          <v-chip
            v-if="repo.paths.length > maxVisiblePaths"
            size="small"
            label
            color="grey"
          >
            +{{ repo.paths.length - maxVisiblePaths }} more
          </v-chip>
        </v-chip-group>
      </div>

      <!-- Status message -->
      <v-alert
        v-if="statusMessage"
        :type="hasError ? 'error' : isReady ? 'success' : 'info'"
        density="compact"
        variant="tonal"
        class="mt-3"
      >
        {{ statusMessage }}
      </v-alert>
    </div>

    <!-- Edit dialog -->
    <v-dialog v-model="isEditing" max-width="600">
      <v-card>
        <v-card-title>Edit Repository</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="repoUrl"
            label="Repository URL"
            placeholder="https://github.com/owner/repo"
            prepend-icon="mdi-git"
          />
          <v-text-field
            v-model="branch"
            label="Branch (optional)"
            placeholder="main"
            prepend-icon="mdi-source-branch"
          />

          <div class="d-flex align-center mb-2">
            <span class="text-subtitle-2">Paths</span>
            <v-btn
              size="small"
              variant="text"
              class="ml-2"
              :loading="isDiscovering"
              @click="onDiscoverPaths"
            >
              Discover Paths
            </v-btn>
          </div>

          <v-chip-group v-model="selectedPaths" multiple>
            <v-chip
              v-for="path in availablePaths"
              :key="path"
              :value="path"
              filter
              size="small"
            >
              {{ path }}
            </v-chip>
          </v-chip-group>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="isEditing = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveRepo">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </CardWrapper>
</template>

<style scoped>
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.repo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.repo-actions {
  display: flex;
  gap: 4px;
}

.repo-url,
.repo-branch {
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  color: #616161;
  margin-bottom: 8px;
}

.repo-url a {
  color: inherit;
  text-decoration: none;
}

.repo-url a:hover {
  text-decoration: underline;
}

.repo-paths {
  display: flex;
  align-items: flex-start;
  margin-top: 8px;
}
</style>
