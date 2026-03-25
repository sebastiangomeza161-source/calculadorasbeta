import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PriceData {
  price: number;
  bid: number;
  ask: number;
  change: number | null;
}

interface PricesResponse {
  prices: Record<string, PriceData>;
  timestamp: string;
}

export function useLivePrices() {
  return useQuery<PricesResponse>({
    queryKey: ['live-prices'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-prices');
      if (error) throw error;
      return data as PricesResponse;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
