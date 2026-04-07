import { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts';

interface DataPoint {
  ticker: string;
  price: number;
  days: number;
  duration: number;
  yield: number;
}

interface Props {
  data: DataPoint[];
  yLabel: string;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload as DataPoint;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 text-xs font-mono shadow-lg">
      <div className="text-accent font-semibold mb-1">{d.ticker}</div>
      <div className="space-y-0.5 text-muted-foreground">
        <div>Precio: <span className="text-foreground">${d.price.toFixed(2)}</span></div>
        <div>Días: <span className="text-foreground">{d.days}</span></div>
        <div>Duration: <span className="text-foreground">{d.duration.toFixed(2)}</span></div>
        <div>Yield: <span className="text-foreground">{d.yield.toFixed(2)}%</span></div>
      </div>
    </div>
  );
}

export default function YieldCurve({ data, yLabel }: Props) {
  const sorted = useMemo(() => [...data].sort((a, b) => a.duration - b.duration), [data]);

  if (sorted.length === 0) return null;

  const yMin = Math.floor(Math.min(...sorted.map(d => d.yield)) - 2);
  const yMax = Math.ceil(Math.max(...sorted.map(d => d.yield)) + 2);

  return (
    <div className="terminal-card p-4 mt-4">
      <h3 className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mb-3">
        Curva de rendimiento · {yLabel}
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(220 15% 18%)"
          />
          <XAxis
            dataKey="duration"
            type="number"
            name="Duration"
            tick={{ fontSize: 10, fill: 'hsl(220 10% 50%)' }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(220 15% 18%)' }}
            label={{
              value: 'Duration (días/360)',
              position: 'bottom',
              offset: 5,
              style: { fontSize: 9, fill: 'hsl(220 10% 50%)' },
            }}
          />
          <YAxis
            dataKey="yield"
            type="number"
            domain={[yMin, yMax]}
            tick={{ fontSize: 10, fill: 'hsl(220 10% 50%)' }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(220 15% 18%)' }}
            tickFormatter={(v: number) => `${v}%`}
            label={{
              value: yLabel,
              angle: -90,
              position: 'insideLeft',
              offset: 0,
              style: { fontSize: 9, fill: 'hsl(220 10% 50%)' },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Scatter
            data={sorted}
            fill="hsl(35 95% 55%)"
            strokeWidth={0}
            r={5}
            line={{ stroke: 'hsl(35 95% 45%)', strokeWidth: 1.5, strokeDasharray: '4 2' }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
