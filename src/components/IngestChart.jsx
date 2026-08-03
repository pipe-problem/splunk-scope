import { useMemo } from 'react';
import { formatIngestString } from '../utils/formatIngestDisplay.js';

const COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#6366f1', '#14b8a6',
];

export default function IngestChart({ sources, title = 'Ingest by Source' }) {
  const data = useMemo(() => {
    if (!sources || sources.length === 0) return { items: [], total: 0 };
    const items = sources
      .filter((s) => s.ingest?.expected > 0)
      .sort((a, b) => b.ingest.expected - a.ingest.expected)
      .map((s, i) => ({
        name: s.name,
        value: s.ingest.expected,
        color: COLORS[i % COLORS.length],
      }));
    const total = items.reduce((sum, i) => sum + i.value, 0);
    return { items, total };
  }, [sources]);

  if (data.items.length === 0) {
    return <div className="text-label text-[var(--cast-text-muted)] text-center py-4">No ingest data to chart</div>;
  }

  const topItems = data.items.slice(0, 8);
  const otherTotal = data.items.slice(8).reduce((sum, i) => sum + i.value, 0);
  if (otherTotal > 0) {
    topItems.push({ name: `Other (${data.items.length - 8})`, value: otherTotal, color: '#6b7280' });
  }

  const maxValue = topItems[0]?.value || 1;

  return (
    <div>
      <h4 className="text-label font-semibold text-[var(--cast-text)] mb-3">{title}</h4>
      <div className="space-y-1.5">
        {topItems.map((item, i) => {
          const pct = data.total > 0 ? (item.value / data.total * 100) : 0;
          const barWidth = (item.value / maxValue * 100);
          return (
            <div key={i} className="flex items-center gap-2">
              <div className="w-24 truncate text-badge text-[var(--cast-text-secondary)] text-right shrink-0">
                {item.name}
              </div>
              <div className="flex-1 h-4 bg-[var(--cast-bg)] rounded-sm overflow-hidden relative">
                <div
                  className="h-full rounded-sm transition-all duration-300"
                  style={{ width: `${barWidth}%`, backgroundColor: item.color }}
                />
              </div>
              <div className="w-28 text-badge text-[var(--cast-text-muted)] shrink-0 text-right">
                {formatIngestString(item.value)} <span className="opacity-60">({pct.toFixed(0)}%)</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-right text-badge text-[var(--cast-text-muted)]">
        Total: {formatIngestString(data.total)}
      </div>
    </div>
  );
}

export function IngestByCategory({ sources, title = 'Ingest by Category' }) {
  const data = useMemo(() => {
    if (!sources || sources.length === 0) return { items: [], total: 0 };
    const cats = {};
    for (const s of sources) {
      const cat = s.category || 'Other';
      if (!cats[cat]) cats[cat] = 0;
      cats[cat] += s.ingest?.expected || 0;
    }
    const items = Object.entries(cats)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));
    const total = items.reduce((sum, i) => sum + i.value, 0);
    return { items, total };
  }, [sources]);

  if (data.items.length === 0) {
    return <div className="text-label text-[var(--cast-text-muted)] text-center py-4">No category data</div>;
  }

  return (
    <div>
      <h4 className="text-label font-semibold text-[var(--cast-text)] mb-3">{title}</h4>
      <div className="flex gap-3 flex-wrap">
        {data.items.map((item, i) => {
          const pct = data.total > 0 ? (item.value / data.total * 100) : 0;
          return (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-badge text-[var(--cast-text-secondary)]">
                {item.name}: {formatIngestString(item.value)} ({pct.toFixed(0)}%)
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 h-5 rounded-sm overflow-hidden flex bg-[var(--cast-bg)]">
        {data.items.map((item, i) => {
          const pct = data.total > 0 ? (item.value / data.total * 100) : 0;
          return (
            <div
              key={i}
              className="h-full transition-all duration-300"
              style={{ width: `${pct}%`, backgroundColor: item.color }}
              title={`${item.name}: ${pct.toFixed(1)}%`}
            />
          );
        })}
      </div>
    </div>
  );
}
