import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const [notesRes, bondsRes] = await Promise.all([
      fetch('https://data912.com/live/arg_notes'),
      fetch('https://data912.com/live/arg_bonds'),
    ]);

    if (!notesRes.ok || !bondsRes.ok) {
      throw new Error(`data912 API error: notes=${notesRes.status}, bonds=${bondsRes.status}`);
    }

    const [notes, bonds] = await Promise.all([notesRes.json(), bondsRes.json()]);

    const allData = [...notes, ...bonds];
    const tickers = new Set([
      'S17A6','S30A6','S15Y6','S29Y6','T30J6','S31L6','S31G6','S30S6','S30O6','S30N6','T15E7',
      'X15Y6','X29Y6','TZX26','X31L6','X30S6','TZXO6','X30N6','TZXD6','TZXM7','TZXA7','TZXY7','TZX27','TZXD7','TZX28',
    ]);

    const prices: Record<string, { price: number; bid: number; ask: number }> = {};
    for (const item of allData) {
      if (tickers.has(item.symbol)) {
        prices[item.symbol] = {
          price: item.c || 0,
          bid: item.px_bid || 0,
          ask: item.px_ask || 0,
        };
      }
    }

    // Get today's date in Argentina timezone
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

    // Get yesterday's date (last business day)
    const todayDate = new Date(today + 'T12:00:00');
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    // Skip weekends
    if (yesterdayDate.getDay() === 0) yesterdayDate.setDate(yesterdayDate.getDate() - 2);
    if (yesterdayDate.getDay() === 6) yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split('T')[0];

    // Fetch yesterday's prices from DB
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

    // Calculate variation: (current / yesterday - 1) * 100
    const variations: Record<string, number> = {};
    for (const [ticker, data] of Object.entries(prices)) {
      if (yesterdayMap[ticker] && yesterdayMap[ticker] > 0 && data.price > 0) {
        variations[ticker] = ((data.price / yesterdayMap[ticker]) - 1) * 100;
      }
    }

    // Upsert today's prices
    const rows = Object.entries(prices)
      .filter(([, d]) => d.price > 0)
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

    const result: Record<string, { price: number; bid: number; ask: number; change: number | null }> = {};
    for (const [ticker, d] of Object.entries(prices)) {
      result[ticker] = {
        ...d,
        change: variations[ticker] ?? null,
      };
    }

    return new Response(JSON.stringify({ prices: result, timestamp: new Date().toISOString() }), {
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
