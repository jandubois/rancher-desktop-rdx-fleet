/**
 * Hook for managing builder/edit mode state.
 * Consolidates all edit mode related state and actions.
 */

import { useState, useCallback } from 'react';
import type { Manifest, CardDefinition } from '../manifest';
import type { IconState } from '../components/EditableHeaderIcon';
import { EditModeSnapshot, DEFAULT_ICON_HEIGHT } from '../utils/extensionStateStorage';

/** Options for initializing builder state from persisted storage */
export interface BuilderStateInitial {
  editMode?: boolean;
  iconState?: IconState;
  iconHeight?: number;
  editModeSnapshot?: EditModeSnapshot | null;
  activeEditTab?: number;
}

/** Runtime state needed for snapshot/restore operations */
export interface RuntimeStateRefs {
  manifest: Manifest;
  manifestCards: CardDefinition[];
  cardOrder: string[];
  dynamicCardTitles: Record<string, string>;
}

/** Runtime state setters for restore operations */
export interface RuntimeStateSetters {
  setManifest: (m: Manifest) => void;
  setManifestCards: React.Dispatch<React.SetStateAction<CardDefinition[]>>;
  setCardOrder: React.Dispatch<React.SetStateAction<string[]>>;
  setDynamicCardTitles: (t: Record<string, string>) => void;
}

export interface UseBuilderStateOptions {
  initial?: BuilderStateInitial;
  runtimeState: RuntimeStateRefs;
  runtimeSetters: RuntimeStateSetters;
}

export interface BuilderState {
  editMode: boolean;
  iconState: IconState;
  iconHeight: number;
  titleWarning: string | null;
  confirmResetOpen: boolean;
  editModeSnapshot: EditModeSnapshot | null;
  activeEditTab: number;
}

export interface BuilderActions {
  enterEditMode: () => void;
  applyEditMode: () => void;
  cancelEditMode: () => void;
  setIconState: (state: IconState) => void;
  setIconHeight: (height: number) => void;
  setTitleWarning: (warning: string | null) => void;
  setActiveEditTab: (tab: number) => void;
  openResetDialog: () => void;
  closeResetDialog: () => void;
}

export interface UseBuilderStateResult extends BuilderState, BuilderActions {}

/**
 * Hook for managing builder/edit mode state.
 * Extracts builder-specific state from App.tsx while maintaining
 * the ability to snapshot and restore runtime state.
 */
export function useBuilderState({
  initial,
  runtimeState,
  runtimeSetters,
}: UseBuilderStateOptions): UseBuilderStateResult {
  // Builder-specific state
  const [editMode, setEditMode] = useState(initial?.editMode ?? false);
  const [iconState, setIconState] = useState<IconState>(initial?.iconState ?? null);
  const [iconHeight, setIconHeight] = useState(initial?.iconHeight ?? DEFAULT_ICON_HEIGHT);
  const [titleWarning, setTitleWarning] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [editModeSnapshot, setEditModeSnapshot] = useState<EditModeSnapshot | null>(
    initial?.editModeSnapshot ?? null
  );
  const [activeEditTab, setActiveEditTab] = useState(initial?.activeEditTab ?? 0);

  // Enter edit mode - save snapshot for undo
  const enterEditMode = useCallback(() => {
    setEditModeSnapshot({
      manifest: runtimeState.manifest,
      manifestCards: runtimeState.manifestCards,
      cardOrder: runtimeState.cardOrder,
      iconState,
      iconHeight,
      dynamicCardTitles: runtimeState.dynamicCardTitles,
    });
    setEditMode(true);
  }, [runtimeState, iconState, iconHeight]);

  // Apply edit mode changes - clear snapshot and exit
  const applyEditMode = useCallback(() => {
    // Remove unconverted placeholders from both manifestCards and cardOrder
    runtimeSetters.setManifestCards((prev) => prev.filter((c) => c.type !== 'placeholder'));
    runtimeSetters.setCardOrder((prev) => {
      const placeholderIds = runtimeState.manifestCards
        .filter((c) => c.type === 'placeholder')
        .map((c) => c.id);
      return prev.filter((id) => !placeholderIds.includes(id));
    });
    setEditModeSnapshot(null);
    setEditMode(false);
  }, [runtimeState.manifestCards, runtimeSetters]);

  // Cancel edit mode - restore snapshot and exit
  const cancelEditMode = useCallback(() => {
    if (editModeSnapshot) {
      runtimeSetters.setManifest(editModeSnapshot.manifest);
      runtimeSetters.setManifestCards(editModeSnapshot.manifestCards);
      runtimeSetters.setCardOrder(editModeSnapshot.cardOrder);
      setIconState(editModeSnapshot.iconState);
      setIconHeight(editModeSnapshot.iconHeight);
      runtimeSetters.setDynamicCardTitles(editModeSnapshot.dynamicCardTitles);
    }
    setEditModeSnapshot(null);
    setEditMode(false);
  }, [editModeSnapshot, runtimeSetters]);

  return {
    // State
    editMode,
    iconState,
    iconHeight,
    titleWarning,
    confirmResetOpen,
    editModeSnapshot,
    activeEditTab,
    // Actions
    enterEditMode,
    applyEditMode,
    cancelEditMode,
    setIconState,
    setIconHeight,
    setTitleWarning,
    setActiveEditTab,
    openResetDialog: () => setConfirmResetOpen(true),
    closeResetDialog: () => setConfirmResetOpen(false),
  };
}
