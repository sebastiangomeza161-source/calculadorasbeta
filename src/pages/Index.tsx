import { useState } from 'react';
import { LECAPS, CER_INSTRUMENTS } from '@/data/instruments';
import { useLivePrices } from '@/hooks/useLivePrices';
import InstrumentTable from '@/components/InstrumentTable';

type TabType = 'LECAP' | 'CER';

export default function Index() {
  const [activeTab, setActiveTab] = useState<TabType>('LECAP');
  const { data: livePrices, isLoading } = useLivePrices();

  const instruments = activeTab === 'LECAP' ? LECAPS : CER_INSTRUMENTS;

  const enriched = instruments.map(inst => ({
    ...inst,
    marketPrice: livePrices?.prices[inst.ticker]?.price ?? 0,
    change: livePrices?.prices[inst.ticker]?.change ?? null,
  }));

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
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {livePrices?.timestamp && (
            <span className="font-mono">
              {new Date(livePrices.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {isLoading && <span className="font-mono animate-pulse">sync</span>}
          <div className="w-2 h-2 rounded-full bg-positive animate-pulse" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-5">
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
          {activeTab === 'CER' && <span>· CER: manual</span>}
          <span>· Variación: precio hoy / precio ayer</span>
        </div>

        {/* CER notice for CER tab */}
        {activeTab === 'CER' && (
          <div className="terminal-card px-4 py-3 mb-4 text-xs text-muted-foreground">
            ⚠ Las métricas CER requieren un valor de CER actual. Ingresá al detalle de cada instrumento para calcular con tu CER manual.
          </div>
        )}

        {/* Table */}
        <div className="terminal-card overflow-hidden">
          <InstrumentTable instruments={enriched} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-4 md:px-8 py-4 mt-12">
        <p className="text-[10px] text-muted-foreground text-center font-mono">
          Fuentes: data912.com · CER: ingreso manual · Arquitectura preparada para integración BCRA
        </p>
      </footer>
    </div>
  );
}
