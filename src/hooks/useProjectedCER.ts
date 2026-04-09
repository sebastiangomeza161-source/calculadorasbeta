import { useMemo } from 'react';
import { CER_INSTRUMENTS } from '@/data/instruments';
import { useLivePrices } from '@/hooks/useLivePrices';
import { useCER } from '@/hooks/useCER';
import { useCustomInstruments } from '@/hooks/useCustomInstruments';
import { useMaturityOverrides } from '@/hooks/useMaturityOverrides';
import { useHolidays } from '@/hooks/useHolidays';
import { daysUntil, getSettlementDate } from '@/lib/calculations';

// ─── Types ───

export interface InflationEntry {
  year: number;
  month: number;
  label: string;
  rate: number;
}

interface CERProjectionRow {
  date: Date;
  dateStr: string;
  cer: number;
  isOfficial: boolean;
  inflationRate: number | null;
  tramoDays: number | null;
  dailyPace: number | null;
  prevCER: number | null;
  tramoLabel: string | null;
}

interface ProjectedRow {
  ticker: string;
  duration: number;
  tna180Proj: number | null;
}

// ─── Helpers ───

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export function getDefaultInflation(): InflationEntry[] {
  const today = new Date();
  const entries: InflationEntry[] = [];
  for (let i = -2; i < 24; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    entries.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
      rate: 0.025,
    });
  }
  return entries;
}

export function readInflationFromStorage(): InflationEntry[] {
  try {
    const saved = localStorage.getItem('experimental_inflation');
    if (saved) {
      const parsed = JSON.parse(saved) as InflationEntry[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return getDefaultInflation();
}

function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function days360(start: Date, end: Date): number {
  let d1 = start.getDate();
  let d2 = end.getDate();
  const m1 = start.getMonth();
  const m2 = end.getMonth();
  const y1 = start.getFullYear();
  const y2 = end.getFullYear();
  if (d1 === 31) d1 = 30;
  if (d2 === 31 && d1 >= 30) d2 = 30;
  const lastDayFeb1 = new Date(y1, m1 + 1, 0).getDate();
  if (m1 === 1 && d1 === lastDayFeb1) {
    d1 = 30;
    const lastDayFeb2 = new Date(y2, m2 + 1, 0).getDate();
    if (m2 === 1 && d2 === lastDayFeb2) d2 = 30;
  }
  return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
}

function subtractBusinessDays(date: Date, n: number, holidaySet?: Set<string>): Date {
  const result = new Date(date);
  let count = 0;
  while (count < n) {
    result.setDate(result.getDate() - 1);
    const dow = result.getDay();
    if (dow === 0 || dow === 6) continue;
    if (holidaySet) {
      const iso = `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`;
      if (holidaySet.has(iso)) continue;
    }
    count++;
  }
  return result;
}

function getInflationMonthForDate(d: Date): { year: number; month: number } {
  const day = d.getDate();
  if (day >= 16) {
    const inf = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return { year: inf.getFullYear(), month: inf.getMonth() };
  } else {
    const inf = new Date(d.getFullYear(), d.getMonth() - 2, 1);
    return { year: inf.getFullYear(), month: inf.getMonth() };
  }
}

function getTramoForMonth(year: number, month: number): { start: Date; end: Date; days: number } {
  const start = new Date(year, month + 1, 16);
  const end = new Date(year, month + 2, 15);
  const diffMs = end.getTime() - start.getTime();
  const days = Math.round(diffMs / 86400000) + 1;
  return { start, end, days };
}

function projectCER(
  lastOfficialCER: number,
  lastOfficialDate: Date,
  inflation: InflationEntry[],
  endDate: Date
): CERProjectionRow[] {
  const rows: CERProjectionRow[] = [];
  rows.push({
    date: new Date(lastOfficialDate),
    dateStr: formatDateISO(lastOfficialDate),
    cer: lastOfficialCER,
    isOfficial: true,
    inflationRate: null, tramoDays: null, dailyPace: null, prevCER: null, tramoLabel: null,
  });

  const inflationLookup: Record<string, number> = {};
  const sortedInflation = [...inflation].sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
  const lastAvailableRate = sortedInflation.length > 0 ? sortedInflation[sortedInflation.length - 1].rate : 0.025;
  for (const entry of sortedInflation) {
    const key = `${entry.year}-${String(entry.month).padStart(2, '0')}`;
    inflationLookup[key] = entry.rate;
  }

  function findInflationRate(year: number, month: number): number {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (inflationLookup[key] !== undefined) return inflationLookup[key];
    let best = lastAvailableRate;
    for (const entry of sortedInflation) {
      if (entry.year < year || (entry.year === year && entry.month <= month)) {
        best = entry.rate;
      }
    }
    return best;
  }

  const dailyPaceCache: Record<string, { pace: number; rate: number; days: number }> = {};
  function getDailyPaceInfo(year: number, month: number) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (dailyPaceCache[key]) return dailyPaceCache[key];
    const rate = findInflationRate(year, month);
    const tramo = getTramoForMonth(year, month);
    const pace = Math.pow(1 + rate, 1 / tramo.days) - 1;
    dailyPaceCache[key] = { pace, rate, days: tramo.days };
    return dailyPaceCache[key];
  }

  let currentDate = new Date(lastOfficialDate);
  let currentCER = lastOfficialCER;

  while (currentDate < endDate) {
    const prevCER = currentCER;
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1);
    if (currentDate > endDate) break;

    const infMonth = getInflationMonthForDate(currentDate);
    const info = getDailyPaceInfo(infMonth.year, infMonth.month);

    currentCER = prevCER * (1 + info.pace);
    const MONTH_NAMES_LOCAL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    rows.push({
      date: new Date(currentDate),
      dateStr: formatDateISO(currentDate),
      cer: currentCER,
      isOfficial: false,
      inflationRate: info.rate,
      tramoDays: info.days,
      dailyPace: info.pace,
      prevCER: prevCER,
      tramoLabel: `${MONTH_NAMES_LOCAL[infMonth.month]} ${infMonth.year}`,
    });
  }

  return rows;
}

// ─── Hook ───

export interface ProjectedCurvePoint {
  ticker: string;
  duration: number;
  yield: number;
}

export function useProjectedCER() {
  const { getEffectiveMaturity } = useMaturityOverrides();
  const { holidayDatesSet } = useHolidays();
  const { custom } = useCustomInstruments();
  const customTickers = custom.map(i => i.ticker);
  const { data: livePrices } = useLivePrices(customTickers);
  const { data: cerData } = useCER();

  const inflation = useMemo(() => readInflationFromStorage(), []);

  const lastOfficialCER = cerData?.latestCer ?? cerData?.cer ?? null;
  const lastOfficialDate = cerData?.latestDate ? (() => {
    const [y, m, d] = cerData.latestDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  })() : null;

  const allCer = useMemo(() => [...CER_INSTRUMENTS, ...custom.filter(i => i.type === 'CER')], [custom]);

  const cerRows = useMemo(() => {
    return allCer
      .map(inst => {
        const maturity = getEffectiveMaturity(inst.ticker, inst.maturityDate);
        const price = livePrices?.prices[inst.ticker]?.price ?? 0;
        const [my, mm, md] = maturity.split('-').map(Number);
        const matDate = new Date(my, mm - 1, md);
        const cerRelevantDate = subtractBusinessDays(matDate, 10, holidayDatesSet);
        const settlement = getSettlementDate(1, holidayDatesSet);
        const d360 = days360(settlement, matDate);
        const duration = d360 / 360;
        const days = daysUntil(maturity, 1, holidayDatesSet);
        return { ...inst, maturityDate: maturity, price, matDate, cerRelevantDate, days, d360, duration };
      })
      .filter(r => r.days > 0)
      .sort((a, b) => a.days - b.days);
  }, [allCer, livePrices, getEffectiveMaturity, holidayDatesSet]);

  const maxCerDate = useMemo(() => {
    return cerRows.reduce((max, r) => (r.cerRelevantDate > max ? r.cerRelevantDate : max), new Date());
  }, [cerRows]);

  const cerProjection = useMemo(() => {
    if (!lastOfficialCER || !lastOfficialDate) return [];
    return projectCER(lastOfficialCER, lastOfficialDate, inflation, maxCerDate);
  }, [lastOfficialCER, lastOfficialDate, inflation, maxCerDate]);

  const cerLookup = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of cerProjection) map[row.dateStr] = row.cer;
    return map;
  }, [cerProjection]);

  const curvePoints = useMemo<ProjectedCurvePoint[]>(() => {
    return cerRows
      .map(inst => {
        const cerDateStr = formatDateISO(inst.cerRelevantDate);
        const projectedCER = cerLookup[cerDateStr] ?? null;
        const cerInicial = inst.cerInicial ?? null;
        if (!projectedCER || !cerInicial || inst.price <= 0) return null;
        const ratio = (100 * projectedCER / cerInicial) / inst.price;
        const tna180 = inst.d360 > 0 ? (Math.pow(ratio, 180 / inst.d360) - 1) * 2 * 100 : 0;
        return { ticker: inst.ticker, duration: inst.duration, yield: tna180 };
      })
      .filter((r): r is ProjectedCurvePoint => r !== null);
  }, [cerRows, cerLookup]);

  return { curvePoints, inflation };
}
