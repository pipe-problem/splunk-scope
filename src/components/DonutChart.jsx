import { useState, useMemo } from 'react';
import {
  normalizeChartSlicesForDisplay,
  getActualTooltipData,
} from '../services/chartDisplayEngine.js';

const COLORS = [
  'var(--cast-accent)',
  'var(--cast-info)',
  'var(--cast-success)',
  'var(--cast-warning)',
  '#8b5cf6',
  '#06b6d4',
  '#f59e0b',
  '#ec4899',
  '#10b981',
  '#6366f1',
];

function polarToCartesian(cx, cy, r, angle) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
}

/**
 * @param {{ label: string, value: number, color?: string }[]} segments - actual values (GB/day)
 */
export default function DonutChart({
  segments = [],
  size = 200,
  strokeWidth = 28,
  showLegend = true,
  presentationScale = true,
  centerValue = null,
  centerLabel = 'GB/day',
  centerSubLabel = null,
  hoverCenterNumericOnly = false,
  centerMode = null,
  onHoverChange = null,
  onSliceClick = null,
  expandOnHover = true,
}) {
  const [hovered, setHovered] = useState(null);
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - strokeWidth) / 2 - 4;

  const displaySlices = useMemo(() => {
    const colored = segments.map((s, i) => ({
      label: s.label,
      value: s.value || 0,
      color: s.color || COLORS[i % COLORS.length],
    }));
    if (!presentationScale) {
      const total = colored.reduce((sum, s) => sum + s.value, 0) || 1;
      return colored.map((s) => ({
        ...s,
        actualValue: s.value,
        actualPercent: (s.value / total) * 100,
        displayPercent: (s.value / total) * 100,
      }));
    }
    return normalizeChartSlicesForDisplay(colored, { maxSlices: 8 }).map((s, i) => ({
      ...s,
      color: s.color || COLORS[i % COLORS.length],
    }));
  }, [segments, presentationScale]);

  const totalActual = displaySlices.reduce((sum, s) => sum + (s.actualValue || 0), 0);
  const centerDisplayValue = centerValue != null ? Number(centerValue) : totalActual;
  const totalOnlyCenter = centerMode === 'total-only' || hoverCenterNumericOnly;

  if (totalActual === 0 || displaySlices.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <p className="text-badge text-[var(--cast-text-muted)]">No data</p>
      </div>
    );
  }

  const arcs = displaySlices.reduce((acc, seg, i) => {
    const prevEnd = acc.length > 0 ? acc[acc.length - 1].endAngle : 0;
    const angle = Math.max((seg.displayPercent / 100) * 360, 2);
    acc.push({
      ...seg,
      startAngle: prevEnd,
      endAngle: prevEnd + angle,
      color: seg.color || COLORS[i % COLORS.length],
      index: i,
    });
    return acc;
  }, []);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="overflow-visible">
          {arcs.map((arc) => {
            const isHovered = hovered === arc.index;
            const r = expandOnHover && isHovered ? radius + 3 : radius;
            const sw = expandOnHover && isHovered ? strokeWidth + 3 : strokeWidth;
            const gap = 1.2;
            return (
              <path
                key={arc.index}
                d={arcPath(cx, cy, r, arc.startAngle + gap / 2, arc.endAngle - gap / 2)}
                fill="none"
                stroke={arc.color}
                strokeWidth={sw}
                strokeLinecap="butt"
                opacity={hovered !== null && !isHovered ? 0.45 : 1}
                style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
                onMouseEnter={() => {
                  setHovered(arc.index);
                  onHoverChange?.(arc.index, arc);
                }}
                onMouseLeave={() => {
                  setHovered(null);
                  onHoverChange?.(null, null);
                }}
                onClick={() => onSliceClick?.(arc.index, arc)}
              />
            );
          })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hovered !== null && !totalOnlyCenter ? (
            <>
              <span className="text-label font-bold text-[var(--cast-text)] text-center px-2 leading-tight">
                {arcs[hovered].label}
              </span>
              <span className="text-badge text-[var(--cast-text-muted)]">
                {arcs[hovered].actualValue.toFixed(1)} GB/d ({arcs[hovered].actualPercent.toFixed(0)}%)
              </span>
            </>
          ) : (
            <>
              <span className="text-sm font-bold text-[var(--cast-text)] tabular-nums">
                {centerDisplayValue.toFixed(1)}
              </span>
              <span className="text-tiny text-[var(--cast-text-muted)]">{centerLabel}</span>
              {centerSubLabel && !totalOnlyCenter && (
                <span className="text-tiny text-[var(--cast-text-muted)] text-center px-2">{centerSubLabel}</span>
              )}
            </>
          )}
        </div>
      </div>

      {showLegend && (
        <ul className="w-full max-w-[240px] space-y-1" aria-label="Chart legend (actual values)">
          {displaySlices.map((slice, i) => {
            const tip = getActualTooltipData(slice);
            return (
              <li
                key={i}
                className="flex items-center gap-2 chart-legend-text text-[var(--cast-text-secondary)] cursor-pointer hover:text-[var(--cast-text)]"
                onMouseEnter={() => {
                  setHovered(i);
                  onHoverChange?.(i, displaySlices[i]);
                }}
                onMouseLeave={() => {
                  setHovered(null);
                  onHoverChange?.(null, null);
                }}
                title={tip.lines.join(' · ')}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: slice.color }} />
                <span className="truncate flex-1">{slice.label}</span>
                <span className="font-mono text-[var(--cast-success)] shrink-0">{slice.actualValue.toFixed(1)}</span>
                <span className="text-[var(--cast-text-muted)] shrink-0">{slice.actualPercent.toFixed(0)}%</span>
              </li>
            );
          })}
        </ul>
      )}
      {presentationScale && (
        <p className="text-tiny text-[var(--cast-text-muted)] text-center max-w-[200px]">
          Slice sizes adjusted for readability; legend shows actual ingest.
        </p>
      )}
    </div>
  );
}
