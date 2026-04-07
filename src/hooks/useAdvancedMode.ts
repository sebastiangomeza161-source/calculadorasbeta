import { useState, useCallback, useSyncExternalStore } from 'react';

const ADVANCED_PASSWORD = 'Research';

// Shared state across all hook instances
let _isAdvanced = false;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return _isAdvanced;
}

function setAdvanced(val: boolean) {
  _isAdvanced = val;
  listeners.forEach(cb => cb());
}

export function useAdvancedMode() {
  const isAdvanced = useSyncExternalStore(subscribe, getSnapshot);

  const activate = useCallback((password: string): boolean => {
    if (password === ADVANCED_PASSWORD) {
      setAdvanced(true);
      return true;
    }
    return false;
  }, []);

  const deactivate = useCallback(() => setAdvanced(false), []);

  return { isAdvanced, activate, deactivate };
}
