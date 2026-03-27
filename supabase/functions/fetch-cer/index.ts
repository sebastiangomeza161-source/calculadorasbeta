import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CER_XLS_URL = 'https://www.bcra.gob.ar/Pdfs/PublicacionesEstadisticas/diar_cer.xls';

async function fetchCERFromBCRA(): Promise<{ value: number; date: string } | null> {
  try {
    console.log('Downloading CER XLS from BCRA...');
    const res = await fetch(CER_XLS_URL, {
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });

    if (!res.ok) {
      console.log(`BCRA XLS download failed: ${res.status}`);
      return null;
    }

    const buffer = await res.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Find the most recent row with today's date or earlier
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let latestValue: number | null = null;
    let latestDate: string | null = null;

    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      if (!row || row.length < 2) continue;

      const rawDate = row[0];
      const rawValue = row[1];

      if (rawValue == null || rawValue === '') continue;

      let dateStr: string;
      if (typeof rawDate === 'number') {
        // Excel serial date
        const d = XLSX.SSF.parse_date_code(rawDate);
        dateStr = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      } else if (typeof rawDate === 'string') {
        // DD/MM/YYYY format
        const parts = rawDate.split('/');
        if (parts.length === 3) {
          dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        } else {
          continue;
        }
      } else {
        continue;
      }

      const parsedDate = new Date(dateStr + 'T12:00:00');
      if (parsedDate <= today) {
        latestValue = parseFloat(String(rawValue));
        latestDate = dateStr;
        break;
      }
    }

    if (latestValue && latestDate) {
      console.log(`CER from BCRA XLS: ${latestValue} (${latestDate})`);
      return { value: latestValue, date: latestDate };
    }

    console.log('No valid CER data found in XLS');
    return null;
  } catch (err) {
    console.error('Error fetching CER XLS:', err.message);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const bcraResult = await fetchCERFromBCRA();

    if (bcraResult && bcraResult.value > 0) {
      // Cache in database
      await supabase.from('cer_values').upsert(
        { date: bcraResult.date, value: bcraResult.value, source: 'bcra_xls' },
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

    // Fallback: cached value from database
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
        source: `cached`,
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
