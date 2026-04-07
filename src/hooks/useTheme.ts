import { useState, useEffect } from 'react';

type Theme = 'night' | 'day';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('rf-theme') as Theme) || 'night';
    }
    return 'night';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'day') {
      root.classList.add('theme-day');
    } else {
      root.classList.remove('theme-day');
    }
    localStorage.setItem('rf-theme', theme);
  }, [theme]);

  const toggle = () => setTheme(t => (t === 'night' ? 'day' : 'night'));

  return { theme, toggle };
}
