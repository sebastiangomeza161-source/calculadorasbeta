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

