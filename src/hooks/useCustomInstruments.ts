import { useState, useCallback } from 'react';
import { Instrument } from '@/data/instruments';

const STORAGE_KEY = 'custom-instruments';

function loadFromStorage(): Instrument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(instruments: Instrument[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(instruments));
}

export function useCustomInstruments() {
  const [custom, setCustom] = useState<Instrument[]>(loadFromStorage);

  const addInstrument = useCallback((inst: Instrument) => {
    setCustom(prev => {
      const exists = prev.some(i => i.ticker === inst.ticker);
      if (exists) return prev;
      const next = [...prev, inst];
      saveToStorage(next);
      return next;
    });
  }, []);

  const removeInstrument = useCallback((ticker: string) => {
    setCustom(prev => {
      const next = prev.filter(i => i.ticker !== ticker);
      saveToStorage(next);
      return next;
    });
  }, []);

  return { custom, addInstrument, removeInstrument };
}
