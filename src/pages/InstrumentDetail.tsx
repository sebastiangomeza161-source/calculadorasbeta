import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInstrument } from '@/data/instruments';
import { useLivePrices } from '@/hooks/useLivePrices';
import { useCER } from '@/hooks/useCER';
import { useAdvancedMode } from '@/hooks/useAdvancedMode';
import { useMaturityOverrides } from '@/hooks/useMaturityOverrides';
import { calcLecap, calcCer, formatPercent, formatDate, daysUntil } from '@/lib/calculations';
import { ArrowLeft, Pencil, Check, X } from 'lucide-react';

export default function InstrumentDetail() {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const instrument = getInstrument(ticker || '');
  const { data: livePrices } = useLivePrices();
  const { data: cerData } = useCER();
  const { isAdvanced } = useAdvancedMode();
  const { getEffectiveMaturity, saveOverride } = useMaturityOverrides();

  const livePrice = livePrices?.prices[ticker || '']?.price ?? 0;
  const liveChange = livePrices?.prices[ticker || '']?.change ?? null;

  const [manualPrice, setManualPrice] = useState('');
  const [tPlus, setTPlus] = useState('1');
  const [commission, setCommission] = useState('0');
  const [manualCER, setManualCER] = useState('');
  const [cerAutoFilled, setCerAutoFilled] = useState(false);

  // Maturity editing state
  const [editingMaturity, setEditingMaturity] = useState(false);
  const [maturityInput, setMaturityInput] = useState('');

  const effectiveMaturity = instrument ? getEffectiveMaturity(instrument.ticker, instrument.maturityDate) : '';

  // Auto-fill CER from BCRA when available
  useEffect(() => {
    if (cerData?.cer && cerData.cer > 0 && !manualCER && !cerAutoFilled) {
      setManualCER(cerData.cer.toString());
      setCerAutoFilled(true);
    }
  }, [cerData, manualCER, cerAutoFilled]);

  const activePrice = manualPrice ? parseFloat(manualPrice) : livePrice;
  const activeTPlus = parseInt(tPlus) || 1;
  const activeCommission = parseFloat(commission) || 0;
  const activeCER = manualCER ? parseFloat(manualCER) : 0;

  const isCER = instrument?.type === 'CER';

  const result = useMemo(() => {
    if (!instrument || activePrice <= 0) return null;

    if (instrument.type === 'LECAP' && instrument.redemptionValue) {
      return {
        type: 'LECAP' as const,
        ...calcLecap(activePrice, effectiveMaturity, instrument.redemptionValue, activeTPlus, activeCommission)!,
      };
    }

    if (instrument.type === 'CER' && instrument.cerInicial && activeCER > 0) {
      return {
        type: 'CER' as const,
        ...calcCer(activePrice, effectiveMaturity, instrument.cerInicial, activeCER, activeTPlus, activeCommission)!,
      };
    }

    return null;
  }, [instrument, activePrice, activeTPlus, activeCommission, activeCER, effectiveMaturity]);

  if (!instrument) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Instrumento no encontrado</p>
      </div>
    );
  }

  const days = daysUntil(effectiveMaturity, activeTPlus);

  const handleStartEdit = () => {
    setMaturityInput(effectiveMaturity);
    setEditingMaturity(true);
  };

  const handleSaveMaturity = () => {
    if (maturityInput && maturityInput !== effectiveMaturity) {
      saveOverride.mutate({ ticker: instrument.ticker, maturityDate: maturityInput });
    }
    setEditingMaturity(false);
  };

  const handleCancelEdit = () => {
    setEditingMaturity(false);
    setMaturityInput('');
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card px-4 md:px-8 py-4 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Volver</span>
        </button>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
          <span>Precio: data912</span>
          {isCER && <span>· CER: {cerData?.source === 'bcra_api' ? 'BCRA' : cerData?.source?.startsWith('cached') ? 'BCRA (cache)' : 'manual'}</span>}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">
        {/* Instrument Info */}
        <div className="terminal-card p-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h1 className="text-2xl font-bold font-mono text-accent">{instrument.ticker}</h1>
              <p className="text-muted-foreground text-sm mt-1">{instrument.name}</p>
            </div>
            <span className="px-3 py-1.5 rounded-md text-xs font-semibold bg-secondary text-secondary-foreground">
              {instrument.type}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground block mb-1 text-[10px] font-mono uppercase tracking-wider">Vencimiento</span>
              <div className="flex items-center gap-1.5">
                {editingMaturity ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      value={maturityInput}
                      onChange={(e) => setMaturityInput(e.target.value)}
                      className="input-field text-xs py-0.5 px-1.5 w-36"
                    />
                    <button onClick={handleSaveMaturity} className="text-positive hover:opacity-80" title="Guardar">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={handleCancelEdit} className="text-destructive hover:opacity-80" title="Cancelar">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="font-mono text-sm font-medium">{formatDate(effectiveMaturity)}</span>
                    {isAdvanced && (
                      <button onClick={handleStartEdit} className="text-muted-foreground hover:text-foreground transition-colors" title="Editar vencimiento">
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            <InfoCell label="Días al vto" value={String(days)} />
            <InfoCell label="Duration" value={`${(days / 365).toFixed(2)}y`} />
            <InfoCell
              label="Precio mercado"
              value={livePrice > 0 ? `$${livePrice.toFixed(2)}` : 'Sin datos'}
            />
            {instrument.type === 'LECAP' && instrument.redemptionValue && (
              <InfoCell label="Pago al vto" value={`$${instrument.redemptionValue.toFixed(3)}`} />
            )}
            {isCER && instrument.cerInicial && (
              <InfoCell label="CER inicial" value={instrument.cerInicial.toFixed(4)} />
            )}
            <div>
              <span className="text-muted-foreground block mb-1 text-[10px] font-mono uppercase tracking-wider">Var %</span>
              <span className={`font-mono font-semibold text-sm ${
                liveChange != null && liveChange > 0 ? 'price-positive' :
                liveChange != null && liveChange < 0 ? 'price-negative' : 'text-muted-foreground'
              }`}>
                {liveChange != null ? formatPercent(liveChange) : '—'}
              </span>
            </div>
            {livePrices?.timestamp && (
              <InfoCell
                label="Última actualización"
                value={new Date(livePrices.timestamp).toLocaleString('es-AR', {
                  hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short',
                })}
              />
            )}
          </div>
        </div>

        {/* Calculator Inputs */}
        <div className="terminal-card p-5">
          <h2 className="text-sm font-semibold mb-4 uppercase tracking-wider text-muted-foreground">
            Calculadora
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <div>
              <label className="text-[10px] text-muted-foreground font-mono uppercase block mb-1.5">
                Precio manual
              </label>
              <input
                type="number"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                placeholder={livePrice > 0 ? livePrice.toFixed(2) : '0.00'}
                className="input-field"
                step="0.01"
              />
              <span className="text-[9px] text-muted-foreground mt-1 block">
                {manualPrice ? 'Usando precio manual' : 'Usando precio de mercado'}
              </span>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground font-mono uppercase block mb-1.5">
                T+
              </label>
              <input
                type="number"
                value={tPlus}
                onChange={(e) => setTPlus(e.target.value)}
                placeholder="1"
                min="0"
                max="5"
                className="input-field"
              />
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground font-mono uppercase block mb-1.5">
                Comisión (TNA %)
              </label>
              <input
                type="number"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                placeholder="0"
                step="0.1"
                className="input-field"
              />
            </div>

            {isCER && (
              <div>
                <label className="text-[10px] text-muted-foreground font-mono uppercase block mb-1.5">
                  CER usado
                </label>
                <input
                  type="number"
                  value={manualCER}
                  onChange={(e) => setManualCER(e.target.value)}
                  placeholder="Ej: 716.45"
                  step="0.0001"
                  className="input-field"
                />
                <span className="text-[9px] text-muted-foreground mt-1 block">
                  {cerAutoFilled ? `Auto: BCRA (${cerData?.cerDate})` : 'CER inicial:'} {!cerAutoFilled && instrument.cerInicial?.toFixed(4)}
                </span>
              </div>
            )}
          </div>

          {activePrice <= 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-md px-4 py-3 text-xs text-destructive">
              Ingresá un precio válido para calcular las métricas.
            </div>
          )}

          {isCER && activeCER <= 0 && activePrice > 0 && (
            <div className="bg-primary/10 border border-primary/30 rounded-md px-4 py-3 text-xs text-primary">
              No se pudo obtener el CER automáticamente. Ingresá el valor de CER actual para calcular las métricas.
            </div>
          )}

          {result && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-5">
              {result.type === 'LECAP' ? (
                <>
                  <MetricCard label="TNA" value={formatPercent(result.tna)} highlight />
                  <MetricCard label="TEA / TIR" value={formatPercent(result.tea)} />
                  <MetricCard label="TEM" value={formatPercent(result.tem)} />
                  <MetricCard label="Retorno total" value={formatPercent(result.totalReturn)} />
                  <MetricCard label="Días al vto" value={String(result.days)} />
                  <MetricCard label="Duration" value={`${result.duration.toFixed(2)}y`} />
                </>
              ) : (
                <>
                  <MetricCard label="TNA (180/360)" value={formatPercent(result.tna180)} highlight />
                  <MetricCard label="TIR Real" value={formatPercent(result.tir)} />
                  <MetricCard label="CER usado" value={activeCER.toFixed(4)} />
                  <MetricCard label="CER inicial" value={instrument.cerInicial?.toFixed(4) ?? '--'} />
                  <MetricCard label="Días al vto" value={String(result.days)} />
                  <MetricCard label="Duration" value={`${result.duration.toFixed(2)}y`} />
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
      <span className="text-muted-foreground block mb-1 text-[10px] font-mono uppercase tracking-wider">{label}</span>
      <span className="font-mono text-sm font-medium">{value}</span>
    </div>
  );
}

function MetricCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`metric-card ${highlight ? 'border border-accent/30' : ''}`}>
      <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider block mb-1.5">{label}</span>
      <span className={`text-lg font-mono font-bold ${highlight ? 'text-accent' : ''}`}>{value}</span>
    </div>
  );
}
