import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Instrument, LECAPS, CER_INSTRUMENTS } from '@/data/instruments';
import { supabase } from '@/integrations/supabase/client';
import { X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  type: 'LECAP' | 'CER';
  onAdd: (inst: Instrument) => void;
  existingTickers: string[];
}

interface Data912Item {
  symbol: string;
  c: number;
  maturity_date?: string;
  px_bid?: number;
  px_ask?: number;
}

type Step = 'input' | 'loading' | 'found' | 'not_found' | 'manual_fill';

export default function AddInstrumentModal({ open, onClose, type, onAdd, existingTickers }: Props) {
  const [ticker, setTicker] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [data912, setData912] = useState<Data912Item | null>(null);
  const [error, setError] = useState('');

  // Manual fill fields
  const [maturityDate, setMaturityDate] = useState('');
  const [redemptionValue, setRedemptionValue] = useState('');
  const [cerInicial, setCerInicial] = useState('');

  const reset = () => {
    setTicker('');
    setStep('input');
    setData912(null);
    setError('');
    setMaturityDate('');
    setRedemptionValue('');
    setCerInicial('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const allExisting = [
    ...LECAPS.map(i => i.ticker),
    ...CER_INSTRUMENTS.map(i => i.ticker),
    ...existingTickers,
  ];

  const handleSearch = async () => {
    const t = ticker.trim().toUpperCase();
    if (!t) return;

    if (allExisting.includes(t)) {
      setError('Este ticker ya existe en la tabla.');
      return;
    }

    setError('');
    setStep('loading');

    try {
      // Use the edge function to look up the ticker in data912
      const { data, error: fnError } = await supabase.functions.invoke('fetch-prices', {
        body: { lookupTicker: t },
      });

      if (fnError) throw fnError;

      const priceData = data?.prices?.[t];
      if (priceData && priceData.price > 0) {
        setData912({
          symbol: t,
          c: priceData.price,
          maturity_date: priceData.maturity_date || undefined,
          px_bid: priceData.bid,
          px_ask: priceData.ask,
        });

        // Check if we need manual fields
        const needsManual =
          !priceData.maturity_date ||
          (type === 'LECAP' && !redemptionValue) ||
          (type === 'CER' && !cerInicial);

        setStep(needsManual ? 'manual_fill' : 'found');
        if (priceData.maturity_date) setMaturityDate(priceData.maturity_date);
      } else {
        setStep('not_found');
      }
    } catch (e) {
      console.error('Error looking up ticker:', e);
      setStep('not_found');
    }
  };

  const handleAdd = () => {
    const t = ticker.trim().toUpperCase();
    const mat = maturityDate || data912?.maturity_date;

    if (!mat) {
      setError('Fecha de vencimiento requerida.');
      return;
    }

    const inst: Instrument = {
      ticker: t,
      name: `${type} ${t}`,
      type,
      maturityDate: mat,
      emissionDate: new Date().toISOString().split('T')[0],
      settlementDefault: 1,
      active: true,
      ...(type === 'LECAP' && redemptionValue ? { redemptionValue: parseFloat(redemptionValue) } : {}),
      ...(type === 'CER' && cerInicial ? { cerInicial: parseFloat(cerInicial) } : {}),
    };

    onAdd(inst);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            Agregar {type}
            <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Ticker input */}
          <div>
            <label className="text-[10px] text-muted-foreground font-mono uppercase block mb-1.5">
              Ticker
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={ticker}
                onChange={(e) => {
                  setTicker(e.target.value.toUpperCase());
                  if (step !== 'input') setStep('input');
                  setError('');
                }}
                placeholder="Ej: S15Y6"
                className="input-field flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                onClick={handleSearch}
                disabled={!ticker.trim() || step === 'loading'}
                className="tab-button tab-button-active text-xs px-4 disabled:opacity-40"
              >
                Buscar
              </button>
            </div>
            {error && <p className="text-[10px] text-destructive mt-1">{error}</p>}
          </div>

          {/* Loading */}
          {step === 'loading' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Buscando en Data912...
            </div>
          )}

          {/* Found */}
          {(step === 'found' || step === 'manual_fill') && data912 && (
            <div className="terminal-card p-3 space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle className="w-4 h-4 text-positive" />
                <span className="text-positive font-mono">Encontrado en Data912</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground text-[10px] font-mono uppercase block">Precio</span>
                  <span className="font-mono font-semibold">${data912.c.toFixed(2)}</span>
                </div>
                {data912.maturity_date && (
                  <div>
                    <span className="text-muted-foreground text-[10px] font-mono uppercase block">Vencimiento</span>
                    <span className="font-mono">{data912.maturity_date}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Not found */}
          {step === 'not_found' && (
            <div className="terminal-card p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <span className="text-destructive font-mono">No encontrado en Data912</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                El ticker no está disponible en Data912. No se podrá obtener precio automático.
              </p>
            </div>
          )}

          {/* Manual fields when needed */}
          {(step === 'manual_fill' || step === 'not_found' || step === 'found') && (
            <div className="space-y-3">
              <h3 className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                {step === 'not_found' ? 'Datos manuales' : 'Completar datos faltantes'}
              </h3>

              {!data912?.maturity_date && (
                <div>
                  <label className="text-[10px] text-muted-foreground font-mono uppercase block mb-1.5">
                    Fecha de vencimiento *
                  </label>
                  <input
                    type="date"
                    value={maturityDate}
                    onChange={(e) => setMaturityDate(e.target.value)}
                    className="input-field"
                  />
                </div>
              )}

              {type === 'LECAP' && (
                <div>
                  <label className="text-[10px] text-muted-foreground font-mono uppercase block mb-1.5">
                    Valor al vencimiento
                  </label>
                  <input
                    type="number"
                    value={redemptionValue}
                    onChange={(e) => setRedemptionValue(e.target.value)}
                    placeholder="Ej: 127.486"
                    step="0.001"
                    className="input-field"
                  />
                </div>
              )}

              {type === 'CER' && (
                <div>
                  <label className="text-[10px] text-muted-foreground font-mono uppercase block mb-1.5">
                    CER inicial
                  </label>
                  <input
                    type="number"
                    value={cerInicial}
                    onChange={(e) => setCerInicial(e.target.value)}
                    placeholder="Ej: 701.614"
                    step="0.0001"
                    className="input-field"
                  />
                </div>
              )}

              <button
                onClick={handleAdd}
                className="w-full tab-button tab-button-active text-xs py-2.5 mt-2"
              >
                Agregar a la tabla
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
