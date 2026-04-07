import { useState, useMemo } from 'react';
import { LECAPS, CER_INSTRUMENTS } from '@/data/instruments';
import { useLivePrices } from '@/hooks/useLivePrices';
import { useCER } from '@/hooks/useCER';
import { useCustomInstruments } from '@/hooks/useCustomInstruments';
import { useTheme } from '@/hooks/useTheme';
import { calcLecap, calcCer, daysUntil } from '@/lib/calculations';
import InstrumentTable from '@/components/InstrumentTable';
import YieldCurve from '@/components/YieldCurve';
import AddInstrumentModal from '@/components/AddInstrumentModal';
import { Plus, Moon, Sun } from 'lucide-react';

type TabType = 'LECAP' | 'CER';

export default function Index() {
  const { theme, toggle: toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('LECAP');
  const [modalOpen, setModalOpen] = useState(false);
  const [manualCER, setManualCER] = useState('');
  const { custom, addInstrument } = useCustomInstruments();

  const customTickers = custom.map(i => i.ticker);
  const { data: livePrices, isLoading } = useLivePrices(customTickers);
  const { data: cerData, isLoading: cerLoading } = useCER();

  // Determine effective CER: API first, manual fallback
  const manualCERValue = manualCER ? parseFloat(manualCER) : null;
  const cerAvailable = cerData?.cer != null && cerData.cer > 0;
  const effectiveCER = cerAvailable ? cerData!.cer! : (manualCERValue && manualCERValue > 0 ? manualCERValue : null);
  const cerSource = cerAvailable ? 'BCRA API' : (manualCERValue && manualCERValue > 0 ? 'CER manual' : null);

  const allLecaps = [...LECAPS, ...custom.filter(i => i.type === 'LECAP')];
  const allCer = [...CER_INSTRUMENTS, ...custom.filter(i => i.type === 'CER')];
  const instruments = activeTab === 'LECAP' ? allLecaps : allCer;

  const enriched = instruments
    .map(inst => ({
      ...inst,
      marketPrice: livePrices?.prices[inst.ticker]?.price ?? 0,
      change: livePrices?.prices[inst.ticker]?.change ?? null,
    }))
    .sort((a, b) => daysUntil(a.maturityDate) - daysUntil(b.maturityDate));

  const curveData = useMemo(() => {
    return enriched
      .filter(inst => inst.marketPrice > 0)
      .map(inst => {
        const days = daysUntil(inst.maturityDate);
        const duration = days / 360;
        let yieldVal = 0;

        if (activeTab === 'LECAP' && inst.redemptionValue) {
          const r = calcLecap(inst.marketPrice, inst.maturityDate, inst.redemptionValue);
          if (r) yieldVal = r.tna;
        } else if (activeTab === 'CER' && inst.cerInicial && effectiveCER) {
          const r = calcCer(inst.marketPrice, inst.maturityDate, inst.cerInicial, effectiveCER);
          if (r) yieldVal = r.tna180;
        }

        return { ticker: inst.ticker, price: inst.marketPrice, days, duration, yield: yieldVal };
      })
      .filter(d => d.yield !== 0);
  }, [enriched, activeTab, effectiveCER]);

  const timestamp = livePrices?.timestamp
    ? new Date(livePrices.timestamp).toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-accent">Renta</span>Fija
          </h1>
          <span className="text-xs text-muted-foreground hidden md:inline">
            Argentina · LECAP & CER
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
          {timestamp && <span>Última actualización: {timestamp}</span>}
          {isLoading && <span className="animate-pulse">sync</span>}
          <div className="w-2 h-2 rounded-full bg-positive animate-pulse" />
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors text-[10px] uppercase tracking-wider font-mono"
            title={theme === 'night' ? 'Cambiar a modo día' : 'Cambiar a modo noche'}
          >
            {theme === 'night' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
            {theme === 'night' ? 'Día' : 'Noche'}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Tabs */}
        <div className="flex items-center gap-2 mb-5">
          {(['LECAP', 'CER'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`tab-button ${activeTab === tab ? 'tab-button-active' : 'tab-button-inactive'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Sources */}
        <div className="flex items-center gap-4 mb-4 text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
          <span>Precios: data912</span>
          {activeTab === 'CER' && cerSource && <span>· CER: {cerSource}</span>}
          <span>· Variación: precio hoy / precio ayer</span>
        </div>

        {/* CER info + manual fallback */}
        {activeTab === 'CER' && (
          <div className="space-y-3 mb-4">
            {/* CER status */}
            <div className="terminal-card px-4 py-3 text-xs text-muted-foreground">
              {cerData?.cer ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>
                    CER para cálculos: <span className="text-foreground font-semibold">{cerData.cer.toFixed(4)}</span>
                    {cerData.cerDate && <span className="ml-1">({cerData.cerDate})</span>}
                  </span>
                  {cerData.latestCer && cerData.latestDate && (
                    <span>
                      CER último disponible: <span className="text-foreground">{cerData.latestCer.toFixed(4)}</span>
                      <span className="ml-1">({cerData.latestDate})</span>
                    </span>
                  )}
                  <span className="text-positive text-[10px] font-mono">Fuente: BCRA API · Rezago: T-10 días hábiles</span>
                </div>
              ) : cerLoading ? (
                <span>⏳ Cargando CER desde BCRA...</span>
              ) : (
                <span className="text-destructive">⚠ No se pudo obtener el CER desde BCRA.</span>
              )}
            </div>

            {/* Manual CER fallback */}
            <div className="terminal-card px-4 py-3 flex flex-wrap items-center gap-3">
              <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider whitespace-nowrap">
                CER actual (manual)
              </label>
              <input
                type="number"
                value={manualCER}
                onChange={(e) => setManualCER(e.target.value)}
                placeholder="Ej: 732.60"
                step="0.0001"
                className="input-field w-40 text-xs py-1.5"
              />
              <span className="text-[10px] font-mono text-muted-foreground">
                {cerAvailable
                  ? '· Se usa CER de BCRA (este campo es respaldo)'
                  : manualCERValue && manualCERValue > 0
                    ? '· ⚠ Usando CER manual para cálculos'
                    : '· Ingresá un valor como respaldo si BCRA no responde'}
              </span>
            </div>
          </div>
        )}

        {/* Table with + button */}
        <div className="terminal-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
              {activeTab} · {enriched.length} instrumentos
            </span>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-accent font-mono uppercase tracking-wider transition-colors"
              title="Agregar instrumento"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar
            </button>
          </div>
          <InstrumentTable instruments={enriched} lastCER={effectiveCER ?? undefined} />
        </div>

        {/* Yield Curve */}
        <YieldCurve
          data={curveData}
          yLabel={activeTab === 'LECAP' ? 'TNA' : 'TNA 180'}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-4 md:px-8 py-4 mt-12">
        <p className="text-[10px] text-muted-foreground text-center font-mono">
          Fuentes: data912.com · CER: BCRA API (T-10 días hábiles, con fallback manual)
        </p>
      </footer>

      {/* Add instrument modal */}
      <AddInstrumentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        type={activeTab}
        onAdd={addInstrument}
        existingTickers={customTickers}
      />
    </div>
  );
}
