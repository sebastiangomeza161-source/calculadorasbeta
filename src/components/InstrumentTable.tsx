import { useNavigate } from 'react-router-dom';
import { Instrument } from '@/data/instruments';
import { daysUntil, formatDate, calcLecap, calcBoncer, formatPercent } from '@/lib/calculations';

interface EnrichedInstrument extends Instrument {
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
            <th className="text-left py-2.5 px-3">Ticker</th>
            <th className="text-right py-2.5 px-3">Vto</th>
            <th className="text-right py-2.5 px-3">Días</th>
            <th className="text-right py-2.5 px-3">Precio</th>
            <th className="text-right py-2.5 px-3">Var %</th>
            {isLecap ? (
              <>
                <th className="text-right py-2.5 px-3">TNA</th>
                <th className="text-right py-2.5 px-3">TEM</th>
                <th className="text-right py-2.5 px-3">TEA</th>
              </>
            ) : (
              <>
                <th className="text-right py-2.5 px-3">TNA 180</th>
                <th className="text-right py-2.5 px-3">TIR</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {instruments.map((inst) => {
            const days = daysUntil(inst.maturityDate);
            let metrics: { tna?: number; tem?: number; tea?: number; tna180?: number; tir?: number } = {};

            if (inst.marketPrice > 0) {
              if (isLecap && inst.payment) {
                const r = calcLecap(inst.marketPrice, inst.maturityDate, inst.payment);
                metrics = { tna: r.tna, tem: r.tem, tea: r.tea };
              } else if (!isLecap && inst.cerInicial && lastCER) {
                const r = calcBoncer(inst.marketPrice, inst.maturityDate, inst.cerInicial, lastCER);
                metrics = { tna180: r.tna180, tir: r.tir };
              }
            }

            return (
              <tr
                key={inst.ticker}
                className="table-row-hover border-b border-border/40"
                onClick={() => navigate(`/instrument/${inst.ticker}`)}
              >
                <td className="py-2.5 px-3 font-mono text-xs font-semibold text-accent">
                  {inst.ticker}
                </td>
                <td className="py-2.5 px-3 font-mono text-xs text-right text-muted-foreground">
                  {formatDate(inst.maturityDate)}
                </td>
                <td className="py-2.5 px-3 font-mono text-xs text-right text-muted-foreground">
                  {days}
                </td>
                <td className="py-2.5 px-3 font-mono text-xs text-right font-medium">
                  {inst.marketPrice > 0 ? `$${inst.marketPrice.toFixed(2)}` : '—'}
                </td>
                <td className={`py-2.5 px-3 font-mono text-xs text-right font-semibold ${
                  inst.change != null && inst.change > 0 ? 'price-positive' :
                  inst.change != null && inst.change < 0 ? 'price-negative' : 'text-muted-foreground'
                }`}>
                  {inst.change != null ? `${inst.change > 0 ? '+' : ''}${inst.change.toFixed(2)}%` : '—'}
                </td>
                {isLecap ? (
                  <>
                    <td className="py-2.5 px-3 font-mono text-xs text-right font-medium">
                      {metrics.tna ? formatPercent(metrics.tna) : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-right font-medium">
                      {metrics.tem ? formatPercent(metrics.tem) : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-right font-medium">
                      {metrics.tea ? formatPercent(metrics.tea) : '—'}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2.5 px-3 font-mono text-xs text-right font-medium">
                      {metrics.tna180 ? formatPercent(metrics.tna180) : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-right font-medium">
                      {metrics.tir ? formatPercent(metrics.tir) : '—'}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
