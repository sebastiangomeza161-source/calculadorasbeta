import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CER_XLS_URL = 'https://www.bcra.gob.ar/Pdfs/PublicacionesEstadisticas/diar_cer.xls';

// Argentina public holidays 2025-2028 (approximate, extend as needed)
const HOLIDAYS = new Set([
  '2025-01-01','2025-02-24','2025-03-03','2025-03-24','2025-04-02','2025-04-18',
  '2025-05-01','2025-05-26','2025-06-16','2025-06-20','2025-07-09','2025-08-18',
  '2025-10-13','2025-11-17','2025-12-08','2025-12-25',
  '2026-01-01','2026-02-16','2026-02-17','2026-03-24','2026-04-02','2026-04-03',
  '2026-05-01','2026-05-25','2026-06-15','2026-06-20','2026-07-09','2026-08-17',
  '2026-10-12','2026-11-23','2026-12-08','2026-12-25',
]);

function isBusinessDay(d: Date): boolean {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  const iso = d.toISOString().split('T')[0];
  return !HOLIDAYS.has(iso);
}

function subtractBusinessDays(from: Date, n: number): Date {
  const d = new Date(from);
  let subtracted = 0;
  while (subtracted < n) {
    d.setDate(d.getDate() - 1);
    if (isBusinessDay(d)) subtracted++;
  }
  return d;
}

interface CERRow {
  date: string;
  value: number;
}

async function fetchAllCERFromBCRA(): Promise<CERRow[]> {
  try {
    console.log('Downloading CER XLS from BCRA...');
    const res = await fetch(CER_XLS_URL, {
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });

    if (!res.ok) {
      console.log(`BCRA XLS download failed: ${res.status}`);
      return [];
    }

    const buffer = await res.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const rows: CERRow[] = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 2) continue;
      const rawDate = row[0];
      const rawValue = row[1];
      if (rawValue == null || rawValue === '') continue;

      let dateStr: string;
      if (typeof rawDate === 'number') {
        const d = XLSX.SSF.parse_date_code(rawDate);
        dateStr = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      } else if (typeof rawDate === 'string') {
        const parts = rawDate.split('/');
        if (parts.length === 3) {
          dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        } else continue;
      } else continue;

      rows.push({ date: dateStr, value: parseFloat(String(rawValue)) });
    }

    return rows;
  } catch (err) {
    console.error('Error fetching CER XLS:', err.message);
    return [];
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

    // Calculate the target date: today minus 10 business days
    const today = new Date();
    const laggedDate = subtractBusinessDays(today, 10);
    const laggedDateStr = laggedDate.toISOString().split('T')[0];
    console.log(`Target CER date (T-10 biz days): ${laggedDateStr}`);

    // Also get the latest CER for display
    const allRows = await fetchAllCERFromBCRA();

    if (allRows.length > 0) {
      // Cache latest values in DB
      const latestRow = allRows[allRows.length - 1];
      await supabase.from('cer_values').upsert(
        { date: latestRow.date, value: latestRow.value, source: 'bcra_xls' },
        { onConflict: 'date' }
      );

      // Find the CER value for the lagged date (exact or closest prior)
      let laggedCER: CERRow | null = null;
      let latestCER: CERRow | null = latestRow;
      for (let i = allRows.length - 1; i >= 0; i--) {
        if (allRows[i].date <= laggedDateStr) {
          laggedCER = allRows[i];
          break;
        }
      }

      return new Response(JSON.stringify({
        cer: laggedCER?.value ?? latestRow.value,
        cerDate: laggedCER?.date ?? latestRow.date,
        latestCer: latestRow.value,
        latestDate: latestRow.date,
        lagDays: 10,
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
        cerDate: cached.date,
        latestCer: Number(cached.value),
        latestDate: cached.date,
        lagDays: 10,
        source: 'cached',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      cer: null,
      cerDate: null,
      latestCer: null,
      latestDate: null,
      lagDays: 10,
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
