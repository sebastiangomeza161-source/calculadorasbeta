import { useState, useMemo } from 'react';
import { LECAPS, CER_INSTRUMENTS } from '@/data/instruments';
import { useLivePrices } from '@/hooks/useLivePrices';
import { useCER } from '@/hooks/useCER';
import { useCustomInstruments } from '@/hooks/useCustomInstruments';
import { calcLecap, calcCer, daysUntil, formatPercent } from '@/lib/calculations';
import InstrumentTable from '@/components/InstrumentTable';
import YieldCurve from '@/components/YieldCurve';
import AddInstrumentModal from '@/components/AddInstrumentModal';
import { Plus } from 'lucide-react';

type TabType = 'LECAP' | 'CER';

export default function Index() {
  const [activeTab, setActiveTab] = useState<TabType>('LECAP');
  const [modalOpen, setModalOpen] = useState(false);
  const { custom, addInstrument } = useCustomInstruments();

  const customTickers = custom.map(i => i.ticker);
  const { data: livePrices, isLoading } = useLivePrices(customTickers);
  const { data: cerData, isLoading: cerLoading } = useCER();

  const baseLecaps = LECAPS;
  const baseCer = CER_INSTRUMENTS;
  const customLecaps = custom.filter(i => i.type === 'LECAP');
  const customCer = custom.filter(i => i.type === 'CER');

  const allLecaps = [...baseLecaps, ...customLecaps];
  const allCer = [...baseCer, ...customCer];
  const instruments = activeTab === 'LECAP' ? allLecaps : allCer;

  const enriched = instruments
    .map(inst => ({
      ...inst,
      marketPrice: livePrices?.prices[inst.ticker]?.price ?? 0,
      change: livePrices?.prices[inst.ticker]?.change ?? null,
    }))
    .sort((a, b) => daysUntil(a.maturityDate) - daysUntil(b.maturityDate));

  // Yield curve data
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
        } else if (activeTab === 'CER' && inst.cerInicial && cerData?.cer) {
          const r = calcCer(inst.marketPrice, inst.maturityDate, inst.cerInicial, cerData.cer);
          if (r) yieldVal = r.tna180;
        }

        return {
          ticker: inst.ticker,
          price: inst.marketPrice,
          days,
          duration,
          yield: yieldVal,
        };
      })
      .filter(d => d.yield !== 0);
  }, [enriched, activeTab, cerData]);

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
          {activeTab === 'CER' && (
            <span>· CER: {cerData?.source === 'bcra_api' ? 'BCRA' : cerData?.source?.startsWith('cached') ? 'BCRA (cache)' : 'manual'}</span>
          )}
          <span>· Variación: precio hoy / precio ayer</span>
        </div>

        {/* CER info */}
        {activeTab === 'CER' && (
          <div className="terminal-card px-4 py-3 mb-4 text-xs text-muted-foreground flex items-center justify-between">
            <span>
              {cerData?.cer
                ? `CER actual: ${cerData.cer.toFixed(4)} (${cerData.date}) — Fuente: ${cerData.source === 'bcra_api' ? 'BCRA API' : cerData.source?.startsWith('cached') ? 'BCRA (cache)' : 'No disponible'}`
                : cerLoading ? '⏳ Cargando CER desde BCRA...' : '⚠ No se pudo obtener el CER.'
              }
            </span>
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
          <InstrumentTable instruments={enriched} lastCER={cerData?.cer ?? undefined} />
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
          Fuentes: data912.com · CER: BCRA API (con fallback manual)
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
