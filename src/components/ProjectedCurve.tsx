import { useMemo, useState, useCallback } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  ComposedChart, Line,
} from 'recharts';
import { type ProjectedCurvePoint, type InflationEntry } from '@/hooks/useProjectedCER';

// ─── Logarithmic trend ───
function logTrendLine(points: ProjectedCurvePoint[], steps = 50): { duration: number; yield: number }[] {
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

function ProjectedDot(props: any) {
  const { cx, cy, payload, onDotEnter, onDotLeave } = props;
  if (!payload?.ticker || cx == null || cy == null) return null;
  return (
    <g style={{ cursor: 'pointer' }}>
      <circle cx={cx} cy={cy} r={12} fill="transparent" pointerEvents="all"
        onMouseEnter={() => onDotEnter?.(payload, cx, cy)}
        onMouseMove={() => onDotEnter?.(payload, cx, cy)}
        onMouseLeave={() => onDotLeave?.()} />
      <circle cx={cx} cy={cy} r={5} fill="hsl(145 60% 42%)" stroke="hsl(var(--background))" strokeWidth={1.5} pointerEvents="none" />
    </g>
  );
}

interface Props {
  curvePoints: ProjectedCurvePoint[];
  inflation: InflationEntry[];
}

export default function ProjectedCurve({ curvePoints, inflation }: Props) {
  const [hoveredPoint, setHoveredPoint] = useState<ProjectedCurvePoint | null>(null);
  const [hoveredPos, setHoveredPos] = useState<{ x: number; y: number } | null>(null);

  const sorted = useMemo(() => [...curvePoints].sort((a, b) => a.duration - b.duration), [curvePoints]);
  const trend = useMemo(() => logTrendLine(sorted), [sorted]);

  const handleDotEnter = useCallback((point: ProjectedCurvePoint, x: number, y: number) => {
    setHoveredPoint(point);
    setHoveredPos({ x: x + 12, y: Math.max(y - 72, 12) });
  }, []);
  const handleDotLeave = useCallback(() => {
    setHoveredPoint(null);
    setHoveredPos(null);
  }, []);

  if (curvePoints.length === 0) return null;

  const allYields = [...curvePoints.map(d => d.yield), ...trend.map(d => d.yield)];
  const yMin = Math.floor(Math.min(...allYields) - 2);
  const yMax = Math.ceil(Math.max(...allYields) + 2);

  return (
    <div className="terminal-card p-4 mt-4">
      <h3 className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mb-1">
        Curva proyectada · TNA 180 con CER proyectado
      </h3>
      <p className="text-[9px] text-muted-foreground/70 font-mono mb-3">
        Curva proyectada basada en cálculos con inflación futura · Fuente: cálculo interno
      </p>
      <div className="relative">
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
                value: 'TNA 180 Proy.',
                angle: -90,
                position: 'insideLeft',
                offset: 0,
                style: { fontSize: 9, fill: 'hsl(220 10% 50%)' },
              }}
            />
            {trend.length > 0 && (
              <Line
                data={trend}
                dataKey="yield"
                stroke="hsl(145 50% 35%)"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                dot={false}
                isAnimationActive={false}
                name="Tendencia"
              />
            )}
            <Scatter
              data={sorted}
              fill="hsl(145 60% 42%)"
              shape={<ProjectedDot onDotEnter={handleDotEnter} onDotLeave={handleDotLeave} />}
            />
          </ComposedChart>
        </ResponsiveContainer>
        {hoveredPoint && hoveredPos && (
          <div
            className="absolute pointer-events-none z-50 rounded-md border border-border bg-card p-2 shadow-lg text-xs font-mono"
            style={{ left: hoveredPos.x, top: hoveredPos.y }}
          >
            <p className="font-semibold text-positive">{hoveredPoint.ticker}</p>
            <p className="text-muted-foreground">Duration: {hoveredPoint.duration.toFixed(2)}</p>
            <p className="text-foreground">TNA 180: {hoveredPoint.yield.toFixed(2)}%</p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-4 mt-2 text-[9px] text-muted-foreground font-mono">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'hsl(145 60% 42%)' }} /> Proyectado (inflación futura)
        </span>
      </div>

      {/* Read-only inflation table */}
      <div className="mt-6 border-t border-border/30 pt-4">
        <h4 className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mb-2">
          Inflación mensual utilizada en la proyección
        </h4>
        <p className="text-[9px] text-muted-foreground/60 font-mono mb-3">
          Tabla de referencia · Editable solo desde la vista experimental
        </p>
        <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Mes</th>
                <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Inflación mensual</th>
              </tr>
            </thead>
            <tbody>
              {inflation.map((row, i) => (
                <tr key={`${row.year}-${row.month}`} className="border-b border-border/20">
                  <td className="py-1.5 px-3 font-mono text-xs text-muted-foreground">{row.label}</td>
                  <td className="py-1.5 px-3 font-mono text-xs text-right">{(row.rate * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
