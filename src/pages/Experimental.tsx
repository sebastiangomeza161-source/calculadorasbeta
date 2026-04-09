import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CER_INSTRUMENTS } from '@/data/instruments';
import { useLivePrices } from '@/hooks/useLivePrices';
import { useCER } from '@/hooks/useCER';
import { useCustomInstruments } from '@/hooks/useCustomInstruments';
import { useTheme } from '@/hooks/useTheme';
import { useMaturityOverrides } from '@/hooks/useMaturityOverrides';
import { useAdvancedMode } from '@/hooks/useAdvancedMode';
import { useHolidays } from '@/hooks/useHolidays';
import { useInflationInputs } from '@/hooks/useInflationInputs';
import { daysUntil, getSettlementDate } from '@/lib/calculations';
import { Moon, Sun, ArrowLeft, Lock, FlaskConical, Trash2, ChevronDown } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line } from 'recharts';

// ─── Helpers ───

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

function formatDateShort(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ─── Inflation table defaults ───

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

type InflationEntry = import('@/hooks/useInflationInputs').InflationEntry;

// ─── Tramo logic ───

/**
 * Given a date D, determine which inflation month drives the CER for that day.
 * Rule: inflation of month M applies from 16/(M+1) to 15/(M+2).
 * Examples:
 *   - Inflation Feb → 16/Mar to 15/Apr
 *   - Inflation Mar → 16/Apr to 15/May
 * So for a date D:
 *   - If day >= 16, tramo starts this month's 16th → inflation month = this month - 1
 *   - If day <= 15, tramo started previous month's 16th → inflation month = this month - 2
 */
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

/**
 * Get the tramo date range for an inflation month M.
 * Inflation of month M applies from 16/(M+1) to 15/(M+2).
 */
function getTramoForMonth(year: number, month: number): { start: Date; end: Date; days: number } {
  const start = new Date(year, month + 1, 16);
  const end = new Date(year, month + 2, 15);
  const diffMs = end.getTime() - start.getTime();
  const days = Math.round(diffMs / 86400000) + 1;
  return { start, end, days };
}

// ─── CER Projection (enriched for audit) ───

interface CERProjectionRow {
  date: Date;
  dateStr: string;
  cer: number;
  isOfficial: boolean;
  // Audit fields
  inflationRate: number | null;
  tramoDays: number | null;
  dailyPace: number | null;
  prevCER: number | null;
  tramoLabel: string | null;
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
    inflationRate: null,
    tramoDays: null,
    dailyPace: null,
    prevCER: null,
    tramoLabel: null,
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
    rows.push({
      date: new Date(currentDate),
      dateStr: formatDateISO(currentDate),
      cer: currentCER,
      isOfficial: false,
      inflationRate: info.rate,
      tramoDays: info.days,
      dailyPace: info.pace,
      prevCER: prevCER,
      tramoLabel: `${MONTH_NAMES[infMonth.month]} ${infMonth.year}`,
    });
  }

  return rows;
}

// ─── Logarithmic trend line ───
function calcLogTrend(points: { duration: number; yield: number }[]): { duration: number; yieldTrend: number }[] {
  if (points.length < 2) return [];
  const n = points.length;
  let sumLnX = 0, sumY = 0, sumLnX2 = 0, sumLnXY = 0;
  for (const p of points) {
    if (p.duration <= 0) continue;
    const lnx = Math.log(p.duration);
    sumLnX += lnx;
    sumY += p.yield;
    sumLnX2 += lnx * lnx;
    sumLnXY += lnx * p.yield;
  }
  const denom = n * sumLnX2 - sumLnX * sumLnX;
  if (Math.abs(denom) < 1e-10) return [];
  const b = (n * sumLnXY - sumLnX * sumY) / denom;
  const a = (sumY - b * sumLnX) / n;

  const minD = Math.min(...points.map(p => p.duration));
  const maxD = Math.max(...points.map(p => p.duration));
  const step = (maxD - minD) / 50;
  const trend: { duration: number; yieldTrend: number }[] = [];
  for (let d = minD; d <= maxD + step / 2; d += step) {
    if (d <= 0) continue;
    trend.push({ duration: d, yieldTrend: a + b * Math.log(d) });
  }
  return trend;
}

// ─── Component ───

interface CurvePoint {
  ticker: string;
  duration: number;
  yield: number;
}

function ProjectedCurveTooltip({ hoveredPoint }: { hoveredPoint: CurvePoint | null }) {
  if (!hoveredPoint?.ticker) return null;
  return (
    <div className="rounded-md border border-border bg-card p-2 shadow-lg text-xs font-mono">
      <p className="font-semibold text-accent">{hoveredPoint.ticker}</p>
      <p className="text-muted-foreground">Duration: {hoveredPoint.duration.toFixed(2)}</p>
      <p className="text-foreground">TNA Proy.: {hoveredPoint.yield.toFixed(2)}%</p>
    </div>
  );
}

function ProjectedCurveDot(props: any) {
  const { cx, cy, payload, onDotEnter, onDotLeave } = props;
  if (!payload?.ticker || cx == null || cy == null) return null;
  return (
    <g style={{ cursor: 'pointer' }}>
      <circle cx={cx} cy={cy} r={12} fill="transparent" pointerEvents="all"
        onMouseEnter={() => onDotEnter?.(payload, cx, cy)}
        onMouseMove={() => onDotEnter?.(payload, cx, cy)}
        onMouseLeave={() => onDotLeave?.()} />
      <circle cx={cx} cy={cy} r={6} fill="hsl(var(--accent))" stroke="hsl(var(--background))" strokeWidth={1.5} pointerEvents="none" />
    </g>
  );
}

export default function Experimental() {
  const navigate = useNavigate();
  const { isAdvanced, activate } = useAdvancedMode();
  const { theme, toggle: toggleTheme } = useTheme();
  const { getEffectiveMaturity } = useMaturityOverrides();
  const { holidayDatesSet } = useHolidays();
  const { custom } = useCustomInstruments();
  const customTickers = custom.map(i => i.ticker);
  const { data: livePrices, isLoading } = useLivePrices(customTickers);
  const { data: cerData } = useCER();
  const { inflation, setInflation, loading: inflationLoading } = useInflationInputs();

  const [showAllDays, setShowAllDays] = useState(false);
  const [selectedAuditTicker, setSelectedAuditTicker] = useState<string>('');

  const allCer = useMemo(() => [...CER_INSTRUMENTS, ...custom.filter(i => i.type === 'CER')], [custom]);
  const lastOfficialCER = cerData?.latestCer ?? cerData?.cer ?? null;
  const lastOfficialDate = cerData?.latestDate ? parseLocalDate(cerData.latestDate) : null;

  const cerRows = useMemo(() => {
    return allCer
      .map(inst => {
        const maturity = getEffectiveMaturity(inst.ticker, inst.maturityDate);
        const price = livePrices?.prices[inst.ticker]?.price ?? 0;
        const [my, mm, md] = maturity.split('-').map(Number);
        const matDate = new Date(my, mm - 1, md);
        const cerRelevantDate = subtractBusinessDays(matDate, 10, holidayDatesSet);
        const settlement = getSettlementDate(1, holidayDatesSet);
        const days = daysUntil(maturity, 1, holidayDatesSet);
        const d360 = days360(settlement, matDate);
        const duration = d360 / 360;
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

  // Enriched projected rows with audit fields
  const projectedRows = useMemo(() => {
    return cerRows.map(inst => {
      const cerDateStr = formatDateISO(inst.cerRelevantDate);
      const projectedCER = cerLookup[cerDateStr] ?? null;
      const cerInicial = inst.cerInicial ?? null;
      if (!projectedCER || !cerInicial || inst.price <= 0) {
        return {
          ...inst, projectedCER: null, tnaProj: null as number | null,
          cerInicial: cerInicial, factorCER: null, precioRelativo: null,
          adjustedFace: null, ratio: null, retornoAcumulado: null,
        };
      }
      const factorCER = projectedCER / cerInicial;
      const adjustedFace = 100 * factorCER;
      const precioRelativo = inst.price / 100;
      const ratio = adjustedFace / inst.price;
      const retornoAcumulado = ratio - 1;
      const tnaProj = inst.days > 0 ? retornoAcumulado * 365 / inst.days * 100 : 0;
      return {
        ...inst, projectedCER, tnaProj,
        cerInicial, factorCER, precioRelativo, adjustedFace, ratio, retornoAcumulado,
      };
    });
  }, [cerRows, cerLookup]);

  const curvePoints = useMemo<CurvePoint[]>(() => {
    return projectedRows
      .filter(r => r.tnaProj !== null && r.tnaProj !== undefined)
      .map(r => ({ ticker: r.ticker, duration: r.duration, yield: r.tnaProj! }));
  }, [projectedRows]);

  const trendLine = useMemo(() => calcLogTrend(curvePoints), [curvePoints]);
  const trendData = useMemo(() => [...trendLine].sort((a, b) => a.duration - b.duration), [trendLine]);
  const scatterData = useMemo(() => curvePoints.map(p => ({ ...p })), [curvePoints]);

  const projectionSample = useMemo(() => {
    if (cerProjection.length <= 30) return cerProjection;
    const first = cerProjection.slice(0, 5);
    const mid = cerProjection.filter((_, i) => i > 4 && i < cerProjection.length - 5 && i % 15 === 0);
    const last = cerProjection.slice(-5);
    return [...first, ...mid, ...last];
  }, [cerProjection]);

  const tableCData = showAllDays ? cerProjection : projectionSample;

  const timestamp = livePrices?.timestamp
    ? new Date(livePrices.timestamp).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  const [hoveredCurvePoint, setHoveredCurvePoint] = useState<CurvePoint | null>(null);
  const [hoveredCurvePosition, setHoveredCurvePosition] = useState<{ x: number; y: number } | null>(null);

  const handleCurvePointEnter = useCallback((point: CurvePoint, x: number, y: number) => {
    setHoveredCurvePoint(point);
    setHoveredCurvePosition({ x: x + 12, y: Math.max(y - 72, 12) });
  }, []);

  const handleCurvePointLeave = useCallback(() => {
    setHoveredCurvePoint(null);
    setHoveredCurvePosition(null);
  }, []);

  const handleInflationChange = useCallback((index: number, value: number) => {
    setInflation(prev => {
      const next = [...prev];
      next[index] = { ...next[index], rate: value };
      return next;
    });
  }, []);

  const handleDeleteInflationRow = useCallback((index: number) => {
    setInflation(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Audit card data for selected ticker
  const auditData = useMemo(() => {
    if (!selectedAuditTicker) return null;
    const row = projectedRows.find(r => r.ticker === selectedAuditTicker);
    if (!row) return null;

    // Find the CER projection row for the relevant date
    const cerDateStr = formatDateISO(row.cerRelevantDate);
    const projRow = cerProjection.find(r => r.dateStr === cerDateStr);

    return { row, projRow };
  }, [selectedAuditTicker, projectedRows, cerProjection]);

  // ─── Gate: require Advanced Mode ───
  if (!isAdvanced) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="terminal-card p-8 max-w-sm text-center space-y-4">
          <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Esta vista requiere Modo Avanzado.</p>
          <button
            onClick={() => {
              const pwd = prompt('Ingresá la contraseña para activar el modo avanzado:');
              if (pwd && !activate(pwd)) alert('Contraseña incorrecta');
            }}
            className="px-4 py-2 rounded-md border border-border text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
          >
            Activar Modo Avanzado
          </button>
          <button onClick={() => navigate('/')} className="block mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors mt-2">
            ← Volver
          </button>
        </div>
      </div>
    );
  }

  const thClass = "text-right py-2.5 px-3 text-[10px] uppercase tracking-wider font-medium text-muted-foreground";
  const tdClass = "py-2.5 px-3 font-mono text-xs text-right";
  const auditThClass = "text-right py-2 px-2 text-[9px] uppercase tracking-wider font-medium text-accent/70";
  const auditTdClass = "py-2 px-2 font-mono text-[11px] text-right text-accent/90";

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-bold tracking-tight text-foreground">ADCAP</h1>
          <span className="text-xs text-muted-foreground hidden md:inline">
            <FlaskConical className="w-3 h-3 inline mr-1" />Experimental · CER Proyectado
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
          {timestamp && <span>Última actualización: {timestamp}</span>}
          {isLoading && <span className="animate-pulse">sync</span>}
          <div className="w-2 h-2 rounded-full bg-positive animate-pulse" />
          <button onClick={toggleTheme} className="flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors text-[10px] uppercase tracking-wider font-mono">
            {theme === 'night' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
            {theme === 'night' ? 'Día' : 'Noche'}
          </button>
        </div>
      </header>

      <div className="bg-accent/10 border-b border-accent/20 px-4 md:px-8 py-1.5 flex items-center gap-2">
        <FlaskConical className="w-3 h-3 text-accent" />
        <span className="text-[10px] text-accent font-mono uppercase tracking-wider">Vista experimental · CER con inflación proyectada · Tramos 16-15</span>
      </div>

      <main className="max-w-[1400px] mx-auto p-4 md:p-6 space-y-8">

        {/* BLOQUE A — CER Market Table */}
        <section>
          <div className="terminal-card overflow-hidden">
            <div className="px-4 py-2 border-b border-border/50">
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                A · Bonos CER · Precios de Mercado · {cerRows.length} instrumentos
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Ticker</th>
                    <th className={thClass}>Precio</th>
                    <th className={thClass}>Vto</th>
                    <th className={thClass}>Días</th>
                    <th className={thClass}>Duration</th>
                    <th className={thClass}>CER Inicial</th>
                  </tr>
                </thead>
                <tbody>
                  {cerRows.map(inst => (
                    <tr key={inst.ticker} className="border-b border-border/30 table-row-hover">
                      <td className="py-2.5 px-3 font-mono text-xs font-semibold text-ticker">{inst.ticker}</td>
<td className={tdClass}>{inst.price > 0 ? `$${inst.price.toFixed(3)}` : '—'}</td>
                      <td className={`${tdClass} text-muted-foreground`}>{formatDateShort(inst.matDate)}</td>
                      <td className={tdClass}>{inst.days}</td>
                      <td className={tdClass}>{inst.duration.toFixed(2)}</td>
                      <td className={tdClass}>{inst.cerInicial?.toFixed(4) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* BLOQUE B — Editable Inflation Table */}
        <section>
          <div className="terminal-card overflow-hidden">
            <div className="px-4 py-2 border-b border-border/50">
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                B · Inflación Mensual Esperada (editable) · Inflación mes M → CER del 16/(M+1) al 15/(M+2)
              </span>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border">
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Mes</th>
                    <th className={thClass}>Tramo aplica</th>
                    <th className={thClass}>Inflación mensual</th>
                    <th className={thClass}>Días tramo</th>
                    <th className={thClass}>Daily pace</th>
                    <th className="py-2.5 px-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {inflation.map((row, i) => {
                    const tramo = getTramoForMonth(row.year, row.month);
                    const dailyPace = Math.pow(1 + row.rate, 1 / tramo.days) - 1;
                    return (
                      <tr key={`${row.year}-${row.month}`} className="border-b border-border/30 table-row-hover">
                        <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{row.label}</td>
                        <td className={`${tdClass} text-muted-foreground`}>
                          {(() => {
                            const s = tramo.start;
                            const e = tramo.end;
                            return `${s.getDate()}/${s.getMonth() + 1} → ${e.getDate()}/${e.getMonth() + 1}`;
                          })()}
                        </td>
                        <td className="py-1 px-2 text-right">
                          <input
                            type="number"
                            value={(row.rate * 100).toFixed(1)}
                            onChange={e => {
                              const val = parseFloat(e.target.value);
                              if (isNaN(val)) return;
                              handleInflationChange(i, val / 100);
                            }}
                            step="0.1"
                            className="w-20 bg-transparent border border-border/40 rounded px-2 py-1 text-xs font-mono text-right text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent/60 transition-colors"
                          />
                          <span className="text-[10px] text-muted-foreground ml-1">%</span>
                        </td>
                        <td className={`${tdClass} text-muted-foreground`}>{tramo.days}</td>
                        <td className={`${tdClass} text-muted-foreground`}>{(dailyPace * 100).toFixed(6)}%</td>
                        <td className="py-1 px-1 text-center">
                          <button
                            onClick={() => handleDeleteInflationRow(i)}
                            className="text-muted-foreground/40 hover:text-destructive transition-colors"
                            title="Eliminar mes"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* BLOQUE C — CER Official + Projected (with audit columns) */}
        <section>
          <div className="terminal-card overflow-hidden">
            <div className="px-4 py-2 border-b border-border/50 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                C · CER Oficial + Proyectado · {cerProjection.length} días
                {lastOfficialCER && lastOfficialDate && (
                  <span className="ml-3">· Último oficial: {lastOfficialCER.toFixed(4)} ({formatDateShort(lastOfficialDate)})</span>
                )}
              </span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAllDays}
                  onChange={e => setShowAllDays(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-[10px] text-muted-foreground font-mono">Ver todos los días ({cerProjection.length})</span>
              </label>
            </div>
            {!lastOfficialCER || !lastOfficialDate ? (
              <div className="p-4 text-xs text-destructive font-mono">⚠ No se pudo obtener el CER oficial del BCRA para proyectar.</div>
            ) : (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border">
                      <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Fecha</th>
                      <th className={thClass}>CER</th>
                      <th className={thClass}>Tipo</th>
                      <th className={thClass}>Tramo inflación</th>
                      <th className={auditThClass}>Inflación %</th>
                      <th className={auditThClass}>Días tramo</th>
                      <th className={auditThClass}>Daily pace %</th>
                      <th className={auditThClass}>CER anterior</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableCData.map((row, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{formatDateShort(row.date)}</td>
                        <td className={tdClass}>{row.cer.toFixed(4)}</td>
                        <td className={`${tdClass} ${row.isOfficial ? 'text-positive' : 'text-accent'}`}>
                          {row.isOfficial ? 'Oficial' : 'Proyectado'}
                        </td>
                        <td className={`${tdClass} text-muted-foreground`}>{row.tramoLabel ?? '—'}</td>
                        <td className={auditTdClass}>{row.inflationRate !== null ? `${(row.inflationRate * 100).toFixed(2)}%` : '—'}</td>
                        <td className={auditTdClass}>{row.tramoDays ?? '—'}</td>
                        <td className={auditTdClass}>{row.dailyPace !== null ? `${(row.dailyPace * 100).toFixed(6)}%` : '—'}</td>
                        <td className={auditTdClass}>{row.prevCER !== null ? row.prevCER.toFixed(4) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* RESULTS — Projected rates (clean) */}
        <section>
          <div className="terminal-card overflow-hidden">
            <div className="px-4 py-2 border-b border-border/50">
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                Resultado · Tasas CER Proyectadas
              </span>
              <span className="text-[10px] text-muted-foreground/60 font-mono ml-3">click en una fila para auditar</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Ticker</th>
                    <th className={thClass}>Precio</th>
                    <th className={thClass}>Vto</th>
                    <th className={thClass}>Fecha CER (T-10)</th>
                    <th className={thClass}>CER Inicial</th>
                    <th className={thClass}>CER Proy.</th>
                    <th className={thClass}>Días</th>
                    <th className={thClass}>TNA Proy.</th>
                    <th className={thClass}>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {projectedRows.map(inst => (
                    <tr
                      key={inst.ticker}
                      className={`border-b border-border/30 table-row-hover cursor-pointer ${selectedAuditTicker === inst.ticker ? 'bg-accent/10' : ''}`}
                      onClick={() => setSelectedAuditTicker(prev => prev === inst.ticker ? '' : inst.ticker)}
                    >
                      <td className="py-2.5 px-3 font-mono text-xs font-semibold text-ticker">{inst.ticker}</td>
                      <td className={tdClass}>{inst.price > 0 ? `$${inst.price.toFixed(3)}` : '—'}</td>
                      <td className={`${tdClass} text-muted-foreground`}>{formatDateShort(inst.matDate)}</td>
                      <td className={`${tdClass} text-muted-foreground`}>{formatDateShort(inst.cerRelevantDate)}</td>
                      <td className={tdClass}>{inst.cerInicial ? inst.cerInicial.toFixed(4) : '—'}</td>
                      <td className={tdClass}>{inst.projectedCER ? inst.projectedCER.toFixed(4) : '—'}</td>
                      <td className={tdClass}>{inst.d360}</td>
                      <td className={tdClass}>
                        {inst.tnaProj !== null && inst.tnaProj !== undefined ? `${inst.tnaProj >= 0 ? '+' : ''}${inst.tnaProj.toFixed(2)}%` : '—'}
                      </td>
                      <td className={tdClass}>{inst.duration.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* AUDIT CARD — Per-ticker audit (A/B/C blocks) */}
        {auditData && auditData.row && (
          <section>
            <div className="terminal-card overflow-hidden border-accent/30">
              <div className="px-4 py-2 border-b border-accent/20 bg-accent/5 flex items-center justify-between">
                <span className="text-[10px] text-accent font-mono uppercase tracking-widest">
                  🔍 Auditoría · {auditData.row.ticker}
                </span>
                <div className="flex items-center gap-3">
                  <select
                    value={selectedAuditTicker}
                    onChange={e => setSelectedAuditTicker(e.target.value)}
                    className="bg-transparent border border-border/40 rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-accent/60"
                  >
                    <option value="">— Seleccionar ticker —</option>
                    {projectedRows.map(r => (
                      <option key={r.ticker} value={r.ticker}>{r.ticker}</option>
                    ))}
                  </select>
                  <button onClick={() => setSelectedAuditTicker('')} className="text-[10px] text-muted-foreground hover:text-foreground">✕</button>
                </div>
              </div>

              <div className="p-5 space-y-6">

                {/* BLOQUE A — Inputs */}
                <div>
                  <h3 className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mb-3">A · Datos de entrada</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
                    {[
                      { label: 'Ticker', value: auditData.row.ticker },
                      { label: 'Precio', value: auditData.row.price > 0 ? `$${auditData.row.price.toFixed(3)}` : '—' },
                      { label: 'Vencimiento', value: formatDateShort(auditData.row.matDate) },
                      { label: 'Fecha CER (T-10)', value: formatDateShort(auditData.row.cerRelevantDate) },
                      { label: 'Fecha CER tabla', value: formatDateISO(auditData.row.cerRelevantDate) },
                      { label: 'CER Inicial', value: auditData.row.cerInicial ? auditData.row.cerInicial.toFixed(4) : '—' },
                      { label: 'CER Proyectado', value: auditData.row.projectedCER ? auditData.row.projectedCER.toFixed(4) : '—' },
                      { label: 'Días 360', value: auditData.row.d360.toString() },
                    ].map(item => (
                      <div key={item.label} className="space-y-0.5">
                        <div className="text-[9px] text-muted-foreground/70 font-mono uppercase tracking-wider">{item.label}</div>
                        <div className="text-xs font-mono font-semibold text-foreground">{item.value}</div>
                      </div>
                    ))}
                  </div>
                  {auditData.projRow && (
                    <div className="mt-3 pt-3 border-t border-border/20 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
                      {[
                        { label: 'Tramo inflación', value: auditData.projRow.tramoLabel ?? '—' },
                        { label: 'Inflación mensual', value: auditData.projRow.inflationRate !== null ? `${(auditData.projRow.inflationRate * 100).toFixed(2)}%` : '—' },
                        { label: 'Daily pace', value: auditData.projRow.dailyPace !== null ? `${(auditData.projRow.dailyPace * 100).toFixed(6)}%` : '—' },
                        { label: 'Días del tramo', value: auditData.projRow.tramoDays?.toString() ?? '—' },
                      ].map(item => (
                        <div key={item.label} className="space-y-0.5">
                          <div className="text-[9px] text-muted-foreground/70 font-mono uppercase tracking-wider">{item.label}</div>
                          <div className="text-xs font-mono font-semibold text-foreground">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* BLOQUE B — Resultado intermedio */}
                <div>
                  <h3 className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mb-3">B · Resultado intermedio</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                    <div className="space-y-0.5">
                      <div className="text-[9px] text-muted-foreground/70 font-mono uppercase tracking-wider">Retorno acumulado</div>
                      <div className="text-sm font-mono font-bold text-foreground">
                        {auditData.row.retornoAcumulado != null ? `${(auditData.row.retornoAcumulado * 100).toFixed(2)}%` : '—'}
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-[9px] text-muted-foreground/70 font-mono uppercase tracking-wider">TNA Proyectada</div>
                      <div className="text-sm font-mono font-bold text-accent">
                        {auditData.row.tnaProj !== null && auditData.row.tnaProj !== undefined ? `${auditData.row.tnaProj.toFixed(4)}%` : '—'}
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-[9px] text-muted-foreground/70 font-mono uppercase tracking-wider">Duration</div>
                      <div className="text-sm font-mono font-bold text-foreground">{auditData.row.duration.toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                {/* BLOQUE C — Explicación paso a paso */}
                <div>
                  <h3 className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mb-3">C · Cálculo paso a paso</h3>
                  <div className="bg-card border border-border/30 rounded-lg p-4 space-y-3 text-xs font-mono leading-relaxed">
                    <div className="flex items-start gap-3">
                      <span className="text-muted-foreground/50 select-none">1.</span>
                      <div>
                        <span className="text-muted-foreground">Factor CER = CER proyectado / CER inicial</span>
                        <br />
                        <span className="text-foreground">= {auditData.row.projectedCER?.toFixed(4) ?? '?'} / {auditData.row.cerInicial?.toFixed(4) ?? '?'} = <strong>{auditData.row.factorCER?.toFixed(6) ?? '?'}</strong></span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-muted-foreground/50 select-none">2.</span>
                      <div>
                        <span className="text-muted-foreground">Precio relativo = Precio / 100</span>
                        <br />
                        <span className="text-foreground">= {auditData.row.price.toFixed(2)} / 100 = <strong>{auditData.row.precioRelativo?.toFixed(4) ?? '?'}</strong></span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-muted-foreground/50 select-none">3.</span>
                      <div>
                        <span className="text-muted-foreground">Adjusted Face = 100 × Factor CER</span>
                        <br />
                        <span className="text-foreground">= 100 × {auditData.row.factorCER?.toFixed(6) ?? '?'} = <strong>{auditData.row.adjustedFace?.toFixed(4) ?? '?'}</strong></span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-muted-foreground/50 select-none">4.</span>
                      <div>
                        <span className="text-muted-foreground">Ratio = Adjusted Face / Precio</span>
                        <br />
                        <span className="text-foreground">= {auditData.row.adjustedFace?.toFixed(4) ?? '?'} / {auditData.row.price.toFixed(2)} = <strong>{auditData.row.ratio?.toFixed(6) ?? '?'}</strong></span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-muted-foreground/50 select-none">5.</span>
                      <div>
                        <span className="text-muted-foreground">Retorno acumulado = Ratio - 1</span>
                        <br />
                        <span className="text-foreground">= {auditData.row.ratio?.toFixed(6) ?? '?'} - 1 = <strong>{auditData.row.retornoAcumulado != null ? `${(auditData.row.retornoAcumulado * 100).toFixed(2)}%` : '?'}</strong></span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 pt-2 border-t border-border/20">
                      <span className="text-accent/70 select-none">6.</span>
                      <div>
                        <span className="text-accent/80">TNA = Retorno acumulado × 365 / Días × 100</span>
                        <br />
                        <span className="text-accent">= {auditData.row.retornoAcumulado != null ? `${(auditData.row.retornoAcumulado * 100).toFixed(4)}%` : '?'} × 365 / {auditData.row.days} × 100</span>
                        <br />
                        <span className="text-accent font-bold text-sm">= {auditData.row.tnaProj !== null && auditData.row.tnaProj !== undefined ? `${auditData.row.tnaProj.toFixed(4)}%` : '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </section>
        )}

        {/* Ticker selector when no audit is shown */}
        {!selectedAuditTicker && projectedRows.length > 0 && (
          <section>
            <div className="terminal-card overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">🔍 Auditar ticker:</span>
                <select
                  value=""
                  onChange={e => setSelectedAuditTicker(e.target.value)}
                  className="bg-transparent border border-border/40 rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-accent/60"
                >
                  <option value="">— Seleccionar —</option>
                  {projectedRows.map(r => (
                    <option key={r.ticker} value={r.ticker}>{r.ticker}</option>
                  ))}
                </select>
                <span className="text-[10px] text-muted-foreground font-mono">o hacé click en una fila de la tabla de resultados</span>
              </div>
            </div>
          </section>
        )}

        {/* CHART — Projected Yield Curve with Log Trend */}
        <section>
          <div className="terminal-card overflow-hidden">
            <div className="px-4 py-2 border-b border-border/50">
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                Curva · TNA Proyectada vs Duration (con tendencia logarítmica)
              </span>
            </div>
            <div className="p-4 relative" style={{ height: 400 }}>
              {curvePoints.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis
                      dataKey="duration"
                      type="number"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      label={{ value: 'Duration', position: 'bottom', offset: -5, style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
                      allowDuplicatedCategory={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={v => `${v.toFixed(1)}%`}
                      label={{ value: 'TNA Proy.', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
                    />
                    <Tooltip
                      cursor={false}
                      content={<ProjectedCurveTooltip hoveredPoint={hoveredCurvePoint} />}
                      active={!!hoveredCurvePoint}
                      position={hoveredCurvePosition ?? undefined}
                      wrapperStyle={{ pointerEvents: 'none', zIndex: 20 }}
                    />
                    <Line
                      data={trendData}
                      dataKey="yieldTrend"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={1.5}
                      strokeDasharray="6 3"
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                      tooltipType="none"
                    />
                    <Scatter
                      data={scatterData}
                      dataKey="yield"
                      fill="hsl(var(--accent))"
                      isAnimationActive={false}
                      shape={<ProjectedCurveDot onDotEnter={handleCurvePointEnter} onDotLeave={handleCurvePointLeave} />}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-muted-foreground font-mono">
                  Sin datos para graficar
                </div>
              )}
            </div>
          </div>
        </section>

      </main>

      <footer className="border-t border-border px-4 md:px-8 py-4 mt-12">
        <p className="text-[10px] text-muted-foreground text-center font-mono">
          Vista experimental · CER proyectado con inflación editable · Tramos 16-15 · No afecta cálculos principales
        </p>
      </footer>
    </div>
  );
}
