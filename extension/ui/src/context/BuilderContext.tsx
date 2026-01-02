/* eslint-disable react-refresh/only-export-components */
/**
 * Builder context for edit mode state management.
 *
 * Provides builder/edit mode state and actions throughout the component tree,
 * separating builder concerns from runtime rendering logic.
 */

import { createContext, useContext, ReactNode, useMemo } from 'react';
import {
  useBuilderState,
  UseBuilderStateResult,
  BuilderStateInitial,
  RuntimeStateRefs,
  RuntimeStateSetters,
} from '../hooks/useBuilderState';

/** Context value type */
export type BuilderContextValue = UseBuilderStateResult;

/** Context for builder state */
const BuilderContext = createContext<BuilderContextValue | null>(null);

export interface BuilderProviderProps {
  children: ReactNode;
  /** Initial state from persisted storage */
  initial?: BuilderStateInitial;
  /** Runtime state references for snapshot operations */
  runtimeState: RuntimeStateRefs;
  /** Runtime state setters for restore operations */
  runtimeSetters: RuntimeStateSetters;
}

/**
 * Provider component for builder state.
 *
 * Usage:
 * ```tsx
 * <BuilderProvider
 *   initial={cachedInitialState}
 *   runtimeState={{ manifest, manifestCards, cardOrder, dynamicCardTitles }}
 *   runtimeSetters={{ setManifest, setManifestCards, setCardOrder, setDynamicCardTitles }}
 * >
 *   <App />
 * </BuilderProvider>
 * ```
 */
export function BuilderProvider({
  children,
  initial,
  runtimeState,
  runtimeSetters,
}: BuilderProviderProps) {
  const builderState = useBuilderState({
    initial,
    runtimeState,
    runtimeSetters,
  });

  // Memoize to prevent unnecessary re-renders
  const value = useMemo(() => builderState, [builderState]);

  return (
    <BuilderContext.Provider value={value}>
      {children}
    </BuilderContext.Provider>
  );
}

/**
 * Hook to access builder state and actions.
 *
 * @throws Error if used outside of BuilderProvider
 */
export function useBuilder(): BuilderContextValue {
  const context = useContext(BuilderContext);
  if (!context) {
    throw new Error('useBuilder must be used within a BuilderProvider');
  }
  return context;
}
