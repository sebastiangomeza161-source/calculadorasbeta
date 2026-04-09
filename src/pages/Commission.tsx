import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LECAPS, CER_INSTRUMENTS } from '@/data/instruments';
import { useLivePrices } from '@/hooks/useLivePrices';
import { useCER } from '@/hooks/useCER';
import { useCustomInstruments } from '@/hooks/useCustomInstruments';
import { useTheme } from '@/hooks/useTheme';
import { useMaturityOverrides } from '@/hooks/useMaturityOverrides';
import { useHolidays } from '@/hooks/useHolidays';
import { daysUntil, calcLecap, calcCer, getSettlementDate } from '@/lib/calculations';
import { Moon, Sun, ArrowLeft } from 'lucide-react';

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

function EraserIcon({ size = 12 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </svg>
  );
}

export default function Commission() {
  const navigate = useNavigate();
  const { getEffectiveMaturity } = useMaturityOverrides();
  const { holidayDatesSet } = useHolidays();
  const { theme, toggle: toggleTheme } = useTheme();
  const { custom } = useCustomInstruments();

  const customTickers = custom.map(i => i.ticker);
  const { data: livePrices, isLoading } = useLivePrices(customTickers);
  const { data: cerData } = useCER();

  const effectiveCER = cerData?.cer && cerData.cer > 0 ? cerData.cer : null;

  const [manualPrices, setManualPrices] = useState<Record<string, string>>({});
  const [commissions, setCommissions] = useState<Record<string, string>>({});

  const setManualPrice = useCallback((ticker: string, value: string) => {
    setManualPrices(prev => {
      const next = { ...prev };
      if (value === '') delete next[ticker];
      else next[ticker] = value;
      return next;
    });
  }, []);

  const setCommission = useCallback((ticker: string, value: string) => {
    setCommissions(prev => {
      const next = { ...prev };
      if (value === '') delete next[ticker];
      else next[ticker] = value;
      return next;
    });
  }, []);

  const clearAllManual = useCallback(() => setManualPrices({}), []);
  const clearAllCommissions = useCallback(() => setCommissions({}), []);

  const allLecaps = [...LECAPS, ...custom.filter(i => i.type === 'LECAP')];
  const allCer = [...CER_INSTRUMENTS, ...custom.filter(i => i.type === 'CER')];

  const timestamp = livePrices?.timestamp
    ? new Date(livePrices.timestamp).toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  // Enrich instruments
  function enrich(instruments: typeof LECAPS) {
    return instruments
      .map(inst => {
        const maturity = getEffectiveMaturity(inst.ticker, inst.maturityDate);
        const marketPrice = livePrices?.prices[inst.ticker]?.price ?? 0;
        const manualVal = manualPrices[inst.ticker];
        const parsedManual = manualVal ? parseFloat(manualVal) : NaN;
        const hasManualPrice = !isNaN(parsedManual) && parsedManual > 0;
        const effectivePrice = hasManualPrice ? parsedManual : marketPrice;
        return { ...inst, maturityDate: maturity, marketPrice, effectivePrice, hasManualPrice };
      })
      .sort((a, b) => daysUntil(a.maturityDate, 1, holidayDatesSet) - daysUntil(b.maturityDate, 1, holidayDatesSet));
  }

  const lecapRows = enrich(allLecaps);
  const cerRows = enrich(allCer);

  function formatPct(v: number): string {
    return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
  }

  function formatDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  }

  // LECAP commission row
  function lecapCalc(inst: typeof lecapRows[0]) {
    const price = inst.effectivePrice;
    const days = daysUntil(inst.maturityDate, 1, holidayDatesSet);
    const pago = inst.redemptionValue ?? 0;
    if (days <= 0 || price <= 0 || pago <= 0) return null;

    const totalReturn = pago / price - 1;
    const tna = totalReturn * 365 / days;
    const tea = Math.pow(1 + tna * days / 365, 365 / days) - 1;
    const tem = Math.pow(1 + tea, 30 / 365) - 1;

    const comStr = commissions[inst.ticker];
    const comVal = comStr ? parseFloat(comStr) : 0;
    const commission = !isNaN(comVal) ? comVal / 100 : 0;

    const tnaComision = tna - commission;
    const precioComision = Math.round((pago / (1 + tnaComision * days / 365)) * 1000) / 1000;
    const comisionDirecta = precioComision / price - 1;
    const teaCom = Math.pow(1 + tnaComision * days / 365, 365 / days) - 1;
    const temCom = Math.pow(1 + teaCom, 30 / 365) - 1;

    return { days, tna, tea, tem, commission, tnaComision, precioComision, comisionDirecta, teaCom, temCom, pago };
  }

  // CER commission row
  function cerCalc(inst: typeof cerRows[0]) {
    const price = inst.effectivePrice;
    const days = daysUntil(inst.maturityDate, 1, holidayDatesSet);
    if (days <= 0 || price <= 0 || !inst.cerInicial || !effectiveCER) return null;

    const adjustedFace = 100 * effectiveCER / inst.cerInicial;
    const settlement = getSettlementDate(1, holidayDatesSet);
    const [my, mm, md] = inst.maturityDate.split('-').map(Number);
    const matDate = new Date(my, mm - 1, md);
    const d360 = days360(settlement, matDate);
    const duration = d360 / 360;

    const ratio = adjustedFace / price;
    const tna180 = d360 > 0 ? (Math.pow(ratio, 180 / d360) - 1) * 2 : 0;

    const comStr = commissions[inst.ticker];
    const comVal = comStr ? parseFloat(comStr) : 0;
    const commission = !isNaN(comVal) ? comVal / 100 : 0;

    // TEA base = POWER((100 * UltimoCER) / (CERinicial * PrecioBase), 365 / (Vencimiento - FechaBase)) - 1
    const teaBase = Math.pow((100 * effectiveCER) / (inst.cerInicial * price), 365 / days) - 1;

    const tnaComision = tna180 - commission;
    const precioComision = Math.round((100 * effectiveCER / (inst.cerInicial * Math.pow(1 + tnaComision / 2, d360 / 180))) * 1000) / 1000;
    const comisionDirecta = precioComision / price - 1;
    // TEA c/com = POWER((100 * UltimoCER) / (CERinicial * PrecioConComision), 365 / (Vencimiento - FechaBase)) - 1
    const teaCom = Math.pow((100 * effectiveCER) / (inst.cerInicial * precioComision), 365 / days) - 1;

    return { days, duration, tna180, teaBase, commission, tnaComision, precioComision, comisionDirecta, teaCom, d360 };
  }

  const hasAnyManual = Object.keys(manualPrices).length > 0;
  const hasAnyCommission = Object.keys(commissions).length > 0;

  const thClass = "text-right py-2.5 px-3 text-[10px] uppercase tracking-wider font-medium text-muted-foreground";
  const tdClass = "py-2.5 px-3 font-mono text-xs text-right";

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground transition-colors" title="Volver">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-bold tracking-tight text-foreground">ADCAP</h1>
          <span className="text-xs text-muted-foreground hidden md:inline">Comisión</span>
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

      <main className="max-w-[1400px] mx-auto p-4 md:p-6 space-y-8">
        {/* Global clear buttons */}
        <div className="flex items-center gap-4">
          {hasAnyManual && (
            <button onClick={clearAllManual} className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-destructive font-mono uppercase tracking-wider transition-colors" title="Borrar todos los precios manuales">
              <EraserIcon /> Limpiar manuales
            </button>
          )}
          {hasAnyCommission && (
            <button onClick={clearAllCommissions} className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-destructive font-mono uppercase tracking-wider transition-colors" title="Borrar todas las comisiones">
              <EraserIcon /> Limpiar comisiones
            </button>
          )}
        </div>

        {/* LECAP Section */}
        <section>
          <div className="terminal-card overflow-hidden">
            <div className="px-4 py-2 border-b border-border/50">
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                LECAP · Comisión · {lecapRows.length} instrumentos
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Ticker</th>
                    <th className={thClass}>Precio</th>
                    <th className={thClass}>Manual</th>
                    <th className={thClass}>Días</th>
                    <th className={thClass}>Vto</th>
                    <th className={thClass}>Pago</th>
                    <th className={thClass}>TNA</th>
                    <th className={thClass}>TEA</th>
                    <th className={thClass}>TEM</th>
                    <th className={thClass}>Comisión (s/TNA)</th>
                    <th className={thClass}>TNA c/com</th>
                    <th className={thClass}>Precio c/com</th>
                    <th className={thClass}>Com. directa</th>
                    <th className={thClass}>TEA c/com</th>
                    <th className={thClass}>TEM c/com</th>
                  </tr>
                </thead>
                <tbody>
                  {lecapRows.map(inst => {
                    const r = lecapCalc(inst);
                    const manualVal = manualPrices[inst.ticker] ?? '';
                    const comVal = commissions[inst.ticker] ?? '';
                    return (
                      <tr key={inst.ticker} className="border-b border-border/30 table-row-hover">
                        <td className="py-2.5 px-3 font-mono text-xs font-semibold text-ticker">{inst.ticker}</td>
                        <td className={tdClass}>{inst.marketPrice > 0 ? `$${inst.marketPrice.toFixed(2)}` : '—'}</td>
                        <td className="py-1 px-2 text-right">
                          <input type="number" value={manualVal} onChange={e => setManualPrice(inst.ticker, e.target.value)} placeholder="—" step="0.01"
                            className="w-20 bg-transparent border border-border/40 rounded px-2 py-1 text-xs font-mono text-right text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent/60 transition-colors" />
                        </td>
                        <td className={tdClass}>{r ? r.days : '—'}</td>
                        <td className={`${tdClass} text-muted-foreground`}>{formatDate(inst.maturityDate)}</td>
                        <td className={tdClass}>{r ? r.pago.toFixed(3) : '—'}</td>
                        <td className={tdClass}>{r ? formatPct(r.tna * 100) : '—'}</td>
                        <td className={tdClass}>{r ? formatPct(r.tea * 100) : '—'}</td>
                        <td className={tdClass}>{r ? formatPct(r.tem * 100) : '—'}</td>
                        <td className="py-1 px-2 text-right">
                          <input type="number" value={comVal} onChange={e => setCommission(inst.ticker, e.target.value)} placeholder="0" step="0.01"
                            className="w-16 bg-transparent border border-border/40 rounded px-2 py-1 text-xs font-mono text-right text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent/60 transition-colors" />
                        </td>
                        <td className={tdClass}>{r ? formatPct(r.tnaComision * 100) : '—'}</td>
                        <td className={tdClass}>{r ? `$${r.precioComision.toFixed(3)}` : '—'}</td>
                        <td className={tdClass}>{r ? formatPct(r.comisionDirecta * 100) : '—'}</td>
                        <td className={tdClass}>{r ? formatPct(r.teaCom * 100) : '—'}</td>
                        <td className={tdClass}>{r ? formatPct(r.temCom * 100) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* CER Section */}
        <section>
          <div className="terminal-card overflow-hidden">
            <div className="px-4 py-2 border-b border-border/50">
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                CER · Comisión · {cerRows.length} instrumentos
                {effectiveCER && <span className="ml-3">· CER: {effectiveCER.toFixed(4)}</span>}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Ticker</th>
                    <th className={thClass}>Precio</th>
                    <th className={thClass}>Manual</th>
                    <th className={thClass}>Últ CER</th>
                    <th className={thClass}>Días</th>
                    <th className={thClass}>Vto</th>
                    <th className={thClass}>TNA 180</th>
                    <th className={thClass}>TEA / TIR</th>
                    <th className={thClass}>Comisión (s/TNA)</th>
                    <th className={thClass}>TNA c/com</th>
                    <th className={thClass}>Precio c/com</th>
                    <th className={thClass}>Com. directa</th>
                    <th className={thClass}>TEA c/com</th>
                  </tr>
                </thead>
                <tbody>
                  {cerRows.map(inst => {
                    const r = cerCalc(inst);
                    const manualVal = manualPrices[inst.ticker] ?? '';
                    const comVal = commissions[inst.ticker] ?? '';
                    return (
                      <tr key={inst.ticker} className="border-b border-border/30 table-row-hover">
                        <td className="py-2.5 px-3 font-mono text-xs font-semibold text-ticker">{inst.ticker}</td>
                        <td className={tdClass}>{inst.marketPrice > 0 ? `$${inst.marketPrice.toFixed(2)}` : '—'}</td>
                        <td className="py-1 px-2 text-right">
                          <input type="number" value={manualVal} onChange={e => setManualPrice(inst.ticker, e.target.value)} placeholder="—" step="0.01"
                            className="w-20 bg-transparent border border-border/40 rounded px-2 py-1 text-xs font-mono text-right text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent/60 transition-colors" />
                        </td>
                        <td className={tdClass}>{effectiveCER?.toFixed(4) ?? '—'}</td>
                        <td className={tdClass}>{r ? r.days : '—'}</td>
                        <td className={`${tdClass} text-muted-foreground`}>{formatDate(inst.maturityDate)}</td>
                        <td className={tdClass}>{r ? formatPct(r.tna180 * 100) : '—'}</td>
                        <td className={tdClass}>{r ? formatPct(r.teaBase * 100) : '—'}</td>
                        <td className="py-1 px-2 text-right">
                          <input type="number" value={comVal} onChange={e => setCommission(inst.ticker, e.target.value)} placeholder="0" step="0.01"
                            className="w-16 bg-transparent border border-border/40 rounded px-2 py-1 text-xs font-mono text-right text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent/60 transition-colors" />
                        </td>
                        <td className={tdClass}>{r ? formatPct(r.tnaComision * 100) : '—'}</td>
                        <td className={tdClass}>{r ? `$${r.precioComision.toFixed(3)}` : '—'}</td>
                        <td className={tdClass}>{r ? formatPct(r.comisionDirecta * 100) : '—'}</td>
                        <td className={tdClass}>{r ? formatPct(r.teaCom * 100) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 md:px-8 py-4 mt-12">
        <p className="text-[10px] text-muted-foreground text-center font-mono">
          Fuentes: data912.com · CER: BCRA API
        </p>
      </footer>
    </div>
  );
}
