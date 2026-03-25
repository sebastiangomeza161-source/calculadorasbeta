import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInstrument } from '@/data/instruments';
import { useLivePrices } from '@/hooks/useLivePrices';
import { calcLecap, calcBoncer, formatPercent, formatDate, daysUntil } from '@/lib/calculations';
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
  const lastCER = 720; // TODO: fetch from external source

  const result = useMemo(() => {
    if (!instrument || activePrice <= 0) return null;
    const comm = parseFloat(commission) || 0;
    if (instrument.type === 'LECAP' && instrument.payment) {
      return { type: 'LECAP' as const, ...calcLecap(activePrice, instrument.maturityDate, instrument.payment, comm) };
    }
    if (instrument.type === 'BONCER' && instrument.cerInicial) {
      return { type: 'BONCER' as const, ...calcBoncer(activePrice, instrument.maturityDate, instrument.cerInicial, lastCER, comm) };
    }
    return null;
  }, [instrument, activePrice, commission, lastCER]);

  if (!instrument) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Instrumento no encontrado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card px-4 md:px-8 py-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-mono">Volver</span>
        </button>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6">
        {/* Header card */}
        <div className="terminal-card p-5 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold font-mono">{instrument.ticker}</h1>
              <p className="text-muted-foreground text-xs mt-0.5">{instrument.name}</p>
            </div>
            <span className="px-2.5 py-1 rounded text-[10px] font-mono font-semibold uppercase bg-secondary text-secondary-foreground">
              {instrument.type}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
            <InfoCell label="Vencimiento" value={formatDate(instrument.maturityDate)} />
            <InfoCell label="Días" value={String(daysUntil(instrument.maturityDate))} />
            <InfoCell label="Precio" value={currentMarketPrice > 0 ? `$${currentMarketPrice.toFixed(2)}` : '...'} />
            {instrument.type === 'LECAP' && instrument.payment && (
              <InfoCell label="Pago al vto" value={`$${instrument.payment.toFixed(3)}`} />
            )}
            <div>
              <span className="text-muted-foreground block mb-0.5 font-mono uppercase tracking-wider text-[10px]">Var %</span>
              <span className={`font-mono font-semibold ${
                liveChange != null && liveChange > 0 ? 'price-positive' :
                liveChange != null && liveChange < 0 ? 'price-negative' : 'text-muted-foreground'
              }`}>
                {liveChange != null ? formatPercent(liveChange) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Calculator */}
        <div className="terminal-card p-5 mb-4">
          <h2 className="text-sm font-semibold font-mono mb-4 uppercase tracking-wider">Calculadora</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            <div>
              <label className="text-[10px] text-muted-foreground font-mono uppercase block mb-1">
                Precio manual
              </label>
              <input
                type="number"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                placeholder={currentMarketPrice > 0 ? currentMarketPrice.toFixed(2) : '0.00'}
                className="w-full bg-muted border border-border rounded px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-mono uppercase block mb-1">
                Comisión (TNA)
              </label>
              <input
                type="number"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                placeholder="0"
                step="0.1"
                className="w-full bg-muted border border-border rounded px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {result && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {result.type === 'LECAP' ? (
                <>
                  <MetricCard label="TNA" value={formatPercent(result.tna)} />
                  <MetricCard label="TEM" value={formatPercent(result.tem)} />
                  <MetricCard label="TEA" value={formatPercent(result.tea)} />
                  <MetricCard label="Retorno" value={formatPercent(result.totalReturn)} />
                </>
              ) : (
                <>
                  <MetricCard label="TNA 180/360" value={formatPercent(result.tna180)} />
                  <MetricCard label="TIR" value={formatPercent(result.tir)} />
                  <MetricCard label="Duration" value={`${result.duration.toFixed(2)}y`} />
                  <MetricCard label="Retorno" value={formatPercent(result.totalReturn)} />
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground block mb-0.5 font-mono uppercase tracking-wider text-[10px]">{label}</span>
      <span className="font-mono text-sm font-medium">{value}</span>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted rounded p-3 text-center">
      <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider block mb-1">{label}</span>
      <span className="text-base font-mono font-bold">{value}</span>
    </div>
  );
}
