import React, { useId, useMemo } from 'react';
import { fmtCompact, fmtNumber } from '../utils';

const WIDTH = 680;

function useGradientId(prefix) {
  const raw = useId();
  return `${prefix}-${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

function niceBounds(values, forcedMin, forcedMax) {
  const numeric = values.filter((value) => Number.isFinite(value));
  if (!numeric.length) return { min: 0, max: 1 };
  let min = forcedMin !== undefined ? forcedMin : Math.min(...numeric);
  let max = forcedMax !== undefined ? forcedMax : Math.max(...numeric);
  if (min === max) {
    const pad = Math.abs(min) > 10 ? Math.abs(min) * 0.1 : 1;
    min -= pad;
    max += pad;
  }
  if (forcedMin === undefined) {
    const pad = (max - min) * 0.12;
    min -= pad;
  }
  if (forcedMax === undefined) {
    const pad = (max - min) * 0.12;
    max += pad;
  }
  if (min < 0 && (forcedMin === undefined ? Math.min(...numeric) >= 0 : true)) min = Math.max(min, 0);
  return { min, max };
}

export function LineChart({
  data = [],
  xKey = 'label',
  yKey = 'value',
  height = 220,
  color = 'var(--accent)',
  fill = true,
  unit = '',
  decimals = 0,
  goal = null,
  goalLabel = 'Goal',
  min: forcedMin,
  max: forcedMax,
  xLabels = 6,
  emptyLabel = 'Not enough data yet',
  className = '',
}) {
  const gradientId = useGradientId('line');
  const chartHeight = height;
  const padding = { top: 16, right: 14, bottom: 26, left: 44 };
  const plotW = WIDTH - padding.left - padding.right;
  const plotH = chartHeight - padding.top - padding.bottom;
  const points = useMemo(
    () => data.map((item) => ({ ...item, value: Number(item[yKey]) || 0 })),
    [data, yKey]
  );

  if (points.length < 2) {
    return (
      <div className={`chart-empty ${className}`} style={{ height }}>
        <span>{emptyLabel}</span>
      </div>
    );
  }

  const bounds = niceBounds(points.map((point) => point.value), forcedMin, forcedMax);
  const xFor = (index) => padding.left + (index / (points.length - 1)) * plotW;
  const yFor = (value) => padding.top + plotH - ((value - bounds.min) / (bounds.max - bounds.min || 1)) * plotH;
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index).toFixed(1)} ${yFor(point.value).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${xFor(points.length - 1).toFixed(1)} ${padding.top + plotH} L ${xFor(0).toFixed(1)} ${padding.top + plotH} Z`;

  const labelIndexes = new Set();
  for (let i = 0; i < xLabels; i += 1) {
    labelIndexes.add(Math.round((i / Math.max(1, xLabels - 1)) * (points.length - 1)));
  }

  const ticks = 4;
  const tickValues = Array.from({ length: ticks + 1 }, (_, index) => bounds.max - ((bounds.max - bounds.min) / ticks) * index);

  return (
    <div className={`chart ${className}`}>
      <svg viewBox={`0 0 ${WIDTH} ${chartHeight}`} role="img" aria-label={`Line chart with ${points.length} data points`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {tickValues.map((value, index) => {
          const y = padding.top + (plotH / ticks) * index;
          return (
            <g key={value + index}>
              <line x1={padding.left} x2={WIDTH - padding.right} y1={y} y2={y} className="chart-grid" />
              <text x={padding.left - 8} y={y + 3.5} className="chart-axis-text" textAnchor="end">
                {fmtCompact(value)}
              </text>
            </g>
          );
        })}
        {goal !== null && goal >= bounds.min && goal <= bounds.max && (
          <g>
            <line x1={padding.left} x2={WIDTH - padding.right} y1={yFor(goal)} y2={yFor(goal)} className="chart-goal-line" />
            <text x={WIDTH - padding.right} y={yFor(goal) - 5} className="chart-goal-text" textAnchor="end">
              {goalLabel} {fmtNumber(goal, decimals)}
              {unit}
            </text>
          </g>
        )}
        {fill && <path d={areaPath} fill={`url(#${gradientId})`} />}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="chart-line" />
        {points.map((point, index) => (
          <g key={`${point.date || point[xKey] || index}-${index}`} className="chart-point">
            <circle cx={xFor(index)} cy={yFor(point.value)} r="8" fill="transparent">
              <title>{`${point[xKey] ?? ''}: ${fmtNumber(point.value, decimals)}${unit}`}</title>
            </circle>
            <circle cx={xFor(index)} cy={yFor(point.value)} r="3.2" fill="var(--surface)" stroke={color} strokeWidth="2" />
          </g>
        ))}
        {points.map((point, index) =>
          labelIndexes.has(index) ? (
            <text key={`lbl-${index}`} x={xFor(index)} y={chartHeight - 6} className="chart-axis-text" textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}>
              {point[xKey]}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}

export function BarChart({
  data = [],
  xKey = 'label',
  yKey = 'value',
  height = 200,
  color = 'var(--accent)',
  unit = '',
  decimals = 0,
  emptyLabel = 'No data for this period',
  className = '',
  valueLabels = true,
}) {
  const chartHeight = height;
  const padding = { top: 18, right: 10, bottom: 26, left: 38 };
  const plotW = WIDTH - padding.left - padding.right;
  const plotH = chartHeight - padding.top - padding.bottom;
  const points = data.map((item) => ({ ...item, value: Number(item[yKey]) || 0 }));

  if (!points.length) {
    return (
      <div className={`chart-empty ${className}`} style={{ height }}>
        <span>{emptyLabel}</span>
      </div>
    );
  }

  const max = Math.max(1, ...points.map((point) => point.value));
  const slot = plotW / points.length;
  const barWidth = Math.min(34, slot * 0.62);
  const skipLabels = Math.ceil(points.length / 9);

  return (
    <div className={`chart ${className}`}>
      <svg viewBox={`0 0 ${WIDTH} ${chartHeight}`} role="img" aria-label="Bar chart" preserveAspectRatio="xMidYMid meet">
        {[0, 0.5, 1].map((ratio) => {
          const y = padding.top + plotH * ratio;
          return (
            <g key={ratio}>
              <line x1={padding.left} x2={WIDTH - padding.right} y1={y} y2={y} className="chart-grid" />
              <text x={padding.left - 8} y={y + 3.5} className="chart-axis-text" textAnchor="end">
                {fmtCompact(max * (1 - ratio))}
              </text>
            </g>
          );
        })}
        {points.map((point, index) => {
          const barHeight = (point.value / max) * plotH;
          const x = padding.left + index * slot + (slot - barWidth) / 2;
          const y = padding.top + plotH - barHeight;
          return (
            <g key={`${point.date || point[xKey] || index}-${index}`}>
              <rect
                x={x}
                y={Math.min(y, padding.top + plotH - 1)}
                width={barWidth}
                height={Math.max(2, barHeight)}
                rx={Math.min(5, barWidth / 2)}
                fill={point.color || color}
                className="chart-bar"
              >
                <title>{`${point[xKey] ?? ''}: ${fmtNumber(point.value, decimals)}${unit}`}</title>
              </rect>
              {valueLabels && points.length <= 14 && (
                <text x={x + barWidth / 2} y={y - 6} className="chart-value-text" textAnchor="middle">
                  {fmtNumber(point.value, decimals)}
                </text>
              )}
              {index % skipLabels === 0 && (
                <text x={x + barWidth / 2} y={chartHeight - 6} className="chart-axis-text" textAnchor="middle">
                  {point[xKey]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function Donut({ segments = [], size = 176, stroke = 20, centerLabel, centerSub, legend = true, className = '' }) {
  const total = segments.reduce((sum, segment) => sum + (Number(segment.value) || 0), 0);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const arcs = segments
    .filter((segment) => Number(segment.value) > 0)
    .map((segment) => {
      const value = Number(segment.value) || 0;
      const length = total ? (value / total) * circumference : 0;
      const arc = { ...segment, length, offset, percent: total ? Math.round((value / total) * 100) : 0 };
      offset += length;
      return arc;
    });

  return (
    <div className={`donut ${className}`}>
      <div className="donut-chart" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Donut chart">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, arc.length - 2)} ${circumference}`}
              strokeDashoffset={-arc.offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              strokeLinecap="butt"
            >
              <title>{`${arc.label}: ${fmtNumber(arc.value, 0)} (${arc.percent}%)`}</title>
            </circle>
          ))}
        </svg>
        <div className="donut-center">
          <strong>{centerLabel ?? fmtCompact(total)}</strong>
          {centerSub && <span>{centerSub}</span>}
        </div>
      </div>
      {legend && (
        <ul className="donut-legend">
          {segments.map((segment) => (
            <li key={segment.label}>
              <span className="legend-dot" style={{ background: segment.color }} />
              <span className="legend-label">{segment.label}</span>
              <span className="legend-value">{fmtNumber(segment.value, 0)}{segment.unit || ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Heatmap({ items = [], label = 'Workout activity' }) {
  const weeks = useMemo(() => {
    if (!items.length) return [];
    const cells = [...items];
    const firstDate = new Date(`${cells[0].date}T00:00:00Z`);
    const lead = firstDate.getUTCDay();
    const padded = [...Array(lead).fill(null), ...cells];
    const columns = [];
    for (let i = 0; i < padded.length; i += 7) {
      columns.push(padded.slice(i, i + 7));
    }
    return columns;
  }, [items]);

  const level = (minutes) => {
    if (!minutes) return 0;
    if (minutes <= 20) return 1;
    if (minutes <= 45) return 2;
    if (minutes <= 80) return 3;
    return 4;
  };

  return (
    <div className="heatmap-wrap">
      <div className="heatmap" role="img" aria-label={label}>
        {weeks.map((week, weekIndex) => (
          <div className="heatmap-week" key={`week-${weekIndex}`}>
            {week.map((cell, dayIndex) =>
              cell ? (
                <span
                  key={cell.date}
                  className={`heatmap-cell level-${level(cell.minutes)}`}
                  title={`${cell.date}: ${cell.workouts} workout${cell.workouts === 1 ? '' : 's'} · ${cell.minutes} min`}
                />
              ) : (
                <span key={`empty-${weekIndex}-${dayIndex}`} className="heatmap-cell is-empty" />
              )
            )}
          </div>
        ))}
      </div>
      <div className="heatmap-legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((lvl) => (
          <span key={lvl} className={`heatmap-cell level-${lvl}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

export function Sparkline({ values = [], color = 'var(--accent)', height = 44, className = '' }) {
  if (values.length < 2) return null;
  const width = 120;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - 3 - ((value - min) / (max - min || 1)) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg className={`sparkline ${className}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GoalBar({ progress = 0, color = 'var(--accent)' }) {
  return (
    <div className="goal-bar" aria-hidden="true">
      <span style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: color }} />
    </div>
  );
}
