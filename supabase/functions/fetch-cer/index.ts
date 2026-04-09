import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CER_XLS_URL = 'https://www.bcra.gob.ar/Pdfs/PublicacionesEstadisticas/diar_cer.xls';

function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isBusinessDay(d: Date, holidaySet: Set<string>): boolean {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  return !holidaySet.has(dateToISO(d));
}

function addBusinessDays(from: Date, n: number, holidaySet: Set<string>): Date {
  const d = new Date(from);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d, holidaySet)) added++;
  }
  return d;
}

function subtractBusinessDays(from: Date, n: number, holidaySet: Set<string>): Date {
  const d = new Date(from);
  let subtracted = 0;
  while (subtracted < n) {
    d.setDate(d.getDate() - 1);
    if (isBusinessDay(d, holidaySet)) subtracted++;
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

function findCERForDate(rows: CERRow[], targetDate: string): CERRow | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].date <= targetDate) return rows[i];
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

    // Fetch holidays from database
    const { data: holidayRows } = await supabase
      .from('holidays')
      .select('date');
    const holidaySet = new Set<string>(
      (holidayRows ?? []).map((r: { date: string }) => r.date)
    );
    console.log(`Loaded ${holidaySet.size} holidays from DB`);

    // Today in Argentina timezone
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
    const todayDate = new Date(todayStr + 'T12:00:00');

    // Settlement = today + 1 business day
    const settlementDate = addBusinessDays(todayDate, 1, holidaySet);
    const settlementDateStr = dateToISO(settlementDate);

    // CER for calculations = settlement - 10 business days
    const cerDate = subtractBusinessDays(settlementDate, 10, holidaySet);
    const cerDateStr = dateToISO(cerDate);

    console.log(`Today: ${todayStr}, Settlement (T+1): ${settlementDateStr}, CER date (Sett-10): ${cerDateStr}`);

    const allRows = await fetchAllCERFromBCRA();

    if (allRows.length > 0) {
      const latestRow = allRows[allRows.length - 1];

      // Cache latest value in DB
      await supabase.from('cer_values').upsert(
        { date: latestRow.date, value: latestRow.value, source: 'bcra_xls' },
        { onConflict: 'date' }
      );

      // CER for settlement - 10 (for current market calculations)
      const cerForCalc = findCERForDate(allRows, cerDateStr);

      console.log(`CER for calc: ${cerForCalc?.value} (${cerForCalc?.date}), Latest: ${latestRow.value} (${latestRow.date})`);

      return new Response(JSON.stringify({
        cer: cerForCalc?.value ?? latestRow.value,
        cerDate: cerForCalc?.date ?? latestRow.date,
        settlementDate: settlementDateStr,
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
        settlementDate: settlementDateStr,
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
      settlementDate: settlementDateStr,
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
