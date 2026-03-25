const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const [notesRes, bondsRes] = await Promise.all([
      fetch('https://data912.com/live/arg_notes'),
      fetch('https://data912.com/live/arg_bonds'),
    ]);

    if (!notesRes.ok || !bondsRes.ok) {
      throw new Error(`data912 API error: notes=${notesRes.status}, bonds=${bondsRes.status}`);
    }

    const [notes, bonds] = await Promise.all([
      notesRes.json(),
      bondsRes.json(),
    ]);

    const allData = [...notes, ...bonds];
    const tickers = new Set([
      'S17A6','S30A6','S15Y6','S29Y6','T30J6','S31L6','S31G6','S30S6','S30O6','S30N6','T15E7',
      'X15Y6','X29Y6','TZX26','X31L6','X30S6','TZXO6','X30N6','TZXD6','TZXM7','TZXA7','TZXY7','TZX27','TZXD7','TZX28',
    ]);

    const prices: Record<string, { price: number; bid: number; ask: number; change: number }> = {};

    for (const item of allData) {
      if (tickers.has(item.symbol)) {
        prices[item.symbol] = {
          price: item.c || 0,
          bid: item.px_bid || 0,
          ask: item.px_ask || 0,
          change: item.pct_change || 0,
        };
      }
    }

    return new Response(JSON.stringify({ prices, timestamp: new Date().toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching prices:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
