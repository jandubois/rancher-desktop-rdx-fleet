/**
 * Hook for managing collapsible auth card state.
 *
 * Features:
 * - Auto-collapses when authenticated (if auto_collapse is enabled)
 * - Allows manual collapse/expand
 * - Auto-expands when errors occur
 * - Persists collapse preference in localStorage (per card id)
 */

import { useState, useCallback, useEffect } from 'react';

export type AuthState = 'loading' | 'unauthenticated' | 'authenticated' | 'error';

interface UseCollapsibleAuthOptions {
  /** Unique card ID for localStorage persistence */
  cardId: string;
  /** Current authentication state */
  authState: AuthState;
  /** Whether auto-collapse is enabled in settings */
  autoCollapse: boolean;
  /** Current error state (triggers auto-expand when set) */
  error: string | null;
}

interface UseCollapsibleAuthResult {
  /** Whether the card is currently collapsed */
  isCollapsed: boolean;
  /** Toggle the collapsed state */
  toggleCollapse: () => void;
  /** Manually set collapsed state */
  setCollapsed: (collapsed: boolean) => void;
}

const STORAGE_KEY_PREFIX = 'auth-card-collapsed-';

/**
 * Get initial collapsed state from localStorage or compute default
 */
function getInitialCollapsedState(cardId: string, authState: AuthState, autoCollapse: boolean): boolean {
  // Don't collapse during loading
  if (authState === 'loading') return false;

  // Check localStorage for user preference
  const stored = localStorage.getItem(STORAGE_KEY_PREFIX + cardId);
  if (stored !== null) {
    return stored === 'true';
  }

  // Default: collapse if authenticated and auto_collapse is enabled
  return autoCollapse && authState === 'authenticated';
}

export function useCollapsibleAuth({
  cardId,
  authState,
  autoCollapse,
  error,
}: UseCollapsibleAuthOptions): UseCollapsibleAuthResult {
  // Direct collapsed state - initialized from localStorage or computed default
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() =>
    getInitialCollapsedState(cardId, authState, autoCollapse)
  );

  // Track previous error for detecting new errors
  const [prevError, setPrevError] = useState<string | null>(error);

  // Track if auto-collapse has been applied for current auth session
  const [hasAutoCollapsed, setHasAutoCollapsed] = useState<boolean>(false);

  // Handle error changes - expand card when new error occurs
  useEffect(() => {
    // Detect new error
    if (error && error !== prevError && isCollapsed) {
      // Use setTimeout to defer the state update to avoid cascading renders
      const timeoutId = setTimeout(() => {
        setIsCollapsed(false);
        localStorage.setItem(STORAGE_KEY_PREFIX + cardId, 'false');
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    // Update prevError tracking in next tick
    if (error !== prevError) {
      const timeoutId = setTimeout(() => {
        setPrevError(error);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [error, prevError, isCollapsed, cardId]);

  // Handle auto-collapse when becoming authenticated (if no stored preference)
  useEffect(() => {
    if (autoCollapse && authState === 'authenticated' && !hasAutoCollapsed && !error) {
      const stored = localStorage.getItem(STORAGE_KEY_PREFIX + cardId);
      // Only auto-collapse if no stored preference
      if (stored === null) {
        const timeoutId = setTimeout(() => {
          setIsCollapsed(true);
          setHasAutoCollapsed(true);
        }, 0);
        return () => clearTimeout(timeoutId);
      }
    }
    return undefined;
  }, [authState, autoCollapse, hasAutoCollapsed, error, cardId]);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const newValue = !prev;
      localStorage.setItem(STORAGE_KEY_PREFIX + cardId, String(newValue));
      return newValue;
    });
  }, [cardId]);

  const setCollapsed = useCallback(
    (collapsed: boolean) => {
      setIsCollapsed(collapsed);
      localStorage.setItem(STORAGE_KEY_PREFIX + cardId, String(collapsed));
    },
    [cardId]
  );

  return {
    isCollapsed,
    toggleCollapse,
    setCollapsed,
  };
}
