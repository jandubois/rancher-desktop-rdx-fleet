<script setup lang="ts">
/**
 * App.vue - Main application component.
 * Demonstrates idiomatic Vue patterns:
 * - Pinia stores with storeToRefs for reactive state
 * - Computed properties for derived state
 * - vuedraggable for drag-and-drop (v-model pattern)
 * - Lifecycle hooks (onMounted)
 * - Template refs
 */
import { ref, computed, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import draggable from 'vuedraggable';

import { useManifestStore } from './stores/manifest';
import { useFleetStore } from './stores/fleet';
import { useGitReposStore } from './stores/gitrepos';

import DynamicCard from './components/DynamicCard.vue';
import FleetStatusCard from './components/cards/FleetStatusCard.vue';
import type { CardDefinition } from './types/manifest';

// Store access with storeToRefs for reactive destructuring
const manifestStore = useManifestStore();
const fleetStore = useFleetStore();
const gitReposStore = useGitReposStore();

const {
  visibleCards,
  appName,
  headerLogo,
  iconHeight,
  palette,
  showFleetStatus,
  allowEditMode,
  editMode,
} = storeToRefs(manifestStore);

// Local state
const drawer = ref(false);
const isDragging = ref(false);

// Computed styles from palette
const headerStyle = computed(() => ({
  backgroundColor: palette.value.header.background,
  color: palette.value.header.text,
}));

const bodyStyle = computed(() => ({
  backgroundColor: palette.value.body.background,
  minHeight: '100vh',
}));

// Draggable cards model - uses v-model pattern
const draggableCards = computed({
  get: () => [...visibleCards.value],
  set: (newOrder: CardDefinition[]) => {
    manifestStore.reorderCards(newOrder);
  },
});

// Actions
function handleDuplicate(cardId: string) {
  const card = visibleCards.value.find(c => c.id === cardId);
  if (card) {
    const newCard: CardDefinition = {
      ...card,
      id: `${card.id}-${Date.now()}`,
      title: `${card.title} (Copy)`,
    };
    manifestStore.addCard(newCard);
  }
}

function handleDelete(cardId: string) {
  manifestStore.removeCard(cardId);
}

function toggleEditMode() {
  manifestStore.setEditMode(!editMode.value);
}

// Initialize stores on mount
onMounted(() => {
  fleetStore.startPolling();
  gitReposStore.startPolling();
});

// Watch for edit mode changes
watch(editMode, (isEditing) => {
  if (isEditing) {
    drawer.value = true;
  }
});
</script>

<template>
  <v-app :style="bodyStyle">
    <!-- App Bar / Header -->
    <v-app-bar :style="headerStyle" flat>
      <!-- Logo -->
      <template #prepend>
        <img
          v-if="headerLogo"
          :src="headerLogo"
          :height="iconHeight"
          alt="Logo"
          class="ml-4"
        />
        <v-app-bar-title v-else class="ml-2">
          {{ appName }}
        </v-app-bar-title>
      </template>

      <v-spacer />

      <!-- Edit mode toggle -->
      <v-btn
        v-if="allowEditMode"
        :icon="editMode ? 'mdi-check' : 'mdi-pencil'"
        :color="editMode ? 'success' : undefined"
        variant="text"
        @click="toggleEditMode"
      />

      <!-- Menu button for navigation drawer -->
      <v-btn
        icon="mdi-menu"
        variant="text"
        @click="drawer = !drawer"
      />
    </v-app-bar>

    <!-- Navigation Drawer (Edit Panel) -->
    <v-navigation-drawer
      v-model="drawer"
      location="right"
      temporary
      width="400"
    >
      <v-card flat>
        <v-card-title class="d-flex justify-space-between align-center">
          <span>Settings</span>
          <v-btn icon="mdi-close" variant="text" @click="drawer = false" />
        </v-card-title>
        <v-divider />
        <v-card-text>
          <v-switch
            v-if="allowEditMode"
            v-model="editMode"
            label="Edit Mode"
            color="primary"
            hide-details
          />

          <v-alert
            v-if="editMode"
            type="info"
            variant="tonal"
            density="compact"
            class="mt-4"
          >
            Drag cards to reorder them. Click the edit button on each card to modify its content.
          </v-alert>

          <v-divider class="my-4" />

          <h3 class="text-subtitle-1 mb-2">About</h3>
          <p class="text-body-2 text-grey">
            Fleet GitOps Extension for Rancher Desktop.
            Manage your GitOps repositories with ease.
          </p>
        </v-card-text>
      </v-card>
    </v-navigation-drawer>

    <!-- Main Content -->
    <v-main>
      <v-container fluid class="pa-4">
        <!-- Fleet Status Card -->
        <FleetStatusCard v-if="showFleetStatus" />

        <!-- Draggable Cards Container -->
        <draggable
          v-model="draggableCards"
          item-key="id"
          handle=".drag-handle"
          ghost-class="ghost-card"
          :disabled="!editMode"
          @start="isDragging = true"
          @end="isDragging = false"
        >
          <template #item="{ element: card }">
            <div class="card-container" :class="{ 'edit-mode': editMode }">
              <!-- Drag handle (visible in edit mode) -->
              <div v-if="editMode" class="drag-handle">
                <v-icon icon="mdi-drag" />
              </div>

              <!-- The actual card -->
              <DynamicCard
                :card="card"
                @duplicate="handleDuplicate"
                @delete="handleDelete"
              />
            </div>
          </template>
        </draggable>

        <!-- Empty state -->
        <v-card
          v-if="visibleCards.length === 0"
          variant="outlined"
          class="empty-state"
        >
          <v-card-text class="text-center pa-8">
            <v-icon icon="mdi-cards-outline" size="64" color="grey" />
            <h3 class="text-h6 mt-4">No Cards Configured</h3>
            <p class="text-body-2 text-grey mt-2">
              Add cards to customize your extension dashboard.
            </p>
            <v-btn
              v-if="editMode"
              color="primary"
              class="mt-4"
            >
              <v-icon icon="mdi-plus" start />
              Add Card
            </v-btn>
          </v-card-text>
        </v-card>
      </v-container>
    </v-main>

    <!-- Footer -->
    <v-footer app class="text-caption text-grey justify-center">
      Fleet GitOps Extension (Vue)
    </v-footer>
  </v-app>
</template>

<style>
/* Global styles */
html, body {
  margin: 0;
  padding: 0;
  font-family: 'Roboto', sans-serif;
}
</style>

<style scoped>
.card-container {
  position: relative;
  transition: all 0.2s ease;
}

.card-container.edit-mode {
  padding-left: 32px;
}

.drag-handle {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  cursor: grab;
  padding: 8px;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.drag-handle:hover {
  opacity: 1;
}

.drag-handle:active {
  cursor: grabbing;
}

/* Ghost class for dragging */
.ghost-card {
  opacity: 0.5;
  background: #f0f0f0;
}

.empty-state {
  max-width: 400px;
  margin: 40px auto;
}
</style>
