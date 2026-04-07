import { useState, useCallback, useEffect } from 'react';

const ADVANCED_PASSWORD = 'Research';

// Simple event-based shared state
let _isAdvanced = false;
const listeners = new Set<(v: boolean) => void>();

function notify() {
  listeners.forEach(cb => cb(_isAdvanced));
}

export function useAdvancedMode() {
  const [isAdvanced, setIsAdvanced] = useState(_isAdvanced);

  useEffect(() => {
    const handler = (v: boolean) => setIsAdvanced(v);
    listeners.add(handler);
    // Sync on mount in case state changed
    setIsAdvanced(_isAdvanced);
    return () => { listeners.delete(handler); };
  }, []);

  const activate = useCallback((password: string): boolean => {
    if (password === ADVANCED_PASSWORD) {
      _isAdvanced = true;
      notify();
      return true;
    }
    return false;
  }, []);

  const deactivate = useCallback(() => {
    _isAdvanced = false;
    notify();
  }, []);

  return { isAdvanced, activate, deactivate };
}
