import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CER_INSTRUMENTS, type Instrument } from '@/data/instruments';
import { useLivePrices } from '@/hooks/useLivePrices';
import { useCER } from '@/hooks/useCER';
import { useCustomInstruments } from '@/hooks/useCustomInstruments';
import { useTheme } from '@/hooks/useTheme';
import { useMaturityOverrides } from '@/hooks/useMaturityOverrides';
import { useAdvancedMode } from '@/hooks/useAdvancedMode';
import { daysUntil, getSettlementDate } from '@/lib/calculations';
import { Moon, Sun, ArrowLeft, Lock, FlaskConical } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';

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

/** Subtract N business days from a date */
function subtractBusinessDays(date: Date, n: number): Date {
  const result = new Date(date);
  let count = 0;
  while (count < n) {
    result.setDate(result.getDate() - 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) count++;
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

// ─── Default inflation table ───

function getDefaultInflation(): { month: string; rate: number }[] {
  const today = new Date();
  const months: { month: string; rate: number }[] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const label = d.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
    months.push({ month: label, rate: 2.5 }); // default 2.5% monthly
  }
  return months;
}

// ─── CER Projection Logic ───

interface CERProjectionRow {
  date: Date;
  dateStr: string;
  cer: number;
  isOfficial: boolean;
}

function projectCER(
  lastOfficialCER: number,
  lastOfficialDate: Date,
  inflation: { month: string; rate: number }[],
  endDate: Date
): CERProjectionRow[] {
  const rows: CERProjectionRow[] = [];

  // Start from lastOfficialDate
  rows.push({
    date: new Date(lastOfficialDate),
    dateStr: formatDateISO(lastOfficialDate),
    cer: lastOfficialCER,
    isOfficial: true,
  });

  // Build monthly pace map: for each month, compute daily pace
  // CER convention: the inflation of month M applies from the 15th of month M to the 14th of month M+1
  // Simplified: we use calendar months from the inflation table
  const today = new Date();
  const inflationByMonthKey: Record<string, number> = {};
  for (const inf of inflation) {
    // Parse "abr 2026" style labels back to a key
    // Use index-based approach instead
    inflationByMonthKey[inf.month] = inf.rate / 100;
  }

  // Create a lookup: for a given date, find the applicable monthly inflation
  function getMonthlyInflation(d: Date): number {
    const label = d.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
    return inflationByMonthKey[label] ?? 0.025; // fallback 2.5%
  }

  // Days in the "tramo" for a given month
  function getDaysInTramo(d: Date): number {
    // Simplified: days in the calendar month
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  }

  let currentDate = new Date(lastOfficialDate);
  let currentCER = lastOfficialCER;

  while (currentDate < endDate) {
    currentDate = new Date(currentDate.getTime() + 86400000); // +1 day
    if (currentDate > endDate) break;

    const monthlyInf = getMonthlyInflation(currentDate);
    const daysInMonth = getDaysInTramo(currentDate);
    const dailyPace = Math.pow(1 + monthlyInf, 1 / daysInMonth) - 1;
    currentCER = currentCER * (1 + dailyPace);

    rows.push({
      date: new Date(currentDate),
      dateStr: formatDateISO(currentDate),
      cer: currentCER,
      isOfficial: false,
    });
  }

  return rows;
}

// ─── Component ───

export default function Experimental() {
  const navigate = useNavigate();
  const { isAdvanced, activate } = useAdvancedMode();
  const { theme, toggle: toggleTheme } = useTheme();
  const { getEffectiveMaturity } = useMaturityOverrides();
  const { custom } = useCustomInstruments();
  const customTickers = custom.map(i => i.ticker);
  const { data: livePrices, isLoading } = useLivePrices(customTickers);
  const { data: cerData } = useCER();

  const [inflation, setInflation] = useState(getDefaultInflation);

  // If not advanced, show gate
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
          <button
            onClick={() => navigate('/')}
            className="block mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
          >
            ← Volver
          </button>
        </div>
      </div>
    );
  }

  const allCer = [...CER_INSTRUMENTS, ...custom.filter(i => i.type === 'CER')];

  // Effective CER from BCRA
  const lastOfficialCER = cerData?.latestCer ?? cerData?.cer ?? null;
  const lastOfficialDate = cerData?.latestDate ? parseLocalDate(cerData.latestDate) : null;

  // Enrich CER instruments
  const cerRows = allCer
    .map(inst => {
      const maturity = getEffectiveMaturity(inst.ticker, inst.maturityDate);
      const price = livePrices?.prices[inst.ticker]?.price ?? 0;
      const [my, mm, md] = maturity.split('-').map(Number);
      const matDate = new Date(my, mm - 1, md);
      const cerRelevantDate = subtractBusinessDays(matDate, 10);
      const settlement = getSettlementDate(1);
      const days = daysUntil(maturity);
      const d360 = days360(settlement, matDate);
      const duration = d360 / 360;
      return { ...inst, maturityDate: maturity, price, matDate, cerRelevantDate, days, d360, duration };
    })
    .filter(r => r.days > 0)
    .sort((a, b) => a.days - b.days);

  // Find the latest CER relevant date to know how far to project
  const maxCerDate = cerRows.reduce((max, r) => (r.cerRelevantDate > max ? r.cerRelevantDate : max), new Date());

  // Project CER
  const cerProjection = useMemo(() => {
    if (!lastOfficialCER || !lastOfficialDate) return [];
    return projectCER(lastOfficialCER, lastOfficialDate, inflation, maxCerDate);
  }, [lastOfficialCER, lastOfficialDate, inflation, maxCerDate.getTime()]);

  // Build a lookup map for projected CER
  const cerLookup = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of cerProjection) {
      map[row.dateStr] = row.cer;
    }
    return map;
  }, [cerProjection]);

  // Calculate projected rates
  const projectedRows = useMemo(() => {
    return cerRows.map(inst => {
      const cerDateStr = formatDateISO(inst.cerRelevantDate);
      const projectedCER = cerLookup[cerDateStr] ?? null;

      if (!projectedCER || !inst.cerInicial || inst.price <= 0) {
        return { ...inst, projectedCER: null, tna180Proj: null };
      }

      const adjustedFace = 100 * projectedCER / inst.cerInicial;
      const ratio = adjustedFace / inst.price;
      const tna180 = inst.d360 > 0 ? (Math.pow(ratio, 180 / inst.d360) - 1) * 2 * 100 : 0;

      return { ...inst, projectedCER, tna180Proj: tna180 };
    });
  }, [cerRows, cerLookup]);

  // Curve data
  const curvePoints = projectedRows
    .filter(r => r.tna180Proj !== null)
    .map(r => ({ ticker: r.ticker, duration: r.duration, yield: r.tna180Proj! }));

  // Show only a sample of CER projection (first 10 + every 15th + last 5)
  const projectionSample = useMemo(() => {
    if (cerProjection.length <= 30) return cerProjection;
    const first = cerProjection.slice(0, 5);
    const mid = cerProjection.filter((_, i) => i > 4 && i < cerProjection.length - 5 && i % 15 === 0);
    const last = cerProjection.slice(-5);
    return [...first, ...mid, ...last];
  }, [cerProjection]);

  const timestamp = livePrices?.timestamp
    ? new Date(livePrices.timestamp).toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  const thClass = "text-right py-2.5 px-3 text-[10px] uppercase tracking-wider font-medium text-muted-foreground";
  const tdClass = "py-2.5 px-3 font-mono text-xs text-right";

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-bold tracking-tight text-foreground">ADCAP</h1>
          <span className="text-xs text-muted-foreground hidden md:inline flex items-center gap-1.5">
            <FlaskConical className="w-3 h-3" /> Experimental · CER Proyectado
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
          {timestamp && <span>Última actualización: {timestamp}</span>}
          {isLoading && <span className="animate-pulse">sync</span>}
          <div className="w-2 h-2 rounded-full bg-positive animate-pulse" />
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors text-[10px] uppercase tracking-wider font-mono"
          >
            {theme === 'night' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
            {theme === 'night' ? 'Día' : 'Noche'}
          </button>
        </div>
      </header>

      <div className="bg-accent/10 border-b border-accent/20 px-4 md:px-8 py-1.5 flex items-center gap-2">
        <FlaskConical className="w-3 h-3 text-accent" />
        <span className="text-[10px] text-accent font-mono uppercase tracking-wider">Vista experimental · CER con inflación proyectada</span>
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
                      <td className={tdClass}>{inst.price > 0 ? `$${inst.price.toFixed(2)}` : '—'}</td>
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
                B · Inflación Mensual Esperada (editable)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Mes</th>
                    <th className={thClass}>Inflación % mensual</th>
                  </tr>
                </thead>
                <tbody>
                  {inflation.map((row, i) => (
                    <tr key={i} className="border-b border-border/30 table-row-hover">
                      <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{row.month}</td>
                      <td className="py-1 px-2 text-right">
                        <input
                          type="number"
                          value={row.rate}
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            if (isNaN(val)) return;
                            setInflation(prev => {
                              const next = [...prev];
                              next[i] = { ...next[i], rate: val };
                              return next;
                            });
                          }}
                          step="0.1"
                          className="w-20 bg-transparent border border-border/40 rounded px-2 py-1 text-xs font-mono text-right text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent/60 transition-colors"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* BLOQUE C — CER Official + Projected */}
        <section>
          <div className="terminal-card overflow-hidden">
            <div className="px-4 py-2 border-b border-border/50">
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                C · CER Oficial + Proyectado · {cerProjection.length} días
                {lastOfficialCER && lastOfficialDate && (
                  <span className="ml-3">· Último oficial: {lastOfficialCER.toFixed(4)} ({formatDateShort(lastOfficialDate)})</span>
                )}
              </span>
            </div>
            {!lastOfficialCER || !lastOfficialDate ? (
              <div className="p-4 text-xs text-destructive font-mono">⚠ No se pudo obtener el CER oficial del BCRA para proyectar.</div>
            ) : (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border">
                      <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Fecha</th>
                      <th className={thClass}>CER</th>
                      <th className={thClass}>Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectionSample.map((row, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{formatDateShort(row.date)}</td>
                        <td className={tdClass}>{row.cer.toFixed(4)}</td>
                        <td className={`${tdClass} ${row.isOfficial ? 'text-positive' : 'text-accent'}`}>
                          {row.isOfficial ? 'Oficial' : 'Proyectado'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* RESULTS — Projected rates */}
        <section>
          <div className="terminal-card overflow-hidden">
            <div className="px-4 py-2 border-b border-border/50">
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                Resultado · Tasas CER Proyectadas
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Ticker</th>
                    <th className={thClass}>Precio</th>
                    <th className={thClass}>Vto</th>
                    <th className={thClass}>Fecha CER (T-10)</th>
                    <th className={thClass}>CER Proyectado</th>
                    <th className={thClass}>TNA 180 Proy.</th>
                    <th className={thClass}>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {projectedRows.map(inst => (
                    <tr key={inst.ticker} className="border-b border-border/30 table-row-hover">
                      <td className="py-2.5 px-3 font-mono text-xs font-semibold text-ticker">{inst.ticker}</td>
                      <td className={tdClass}>{inst.price > 0 ? `$${inst.price.toFixed(2)}` : '—'}</td>
                      <td className={`${tdClass} text-muted-foreground`}>{formatDateShort(inst.matDate)}</td>
                      <td className={`${tdClass} text-muted-foreground`}>{formatDateShort(inst.cerRelevantDate)}</td>
                      <td className={tdClass}>{inst.projectedCER ? inst.projectedCER.toFixed(4) : '—'}</td>
                      <td className={tdClass}>
                        {inst.tna180Proj !== null ? `${inst.tna180Proj >= 0 ? '+' : ''}${inst.tna180Proj.toFixed(2)}%` : '—'}
                      </td>
                      <td className={tdClass}>{inst.duration.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* CHART — Projected Yield Curve */}
        <section>
          <div className="terminal-card overflow-hidden">
            <div className="px-4 py-2 border-b border-border/50">
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                Curva · TNA 180 Proyectada vs Duration
              </span>
            </div>
            <div className="p-4" style={{ height: 350 }}>
              {curvePoints.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={curvePoints} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis
                      dataKey="duration"
                      type="number"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      label={{ value: 'Duration', position: 'bottom', offset: -5, style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={v => `${v.toFixed(1)}%`}
                      label={{ value: 'TNA 180 Proy.', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="rounded-md border border-border bg-card p-2 shadow-lg text-xs font-mono">
                            <p className="font-semibold text-accent">{d.ticker}</p>
                            <p className="text-muted-foreground">Duration: {d.duration.toFixed(2)}</p>
                            <p className="text-foreground">TNA 180: {d.yield.toFixed(2)}%</p>
                          </div>
                        );
                      }}
                    />
                    <Scatter
                      dataKey="yield"
                      fill="hsl(var(--accent))"
                      r={5}
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
          Vista experimental · CER proyectado con inflación editable · No afecta cálculos principales
        </p>
      </footer>
    </div>
  );
}
