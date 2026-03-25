import { useNavigate } from 'react-router-dom';
import { Instrument } from '@/data/instruments';
import { daysUntil, formatDate } from '@/lib/calculations';

interface EnrichedInstrument extends Instrument {
  change?: number;
}

interface InstrumentTableProps {
  instruments: EnrichedInstrument[];
}

export default function InstrumentTable({ instruments }: InstrumentTableProps) {
  const navigate = useNavigate();

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
            <th className="text-left py-3 px-4">Ticker</th>
            <th className="text-left py-3 px-4">Nombre</th>
            <th className="text-right py-3 px-4">Vencimiento</th>
            <th className="text-right py-3 px-4">Días</th>
            <th className="text-right py-3 px-4">Precio</th>
            <th className="text-right py-3 px-4">Var %</th>
          </tr>
        </thead>
        <tbody>
          {instruments.map((inst) => (
            <tr
              key={inst.ticker}
              className="table-row-hover border-b border-border/50"
              onClick={() => navigate(`/instrument/${inst.ticker}`)}
            >
              <td className="py-3 px-4 font-mono text-sm font-semibold text-accent">
                {inst.ticker}
              </td>
              <td className="py-3 px-4 text-sm text-secondary-foreground">
                {inst.name}
              </td>
              <td className="py-3 px-4 font-mono text-sm text-right text-muted-foreground">
                {formatDate(inst.maturityDate)}
              </td>
              <td className="py-3 px-4 font-mono text-sm text-right text-muted-foreground">
                {daysUntil(inst.maturityDate)}
              </td>
              <td className="py-3 px-4 font-mono text-sm text-right font-medium">
                {inst.marketPrice > 0 ? `$${inst.marketPrice.toFixed(2)}` : '—'}
              </td>
              <td className={`py-3 px-4 font-mono text-sm text-right font-medium ${
                inst.change && inst.change > 0 ? 'price-positive' :
                inst.change && inst.change < 0 ? 'price-negative' : 'text-muted-foreground'
              }`}>
                {inst.change !== undefined ? `${inst.change > 0 ? '+' : ''}${inst.change.toFixed(2)}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
