"use client";

import { compactCurrency, formatDate } from "@/lib/format";

interface Point {
  date: string;
  value: number;
  invested?: number;
}

export function LineChart({ points }: { points: Point[] }) {
  if (points.length < 2) {
    return (
      <div className="chart-empty">
        <strong>O gráfico nasce com seus lançamentos.</strong>
        <span>Adicione uma compra para iniciar a linha de evolução da carteira.</span>
      </div>
    );
  }

  const width = 1000;
  const height = 330;
  const padding = 28;
  const values = points.flatMap((point) => [point.value, point.invested ?? point.value]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, max * 0.03, 1);
  const x = (index: number) => padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
  const y = (value: number) => height - padding - ((value - min) / spread) * (height - padding * 2);
  const valuePath = points.map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.value)}`).join(" ");
  const investedPath = points
    .map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.invested ?? point.value)}`)
    .join(" ");
  const last = points.at(-1)!;
  const first = points[0];

  return (
    <div className="line-chart-wrap">
      <div className="chart-caption">
        <div><span>Início</span><strong>{formatDate(first.date)}</strong></div>
        <div><span>Última atualização</span><strong>{formatDate(last.date)}</strong></div>
      </div>
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolução patrimonial">
        <defs>
          <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
          <line key={ratio} x1={padding} x2={width - padding} y1={height * ratio} y2={height * ratio} className="grid-line" />
        ))}
        <path d={`${valuePath} L${x(points.length - 1)},${height - padding} L${x(0)},${height - padding} Z`} className="area-path" />
        <path d={investedPath} className="invested-path" />
        <path d={valuePath} className="value-path" />
        <circle cx={x(points.length - 1)} cy={y(last.value)} r="7" className="last-dot" />
      </svg>
      <div className="chart-legend">
        <span><i className="legend-current" /> Patrimônio: {compactCurrency.format(last.value)}</span>
        <span><i className="legend-invested" /> Aportes líquidos: {compactCurrency.format(last.invested ?? 0)}</span>
      </div>
    </div>
  );
}
