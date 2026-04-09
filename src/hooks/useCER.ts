import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CERResponse {
  cer: number | null;           // CER at (settlement - 10 business days)
  cerDate: string | null;       // Date of that CER
  settlementDate: string | null; // Settlement date used (today + 1 biz day)
  latestCer: number | null;     // Latest CER available from BCRA
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
