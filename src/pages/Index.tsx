import { useState } from 'react';
import { LECAPS, BONCER } from '@/data/instruments';
import { useLivePrices } from '@/hooks/useLivePrices';
import InstrumentTable from '@/components/InstrumentTable';
import { TrendingUp } from 'lucide-react';

export default function Index() {
  const [activeTab, setActiveTab] = useState<'LECAP' | 'BONCER'>('LECAP');
  const { data: livePrices, isLoading } = useLivePrices();

  const instruments = activeTab === 'LECAP' ? LECAPS : BONCER;

  const enriched = instruments.map(inst => ({
    ...inst,
    marketPrice: livePrices?.prices[inst.ticker]?.price ?? inst.marketPrice,
    change: livePrices?.prices[inst.ticker]?.change,
  }));

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <TrendingUp className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Renta Fija Argentina</h1>
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        LECAPs · BONCER / CER — Fuente: data912
      </p>

      {/* Tabs + Timestamp */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-secondary rounded-lg p-1">
          {(['LECAP', 'BONCER'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-primary text-primary-foreground'
                  : 'text-secondary-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {livePrices?.timestamp && (
          <span className="text-xs text-muted-foreground font-mono">
            {new Date(livePrices.timestamp).toLocaleTimeString('es-AR')}
            {isLoading && ' · actualizando...'}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <InstrumentTable instruments={enriched} />
      </div>
    </div>
  );
}
