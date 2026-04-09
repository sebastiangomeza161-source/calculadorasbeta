import { useNavigate } from 'react-router-dom';
import { Instrument } from '@/data/instruments';
import { daysUntil, calcLecap, calcCer, formatPercent } from '@/lib/calculations';
import { useHolidays } from '@/hooks/useHolidays';

interface EnrichedInstrument extends Instrument {
  marketPrice?: number;
  change?: number | null;
  hasManualPrice?: boolean;
}

interface InstrumentTableProps {
  instruments: EnrichedInstrument[];
  lastCER?: number;
  manualPrices: Record<string, string>;
  onManualPriceChange: (ticker: string, value: string) => void;
}

export default function InstrumentTable({ instruments, lastCER, manualPrices, onManualPriceChange }: InstrumentTableProps) {
  const navigate = useNavigate();
  const { holidayDatesSet } = useHolidays();
  const isLecap = instruments[0]?.type === 'LECAP';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground text-[11px] uppercase tracking-wider font-medium">
            <th className="text-left py-3 px-4">Ticker</th>
            <th className="text-right py-3 px-4">Vto</th>
            <th className="text-right py-3 px-4">Días</th>
            <th className="text-right py-3 px-4">Precio</th>
            <th className="text-right py-3 px-4">Manual</th>
            <th className="text-right py-3 px-4">Var %</th>
            {isLecap ? (
              <>
                <th className="text-right py-3 px-4">TNA</th>
                <th className="text-right py-3 px-4">TEA</th>
                <th className="text-right py-3 px-4">TEM</th>
              </>
            ) : (
              <>
                <th className="text-right py-3 px-4">TNA 180</th>
                <th className="text-right py-3 px-4">TIR Real</th>
              </>
            )}
            <th className="text-right py-3 px-4 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {instruments.map((inst) => {
            const price = inst.marketPrice ?? 0;
            const days = daysUntil(inst.maturityDate, 1, holidayDatesSet);
            let tna = '--';
            let secondary1 = '--';
            let secondary2 = '--';

            if (price > 0) {
              if (isLecap && inst.redemptionValue) {
                const r = calcLecap(price, inst.maturityDate, inst.redemptionValue);
                if (r) {
                  tna = formatPercent(r.tna);
                  secondary1 = formatPercent(r.tea);
                  secondary2 = formatPercent(r.tem);
                }
              } else if (!isLecap && inst.cerInicial && lastCER && lastCER > 0) {
                const r = calcCer(price, inst.maturityDate, inst.cerInicial, lastCER);
                if (r) {
                  tna = formatPercent(r.tna180);
                  secondary1 = formatPercent(r.tir);
                }
              }
            }

            const [y, m, d] = inst.maturityDate.split('-').map(Number);
            const maturityShort = new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });

            const manualVal = manualPrices[inst.ticker] ?? '';

            return (
              <tr
                key={inst.ticker}
                className="table-row-hover border-b border-border/30"
              >
                <td
                  className="py-3 px-4 font-mono text-xs font-semibold text-ticker cursor-pointer"
                  onClick={() => navigate(`/instrument/${inst.ticker}`)}
                >
                  {inst.ticker}
                </td>
                <td className="py-3 px-4 font-mono text-xs text-right text-muted-foreground">
                  {maturityShort}
                </td>
                <td className="py-3 px-4 font-mono text-xs text-right text-muted-foreground">
                  {days}
                </td>
                <td className="py-3 px-4 font-mono text-xs text-right font-medium">
                  {price > 0 ? `$${price.toFixed(2)}` : '—'}
                </td>
                <td className="py-1 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="number"
                    value={manualVal}
                    onChange={(e) => onManualPriceChange(inst.ticker, e.target.value)}
                    placeholder="—"
                    step="0.01"
                    className="w-20 bg-transparent border border-border/40 rounded px-2 py-1 text-xs font-mono text-right text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent/60 transition-colors"
                  />
                </td>
                <td className={`py-3 px-4 font-mono text-xs text-right font-semibold ${
                  inst.change != null && inst.change > 0 ? 'price-positive' :
                  inst.change != null && inst.change < 0 ? 'price-negative' : 'text-muted-foreground'
                }`}>
                  {inst.change != null ? `${inst.change > 0 ? '+' : ''}${inst.change.toFixed(2)}%` : '—'}
                </td>
                <td className="py-3 px-4 font-mono text-xs text-right font-medium">
                  {tna}
                </td>
                <td className="py-3 px-4 font-mono text-xs text-right font-medium">
                  {secondary1}
                </td>
                {isLecap && (
                  <td className="py-3 px-4 font-mono text-xs text-right font-medium">
                    {secondary2}
                  </td>
                )}
                <td
                  className="py-3 px-4 text-right text-muted-foreground cursor-pointer"
                  onClick={() => navigate(`/instrument/${inst.ticker}`)}
                >
                  <span className="text-xs">→</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
