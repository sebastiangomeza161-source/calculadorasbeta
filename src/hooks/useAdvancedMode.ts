import { useState, useCallback } from 'react';

const ADVANCED_PASSWORD = 'Research';

export function useAdvancedMode() {
  const [isAdvanced, setIsAdvanced] = useState(false);

  const activate = useCallback((password: string): boolean => {
    if (password === ADVANCED_PASSWORD) {
      setIsAdvanced(true);
      return true;
    }
    return false;
  }, []);

  const deactivate = useCallback(() => setIsAdvanced(false), []);

  return { isAdvanced, activate, deactivate };
}
