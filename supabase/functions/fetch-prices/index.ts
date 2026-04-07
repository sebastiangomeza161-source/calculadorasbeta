import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BASE_TICKERS = new Set([
  'S17A6','S30A6','S15Y6','S29Y6','T30J6','S31L6','S31G6','S30S6','S30O6','S30N6','T15E7','T30A7','T31Y7','T30J7',
  'X15Y6','X29Y6','TZX26','X31L6','X30S6','TZXO6','X30N6','TZXD6','TZXM7','TZXA7','TZXY7','TZX27','TZXD7','TZX28',
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if this is a lookup request for a specific ticker
    let lookupTicker: string | null = null;
    let extraTickers: string[] = [];
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        lookupTicker = body.lookupTicker || null;
        extraTickers = body.extraTickers || [];
      } catch { /* no body */ }
    }

    const ALL_TICKERS = new Set([...BASE_TICKERS, ...extraTickers]);
    if (lookupTicker) ALL_TICKERS.add(lookupTicker);

    // Fetch from data912
    const [notesRes, bondsRes] = await Promise.all([
      fetch('https://data912.com/live/arg_notes'),
      fetch('https://data912.com/live/arg_bonds'),
    ]);

    if (!notesRes.ok || !bondsRes.ok) {
      throw new Error(`data912 error: notes=${notesRes.status}, bonds=${bondsRes.status}`);
    }

    const [notes, bonds] = await Promise.all([notesRes.json(), bondsRes.json()]);
    const allData = [...notes, ...bonds];

    const prices: Record<string, { price: number; bid: number; ask: number; maturity_date?: string }> = {};
    for (const item of allData) {
      if (ALL_TICKERS.has(item.symbol)) {
        prices[item.symbol] = {
          price: item.c || 0,
          bid: item.px_bid || 0,
          ask: item.px_ask || 0,
          maturity_date: item.maturity_date || undefined,
        };
      }
    }

    // Argentina timezone date
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

    // Last business day
    const todayDate = new Date(today + 'T12:00:00');
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    if (yesterdayDate.getDay() === 0) yesterdayDate.setDate(yesterdayDate.getDate() - 2);
    if (yesterdayDate.getDay() === 6) yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split('T')[0];

    // Fetch yesterday's prices
    const { data: yesterdayPrices } = await supabase
      .from('daily_prices')
      .select('ticker, price')
      .eq('recorded_date', yesterday);

    const yesterdayMap: Record<string, number> = {};
    if (yesterdayPrices) {
      for (const row of yesterdayPrices) {
        yesterdayMap[row.ticker] = Number(row.price);
      }
    }

    // Variation = (current / yesterday - 1) * 100
    const result: Record<string, { price: number; bid: number; ask: number; change: number | null; maturity_date?: string }> = {};
    for (const [ticker, d] of Object.entries(prices)) {
      const change = (yesterdayMap[ticker] && yesterdayMap[ticker] > 0 && d.price > 0)
        ? ((d.price / yesterdayMap[ticker]) - 1) * 100
        : null;
      result[ticker] = { ...d, change };
    }

    // Upsert today's prices (only base tickers)
    const rows = Object.entries(prices)
      .filter(([t, d]) => d.price > 0 && BASE_TICKERS.has(t))
      .map(([ticker, d]) => ({
        ticker,
        price: d.price,
        bid: d.bid,
        ask: d.ask,
        recorded_date: today,
      }));

    if (rows.length > 0) {
      await supabase.from('daily_prices').upsert(rows, { onConflict: 'ticker,recorded_date' });
    }

    return new Response(JSON.stringify({ prices: result, timestamp: new Date().toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
