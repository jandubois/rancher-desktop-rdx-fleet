/**
 * Dialog components index.
 */

export { default as ConfirmDialog } from './ConfirmDialog.vue';
export { default as AddRepoDialog } from './AddRepoDialog.vue';
export { default as EditRepoDialog } from './EditRepoDialog.vue';
export { default as DependencyConfirmationDialog } from './DependencyConfirmationDialog.vue';

// Re-export types
export type { DependencyDialogState } from './DependencyConfirmationDialog.vue';

// Initial state for dependency dialog
export const INITIAL_DEPENDENCY_DIALOG_STATE = {
  open: false,
  gitRepoName: '',
  path: '',
  willAutoSelect: [],
};
