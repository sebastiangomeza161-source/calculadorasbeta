import { useNavigate } from 'react-router-dom';
import { Instrument } from '@/data/instruments';
import { daysUntil, calcLecap, calcCer, formatPercent } from '@/lib/calculations';

interface EnrichedInstrument extends Instrument {
  marketPrice?: number;
  change?: number | null;
}

interface InstrumentTableProps {
  instruments: EnrichedInstrument[];
  lastCER?: number;
}

export default function InstrumentTable({ instruments, lastCER }: InstrumentTableProps) {
  const navigate = useNavigate();
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
            const days = daysUntil(inst.maturityDate);
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

            const maturityShort = new Date(inst.maturityDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });

            return (
              <tr
                key={inst.ticker}
                className="table-row-hover border-b border-border/30"
                onClick={() => navigate(`/instrument/${inst.ticker}`)}
              >
                <td className="py-3 px-4 font-mono text-xs font-semibold text-ticker">
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
                <td className="py-3 px-4 text-right text-muted-foreground">
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
