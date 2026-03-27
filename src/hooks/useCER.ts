import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CERResponse {
  cer: number | null;
  date: string | null;
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
    staleTime: 5 * 60_000, // 5 min
    refetchInterval: 10 * 60_000, // 10 min
  });
}
