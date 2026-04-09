import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export interface InflationEntry {
  year: number;
  month: number;
  label: string;
  rate: number;
}

function getDefaultInflation(): InflationEntry[] {
  const today = new Date();
  const entries: InflationEntry[] = [];
  for (let i = -2; i < 24; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    entries.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
      rate: 0.025,
    });
  }
  return entries;
}

export function useInflationInputs() {
  const [inflation, setInflationState] = useState<InflationEntry[]>(getDefaultInflation);
  const [loading, setLoading] = useState(true);

  // Load from DB on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('inflation_inputs')
        .select('year, month, label, rate')
        .order('year', { ascending: true })
        .order('month', { ascending: true });

      if (cancelled) return;

      if (data && data.length > 0) {
        const defaults = getDefaultInflation();
        const dbLookup: Record<string, { rate: number; label: string }> = {};
        for (const row of data) {
          dbLookup[`${row.year}-${row.month}`] = { rate: Number(row.rate), label: row.label };
        }
        // Merge: use DB values where available, defaults for the rest
        const merged = defaults.map(d => {
          const key = `${d.year}-${d.month}`;
          if (dbLookup[key]) {
            return { ...d, rate: dbLookup[key].rate, label: dbLookup[key].label || d.label };
          }
          return d;
        });
        // Also add any DB entries not in defaults range
        for (const row of data) {
          const key = `${row.year}-${row.month}`;
          if (!merged.find(m => `${m.year}-${m.month}` === key)) {
            merged.push({
              year: row.year,
              month: row.month,
              label: row.label || `${MONTH_NAMES[row.month]} ${row.year}`,
              rate: Number(row.rate),
            });
          }
        }
        merged.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
        setInflationState(merged);
      }
      // Also migrate from localStorage if DB was empty
      else {
        try {
          const saved = localStorage.getItem('experimental_inflation');
          if (saved) {
            const parsed = JSON.parse(saved) as InflationEntry[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              setInflationState(parsed);
              // Save to DB
              const rows = parsed.map(e => ({
                year: e.year,
                month: e.month,
                label: e.label,
                rate: e.rate,
              }));
              await supabase.from('inflation_inputs').upsert(rows, { onConflict: 'year,month' });
            }
          }
        } catch { /* ignore */ }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const setInflation = useCallback((updater: InflationEntry[] | ((prev: InflationEntry[]) => InflationEntry[])) => {
    setInflationState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Persist to DB (fire and forget)
      const rows = next.map(e => ({
        year: e.year,
        month: e.month,
        label: e.label,
        rate: e.rate,
      }));
      supabase.from('inflation_inputs').upsert(rows, { onConflict: 'year,month' }).then();
      // Also keep localStorage as backup
      localStorage.setItem('experimental_inflation', JSON.stringify(next));
      return next;
    });
  }, []);

  return { inflation, setInflation, loading };
}
