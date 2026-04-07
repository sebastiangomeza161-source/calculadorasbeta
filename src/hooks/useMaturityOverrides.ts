import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MaturityOverride {
  ticker: string;
  maturity_date: string;
}

export function useMaturityOverrides() {
  const queryClient = useQueryClient();

  const { data: overrides = {} } = useQuery<Record<string, string>>({
    queryKey: ['maturity-overrides'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maturity_overrides')
        .select('ticker, maturity_date');
      if (error) throw error;
      const map: Record<string, string> = {};
      (data as MaturityOverride[]).forEach(r => { map[r.ticker] = r.maturity_date; });
      return map;
    },
    staleTime: 60_000,
  });

  const saveOverride = useMutation({
    mutationFn: async ({ ticker, maturityDate }: { ticker: string; maturityDate: string }) => {
      const { error } = await supabase
        .from('maturity_overrides')
        .upsert({ ticker, maturity_date: maturityDate, updated_at: new Date().toISOString() }, { onConflict: 'ticker' });
      if (error) throw error;
      return { ticker, maturityDate };
    },
    onMutate: async ({ ticker, maturityDate }) => {
      await queryClient.cancelQueries({ queryKey: ['maturity-overrides'] });
      const previous = queryClient.getQueryData<Record<string, string>>(['maturity-overrides']);
      queryClient.setQueryData<Record<string, string>>(['maturity-overrides'], old => ({
        ...old,
        [ticker]: maturityDate,
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['maturity-overrides'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['maturity-overrides'] });
    },
  });

  const getEffectiveMaturity = (ticker: string, originalDate: string): string => {
    return overrides[ticker] || originalDate;
  };

  return { overrides, getEffectiveMaturity, saveOverride };
}
