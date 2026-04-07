import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PriceData {
  price: number;
  bid: number;
  ask: number;
  change: number | null;
  maturity_date?: string;
}

interface PricesResponse {
  prices: Record<string, PriceData>;
  timestamp: string;
}

export function useLivePrices(extraTickers: string[] = []) {
  return useQuery<PricesResponse>({
    queryKey: ['live-prices', extraTickers],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-prices', {
        body: extraTickers.length > 0 ? { extraTickers } : undefined,
      });
      if (error) throw error;
      return data as PricesResponse;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
