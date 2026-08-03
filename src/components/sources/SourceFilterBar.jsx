import { Search } from 'lucide-react';

const FILTER_KEYS = ['all', 'current', 'unknown', 'high_priority'];
const FILTER_LABELS = {
  all: 'All',
  current: 'Configured',
  unknown: 'Not configured',
  high_priority: 'High relevance',
};

export default function SourceFilterBar({ searchQuery, onSearchChange, statusFilter, onStatusFilterChange }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[180px]">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--cast-text-muted)]" aria-hidden="true" />
        <input className="input-field !pl-8 !py-2 !text-label" value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search M365, AD, Okta, CloudTrail, firewalls…" aria-label="Search sources" />
      </div>
      <div className="flex items-center gap-1">
        {FILTER_KEYS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onStatusFilterChange(s)}
            className={`px-2.5 py-1 rounded-full text-badge font-medium transition-all whitespace-nowrap ${
              statusFilter === s
                ? 'bg-[var(--cast-accent)] text-white'
                : 'border border-[var(--cast-border)] text-[var(--cast-text-muted)] hover:border-[var(--cast-accent)]/40 hover:text-[var(--cast-text-secondary)]'
            }`}
          >
            {FILTER_LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  );
}
