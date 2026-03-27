import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// CER = Variable ID 27 in BCRA API
const CER_VARIABLE_ID = 30;

async function fetchFromBCRA(): Promise<{ value: number; date: string } | null> {
  const today = new Date();
  const desde = new Date(today);
  desde.setDate(desde.getDate() - 10); // Look back 10 days to account for weekends/holidays

  const desdeStr = desde.toISOString().split('T')[0];
  const hastaStr = today.toISOString().split('T')[0];

  // Try multiple API versions/paths
  const urls = [
    `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/${CER_VARIABLE_ID}?desde=${desdeStr}&hasta=${hastaStr}`,
    `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/${CER_VARIABLE_ID}`,
    `https://api.bcra.gob.ar/estadisticas/v3.0/DatosVariable/${CER_VARIABLE_ID}/${desdeStr}/${hastaStr}`,
  ];

  for (const url of urls) {
    try {
      console.log(`Trying BCRA URL: ${url}`);
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });

      if (!res.ok) {
        const body = await res.text();
        console.log(`BCRA returned ${res.status}: ${body}`);
        continue;
      }

      const data = await res.json();
      const results = data?.results;

      if (Array.isArray(results) && results.length > 0) {
        // Get the most recent value
        const latest = results[results.length - 1];
        return {
          value: parseFloat(latest.valor || latest.value),
          date: latest.fecha || latest.date,
        };
      }
    } catch (err) {
      console.error(`Error with ${url}:`, err.message);
    }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try fetching from BCRA API
    const bcraResult = await fetchFromBCRA();

    if (bcraResult && bcraResult.value > 0) {
      // Store in database for caching
      await supabase.from('cer_values').upsert(
        { date: bcraResult.date, value: bcraResult.value, source: 'bcra_api' },
        { onConflict: 'date' }
      );

      return new Response(JSON.stringify({
        cer: bcraResult.value,
        date: bcraResult.date,
        source: 'bcra_api',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback: get latest cached value from database
    const { data: cached } = await supabase
      .from('cer_values')
      .select('value, date, source')
      .order('date', { ascending: false })
      .limit(1)
      .single();

    if (cached) {
      return new Response(JSON.stringify({
        cer: Number(cached.value),
        date: cached.date,
        source: `cached_${cached.source}`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // No data available
    return new Response(JSON.stringify({
      cer: null,
      date: null,
      source: 'unavailable',
      error: 'No se pudo obtener el CER desde BCRA ni desde cache.',
    }), {
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
