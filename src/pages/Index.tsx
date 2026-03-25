import { useState } from 'react';
import { LECAPS, BONCER } from '@/data/instruments';
import { useLivePrices } from '@/hooks/useLivePrices';
import InstrumentTable from '@/components/InstrumentTable';

export default function Index() {
  const [activeTab, setActiveTab] = useState<'LECAP' | 'BONCER'>('LECAP');
  const { data: livePrices, isLoading } = useLivePrices();

  const instruments = activeTab === 'LECAP' ? LECAPS : BONCER;

  const enriched = instruments.map(inst => ({
    ...inst,
    marketPrice: livePrices?.prices[inst.ticker]?.price ?? inst.marketPrice,
    change: livePrices?.prices[inst.ticker]?.change,
  }));

  // TODO: fetch last CER from an external source
  const lastCER = 720;

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="border-b border-border bg-card px-4 md:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-base font-bold font-mono tracking-tight">RentaFija</h1>
          <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider">
            Argentina · Tasa Fija & CER
          </span>
        </div>
        <div className="flex items-center gap-3">
          {livePrices?.timestamp && (
            <span className="text-[11px] text-muted-foreground font-mono">
              {new Date(livePrices.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              {isLoading && ' · sync'}
            </span>
          )}
          <div className="w-2 h-2 rounded-full bg-positive animate-pulse" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-4">
          {(['LECAP', 'BONCER'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded text-xs font-mono font-semibold uppercase tracking-wider transition-colors ${
                activeTab === tab
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Data source info */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
            Fuente: data912.com · Variación: precio actual / precio anterior
          </span>
        </div>

        {/* Table */}
        <div className="terminal-card overflow-hidden">
          <InstrumentTable instruments={enriched} lastCER={lastCER} />
        </div>
      </main>
    </div>
  );
}
