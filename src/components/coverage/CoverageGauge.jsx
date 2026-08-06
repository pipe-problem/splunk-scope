import { useEffect, useState } from 'react';

/**
 * Animated radial coverage gauge (not a boxed pie chart).
 */
export default function CoverageGauge({ percent = 0, size = 140, customerName = '' }) {
  const [animated, setAnimated] = useState(0);
  const clamped = Math.min(100, Math.max(0, percent));
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (animated / 100) * c;

  const color =
    clamped >= 75 ? 'var(--cast-success)' : clamped >= 50 ? 'var(--cast-warning)' : 'var(--cast-critical)';

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimated(clamped));
    return () => cancelAnimationFrame(t);
  }, [clamped]);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--cast-panel-alt)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
          <span className="text-2xl font-black text-[var(--cast-text)]">{Math.round(animated)}%</span>
          <span className="text-tiny text-[var(--cast-text-muted)] uppercase tracking-wide">Coverage</span>
        </div>
      </div>
      {customerName && (
        <p className="text-label font-semibold text-[var(--cast-text)] mt-2 truncate max-w-[200px]">{customerName}</p>
      )}
    </div>
  );
}
