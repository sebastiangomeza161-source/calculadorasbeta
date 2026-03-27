import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// CER = Variable ID 30 in BCRA API v4
const CER_VARIABLE_ID = 30;

async function fetchFromBCRA(): Promise<{ value: number; date: string } | null> {
  // Strategy 1: Get from the list endpoint (always works) - CER is in the main list
  try {
    console.log('Trying BCRA list endpoint...');
    const res = await fetch('https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = await res.json();
      const results = data?.results;
      if (Array.isArray(results)) {
        const cerEntry = results.find((r: any) => r.idVariable === CER_VARIABLE_ID);
        if (cerEntry && cerEntry.valor != null) {
          console.log(`Found CER from list: ${cerEntry.valor} (${cerEntry.fecha})`);
          return {
            value: parseFloat(String(cerEntry.valor)),
            date: cerEntry.fecha,
          };
        }
      }
    } else {
      const body = await res.text();
      console.log(`List endpoint returned ${res.status}: ${body}`);
    }
  } catch (err) {
    console.error('List endpoint error:', err.message);
  }

  // Strategy 2: Try detail endpoint with date range
  try {
    const today = new Date();
    const desde = new Date(today);
    desde.setDate(desde.getDate() - 10);
    const desdeStr = desde.toISOString().split('T')[0];
    const hastaStr = today.toISOString().split('T')[0];

    const url = `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/${CER_VARIABLE_ID}?Desde=${desdeStr}&Hasta=${hastaStr}`;
    console.log(`Trying detail endpoint: ${url}`);

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = await res.json();
      const results = data?.results;
      if (Array.isArray(results) && results.length > 0) {
        const latest = results[results.length - 1];
        return {
          value: parseFloat(String(latest.valor)),
          date: latest.fecha,
        };
      }
    } else {
      const body = await res.text();
      console.log(`Detail endpoint returned ${res.status}: ${body}`);
    }
  } catch (err) {
    console.error('Detail endpoint error:', err.message);
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

    const bcraResult = await fetchFromBCRA();

    if (bcraResult && bcraResult.value > 0) {
      // Cache in database
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

    // Fallback: cached value
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
