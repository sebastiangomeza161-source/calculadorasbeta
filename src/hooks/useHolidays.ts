import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  label: string;
}

export function useHolidays() {
  const queryClient = useQueryClient();

  const { data: holidays = [], isLoading } = useQuery<Holiday[]>({
    queryKey: ['holidays'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('holidays')
        .select('id, date, label')
        .order('date', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(h => ({
        id: h.id,
        date: h.date,
        label: h.label ?? '',
      }));
    },
    staleTime: 5 * 60_000,
  });

  const holidayDatesSet = new Set(holidays.map(h => h.date));

  const addHolidays = useMutation({
    mutationFn: async (entries: { date: string; label: string }[]) => {
      if (entries.length === 0) return;
      const { error } = await supabase
        .from('holidays')
        .upsert(
          entries.map(e => ({ date: e.date, label: e.label })),
          { onConflict: 'date' }
        );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holidays'] }),
  });

  const removeHoliday = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('holidays').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holidays'] }),
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      // Delete all holidays by selecting all ids
      const { data } = await supabase.from('holidays').select('id');
      if (data && data.length > 0) {
        for (const row of data) {
          await supabase.from('holidays').delete().eq('id', row.id);
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holidays'] }),
  });

  return {
    holidays,
    holidayDatesSet,
    isLoading,
    addHolidays,
    removeHoliday,
    clearAll,
  };
}

/**
 * Check if a date is a business day (not weekend, not holiday)
 */
export function isBusinessDay(date: Date, holidaySet: Set<string>): boolean {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return false;
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return !holidaySet.has(iso);
}

/**
 * Get settlement date (T+N) considering weekends and holidays
 */
export function getSettlementDateWithHolidays(tPlus: number, holidaySet: Set<string>): Date {
  const today = new Date();
  const settlement = new Date(today);
  let added = 0;
  while (added < tPlus) {
    settlement.setDate(settlement.getDate() + 1);
    if (isBusinessDay(settlement, holidaySet)) added++;
  }
  return settlement;
}

/**
 * Days until maturity from settlement (considering holidays)
 */
export function daysUntilWithHolidays(maturityDate: string, tPlus: number, holidaySet: Set<string>): number {
  const [y, m, d] = maturityDate.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const settlement = getSettlementDateWithHolidays(tPlus, holidaySet);
  const diff = target.getTime() - settlement.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Subtract N business days from a date, considering holidays
 */
export function subtractBusinessDaysWithHolidays(date: Date, n: number, holidaySet: Set<string>): Date {
  const result = new Date(date);
  let count = 0;
  while (count < n) {
    result.setDate(result.getDate() - 1);
    if (isBusinessDay(result, holidaySet)) count++;
  }
  return result;
}
