import { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Line, ComposedChart,
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

// Logarithmic regression: y = a + b * ln(x)
function logTrendLine(points: DataPoint[], steps = 50): { duration: number; yield: number }[] {
  if (points.length < 2) return [];

  const valid = points.filter(p => p.duration > 0);
  if (valid.length < 2) return [];

  const n = valid.length;
  const sumLnX = valid.reduce((s, p) => s + Math.log(p.duration), 0);
  const sumY = valid.reduce((s, p) => s + p.yield, 0);
  const sumLnX2 = valid.reduce((s, p) => s + Math.log(p.duration) ** 2, 0);
  const sumLnXY = valid.reduce((s, p) => s + Math.log(p.duration) * p.yield, 0);

  const denom = n * sumLnX2 - sumLnX ** 2;
  if (Math.abs(denom) < 1e-10) return [];

  const b = (n * sumLnXY - sumLnX * sumY) / denom;
  const a = (sumY - b * sumLnX) / n;

  const minD = Math.min(...valid.map(p => p.duration));
  const maxD = Math.max(...valid.map(p => p.duration));
  const stepSize = (maxD - minD) / (steps - 1);

  return Array.from({ length: steps }, (_, i) => {
    const dur = minD + i * stepSize;
    return { duration: dur, yield: a + b * Math.log(dur) };
  });
}

export default function YieldCurve({ data, yLabel }: Props) {
  const sorted = useMemo(() => [...data].sort((a, b) => a.duration - b.duration), [data]);
  const trend = useMemo(() => logTrendLine(sorted), [sorted]);

  if (sorted.length === 0) return null;

  const allYields = [...sorted.map(d => d.yield), ...trend.map(d => d.yield)];
  const yMin = Math.floor(Math.min(...allYields) - 2);
  const yMax = Math.ceil(Math.max(...allYields) + 2);

  return (
    <div className="terminal-card p-4 mt-4">
      <h3 className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mb-3">
        Curva de rendimiento · {yLabel}
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
          <XAxis
            dataKey="duration"
            type="number"
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
          {/* Trend line */}
          {trend.length > 0 && (
            <Line
              data={trend}
              dataKey="yield"
              stroke="hsl(35 95% 45%)"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
              isAnimationActive={false}
              name="Tendencia"
            />
          )}
          {/* Data points */}
          <Scatter
            data={sorted}
            fill="hsl(35 95% 55%)"
            strokeWidth={0}
            // @ts-ignore - recharts accepts r prop
            r={5}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
