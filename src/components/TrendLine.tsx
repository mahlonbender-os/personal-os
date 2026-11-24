'use client';

import { useId } from 'react';
import { formatAxisDate } from '@/lib/dates';

export interface TrendPoint {
  date: string;
  value: number;
}

export default function TrendLine({
  points,
  color,
  label,
  formatValue,
  withYear = false,
}: {
  points: TrendPoint[];
  color: string;
  label: string;
  formatValue: (value: number) => string;
  withYear?: boolean;
}) {
  const gradientId = `trend-${useId().replace(/:/g, '')}`;

  if (points.length === 0) {
    return <p className="text-[11px] text-[#555] py-6 text-center">Not enough history to chart</p>;
  }

  if (points.length === 1) {
    return (
      <div className="py-6 text-center">
        <p className="font-mono text-sm" style={{ color }}>{formatValue(points[0].value)}</p>
        <p className="text-[10px] text-[#555] mt-1">{formatAxisDate(points[0].date, withYear)}</p>
      </div>
    );
  }

  const width = 320;
  const height = 96;
  const padX = 8;
  const padY = 12;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.12 || Math.abs(max) * 0.08 || 1;
  const minV = min - pad;
  const maxV = max + pad;
  const span = maxV - minV || 1;

  const coords = points.map((point, index) => {
    const x = padX + (index / (points.length - 1)) * (width - padX * 2);
    const y = height - padY - ((point.value - minV) / span) * (height - padY * 2);
    return { x, y };
  });
  const line = coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const last = coords[coords.length - 1];
  const area = `${coords[0].x.toFixed(1)},${height} ${line} ${last.x.toFixed(1)},${height}`;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24" role="img" aria-label={label}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${gradientId})`} />
        <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={coords[0].x} cy={coords[0].y} r="2.5" fill="#111" stroke={color} strokeWidth="1.5" />
        <circle cx={last.x} cy={last.y} r="3" fill="#111" stroke={color} strokeWidth="2" />
      </svg>
      <div className="flex justify-between text-[10px] text-[#555] font-mono">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
      <div className="flex justify-between text-[10px] text-[#444] mt-0.5">
        <span>{formatAxisDate(points[0].date, withYear)}</span>
        <span>{formatAxisDate(points[points.length - 1].date, withYear)}</span>
      </div>
    </div>
  );
}
