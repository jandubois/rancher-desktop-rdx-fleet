<script setup lang="ts">
/**
 * PathCheckbox - Individual path checkbox with dependency info.
 *
 * Shows visual indicators for:
 * - Blocked paths (can't be selected due to missing dependencies)
 * - Protected paths (can't be deselected because other paths depend on them)
 * - Paths with dependencies (will auto-select other paths)
 */

import { computed } from 'vue';

interface BundleInfo {
  bundleName: string;
  path: string;
  gitRepoName: string;
}

interface PathInfo {
  path: string;
  name?: string;
}

interface DependencyResolution {
  canSelect: boolean;
  blockedBy: string[];
  willAutoSelect: BundleInfo[];
}

interface DeselectionInfo {
  canDeselect: boolean;
  requiredBy: BundleInfo[];
}

const props = defineProps<{
  pathInfo: PathInfo;
  isSelected: boolean;
  selectionInfo: DependencyResolution;
  deselectionInfo: DeselectionInfo | null;
  isUpdating: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle'): void;
  (e: 'showDependencyDialog'): void;
}>();

const isBlocked = computed(() => !props.selectionInfo.canSelect);
const isProtected = computed(() =>
  !!(props.isSelected && props.deselectionInfo && !props.deselectionInfo.canDeselect)
);
const hasDepsToSelect = computed(() => props.selectionInfo.willAutoSelect.length > 0);

// Build tooltip text
const tooltipText = computed(() => {
  if (isBlocked.value) {
    return `Blocked: requires ${props.selectionInfo.blockedBy.join(', ')} (not in any configured repository)`;
  }
  if (isProtected.value && props.deselectionInfo) {
    const requiredByNames = props.deselectionInfo.requiredBy.map(b => b.path).join(', ');
    return `Required by: ${requiredByNames}`;
  }
  if (hasDepsToSelect.value && !props.isSelected) {
    const depsToAdd = props.selectionInfo.willAutoSelect.map(b => b.path).join(', ');
    return `Will also enable: ${depsToAdd}`;
  }
  return '';
});

const isDisabled = computed(() =>
  props.isUpdating || isBlocked.value || isProtected.value
);

function handleChange() {
  if (isBlocked.value || isProtected.value) return;

  if (props.isSelected) {
    // Deselecting - simple toggle
    emit('toggle');
  } else if (hasDepsToSelect.value) {
    // Selecting with dependencies - show confirmation dialog
    emit('showDependencyDialog');
  } else {
    // Simple selection without dependencies
    emit('toggle');
  }
}
</script>

<template>
  <v-tooltip :text="tooltipText" location="top" :disabled="!tooltipText">
    <template #activator="{ props: tooltipProps }">
      <div v-bind="tooltipProps" class="path-checkbox-row">
        <v-checkbox
          :model-value="isSelected"
          :disabled="isDisabled"
          density="compact"
          hide-details
          class="path-checkbox"
          @update:model-value="handleChange"
        >
          <template v-if="isBlocked" #input>
            <v-icon icon="mdi-block-helper" color="error" size="small" />
          </template>
          <template v-else-if="isProtected && isSelected" #input>
            <v-icon icon="mdi-lock" color="info" size="small" />
          </template>
        </v-checkbox>

        <div class="path-label">
          <span class="path-text" :class="{ 'text-error': isBlocked, 'text-info': isProtected }">
            {{ pathInfo.path }}
          </span>

          <v-chip
            v-if="isProtected && deselectionInfo"
            size="x-small"
            color="info"
            variant="outlined"
            class="ml-1"
          >
            required by {{ deselectionInfo.requiredBy.length }}
          </v-chip>

          <v-chip
            v-if="hasDepsToSelect && !isSelected"
            size="x-small"
            color="warning"
            variant="outlined"
            class="ml-1"
          >
            +{{ selectionInfo.willAutoSelect.length }} deps
          </v-chip>

          <v-chip
            v-if="isBlocked"
            size="x-small"
            color="error"
            variant="outlined"
            class="ml-1"
          >
            blocked
          </v-chip>
        </div>
      </div>
    </template>
  </v-tooltip>
</template>

<style scoped>
.path-checkbox-row {
  display: flex;
  align-items: center;
  margin: -2px 0;
}

.path-checkbox {
  flex-shrink: 0;
}

.path-label {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.path-text {
  font-family: monospace;
  font-size: 0.875rem;
}
</style>
