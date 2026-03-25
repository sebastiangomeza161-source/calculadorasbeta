import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInstrument } from '@/data/instruments';
import { useLivePrices } from '@/hooks/useLivePrices';
import { calcLecap, calcCer, formatPercent, formatDate, daysUntil } from '@/lib/calculations';
import { ArrowLeft } from 'lucide-react';

export default function InstrumentDetail() {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const instrument = getInstrument(ticker || '');
  const { data: livePrices } = useLivePrices();

  const livePrice = livePrices?.prices[ticker || '']?.price;
  const liveChange = livePrices?.prices[ticker || '']?.change;
  const currentMarketPrice = livePrice ?? instrument?.marketPrice ?? 0;

  const [manualPrice, setManualPrice] = useState('');
  const [commission, setCommission] = useState('0');

  const activePrice = manualPrice ? parseFloat(manualPrice) : currentMarketPrice;

  const result = useMemo(() => {
    if (!instrument || activePrice <= 0) return null;
    const comm = parseFloat(commission) || 0;
    if (instrument.type === 'LECAP') {
      return calcLecap(activePrice, instrument.maturityDate, comm);
    }
    return calcCer(activePrice, instrument.maturityDate, comm);
  }, [instrument, activePrice, commission]);

  if (!instrument) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Instrumento no encontrado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-3xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Volver</span>
      </button>

      {/* Header */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold font-mono text-accent">{instrument.ticker}</h1>
            <p className="text-muted-foreground text-sm mt-1">{instrument.name}</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
            {instrument.type}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground block">Vencimiento</span>
            <span className="font-mono">{formatDate(instrument.maturityDate)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Días restantes</span>
            <span className="font-mono">{daysUntil(instrument.maturityDate)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Precio (data912)</span>
            <span className="font-mono font-semibold">
              {currentMarketPrice > 0 ? `$${currentMarketPrice.toFixed(2)}` : 'Cargando...'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Variación</span>
            <span className={`font-mono font-semibold ${
              liveChange && liveChange > 0 ? 'price-positive' :
              liveChange && liveChange < 0 ? 'price-negative' : 'text-muted-foreground'
            }`}>
              {liveChange !== undefined ? formatPercent(liveChange) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Calculator */}
      <div className="glass-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Calculadora de rendimiento</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">
              Precio manual (opcional)
            </label>
            <input
              type="number"
              value={manualPrice}
              onChange={(e) => setManualPrice(e.target.value)}
              placeholder={currentMarketPrice > 0 ? currentMarketPrice.toFixed(2) : '0.00'}
              className="w-full bg-muted border border-border rounded-md px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">
              Comisión (%)
            </label>
            <input
              type="number"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              placeholder="0"
              className="w-full bg-muted border border-border rounded-md px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {result && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ResultCard label="TNA" value={formatPercent(result.tna)} />
            {'tem' in result && <ResultCard label="TEM" value={formatPercent((result as any).tem)} />}
            <ResultCard label="TEA" value={formatPercent(result.tea)} />
            <ResultCard label="Retorno neto" value={formatPercent(result.netReturn)} />
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-secondary/50 rounded-lg p-4 text-center">
      <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">{label}</span>
      <span className="text-lg font-mono font-bold text-primary">{value}</span>
    </div>
  );
}
