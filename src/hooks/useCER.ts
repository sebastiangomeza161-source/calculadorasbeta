import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CERResponse {
  cer: number | null;       // CER con rezago de 10 días hábiles (para cálculos)
  cerDate: string | null;   // Fecha efectiva del CER usado
  latestCer: number | null; // CER más reciente disponible
  latestDate: string | null;
  lagDays: number;
  source: string;
  error?: string;
}

export function useCER() {
  return useQuery<CERResponse>({
    queryKey: ['cer-value'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-cer');
      if (error) throw error;
      return data as CERResponse;
    },
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
}
