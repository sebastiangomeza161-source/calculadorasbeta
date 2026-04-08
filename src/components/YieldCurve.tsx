import { useMemo, useState, useCallback } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Line, ComposedChart, Cell,
} from 'recharts';

interface DataPoint {
  ticker: string;
  price: number;
  days: number;
  duration: number;
  yield: number;
  isManual?: boolean;
}

interface Props {
  data: DataPoint[];
  yLabel: string;
}

function CustomTooltip({ active, payload, hoveredPoint }: any) {
  // Use the explicitly hovered point if available
  const d = hoveredPoint || (active && payload?.[0]?.payload);
  if (!d?.ticker) return null;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 text-xs font-mono shadow-lg">
      <div className="font-semibold mb-1" style={{ color: d.isManual ? 'hsl(200 80% 55%)' : 'hsl(35 95% 55%)' }}>
        {d.ticker}
        {d.isManual && <span className="ml-1.5 text-[9px] text-muted-foreground">(manual)</span>}
      </div>
      <div className="space-y-0.5 text-muted-foreground">
        <div>Precio: <span className="text-foreground">${d.price?.toFixed(2) ?? '—'}</span></div>
        <div>Días: <span className="text-foreground">{d.days ?? '—'}</span></div>
        <div>Duration: <span className="text-foreground">{d.duration?.toFixed(2) ?? '—'}</span></div>
        <div>Yield: <span className="text-foreground">{d.yield?.toFixed(2) ?? '—'}%</span></div>
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

function MarketDot(props: any) {
  const { cx, cy, onDotEnter, onDotLeave, payload } = props;
  if (cx == null || cy == null) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill="hsl(35 95% 55%)"
      stroke="none"
      style={{ cursor: 'pointer' }}
      onMouseEnter={() => onDotEnter?.(payload)}
      onMouseLeave={() => onDotLeave?.()}
    />
  );
}

function ManualDot(props: any) {
  const { cx, cy, onDotEnter, onDotLeave, payload } = props;
  if (cx == null || cy == null) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill="hsl(200 80% 55%)"
      stroke="hsl(200 80% 70%)"
      strokeWidth={1}
      style={{ cursor: 'pointer' }}
      onMouseEnter={() => onDotEnter?.(payload)}
      onMouseLeave={() => onDotLeave?.()}
    />
  );
}

export default function YieldCurve({ data, yLabel }: Props) {
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);

  const marketPoints = useMemo(() => data.filter(d => !d.isManual).sort((a, b) => a.duration - b.duration), [data]);
  const manualPoints = useMemo(() => data.filter(d => d.isManual).sort((a, b) => a.duration - b.duration), [data]);
  const trend = useMemo(() => logTrendLine(marketPoints), [marketPoints]);

  const handleDotEnter = useCallback((point: DataPoint) => setHoveredPoint(point), []);
  const handleDotLeave = useCallback(() => setHoveredPoint(null), []);

  if (data.length === 0) return null;

  const allYields = [...data.map(d => d.yield), ...trend.map(d => d.yield)];
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
          <Tooltip
            content={<CustomTooltip hoveredPoint={hoveredPoint} />}
            active={!!hoveredPoint}
            position={undefined}
          />
          {/* Trend line - only market points */}
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
          {/* Manual price points - render first so market dots are on top */}
          {manualPoints.length > 0 && (
            <Scatter
              data={manualPoints}
              fill="hsl(200 80% 55%)"
              name="Manual"
              shape={<ManualDot onDotEnter={handleDotEnter} onDotLeave={handleDotLeave} />}
            />
          )}
          {/* Market data points - on top */}
          <Scatter
            data={marketPoints}
            fill="hsl(35 95% 55%)"
            shape={<MarketDot onDotEnter={handleDotEnter} onDotLeave={handleDotLeave} />}
          />
        </ComposedChart>
      </ResponsiveContainer>
      {manualPoints.length > 0 && (
        <div className="flex items-center gap-4 mt-2 text-[9px] text-muted-foreground font-mono">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'hsl(35 95% 55%)' }} /> Mercado
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'hsl(200 80% 55%)' }} /> Manual
          </span>
        </div>
      )}
    </div>
  );
}