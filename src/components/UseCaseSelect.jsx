import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Search, ChevronDown } from 'lucide-react';
import useCaseProfiles from '../data/useCaseProfiles.json';

const CATEGORY_ORDER = ['Security', 'Observability', 'IT Operations', 'Cloud', 'Compliance', 'Business', 'AI / ML', 'OT / ICS', 'Platform', 'Other'];

export default function UseCaseSelect({ selected = [], onChange, placeholder = 'Search use cases...' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return useCaseProfiles;
    const q = search.toLowerCase();
    return useCaseProfiles.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }, [search]);

  const filteredGrouped = useMemo(() => {
    const result = {};
    for (const p of filtered) {
      const cat = p.category || 'Other';
      if (!result[cat]) result[cat] = [];
      result[cat].push(p);
    }
    return result;
  }, [filtered]);

  const sortedCategories = useMemo(() => {
    const cats = Object.keys(filteredGrouped);
    return cats.sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a);
      const ib = CATEGORY_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [filteredGrouped]);

  function toggle(profileName) {
    if (selected.includes(profileName)) {
      onChange(selected.filter((n) => n !== profileName));
    } else {
      onChange([...selected, profileName]);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="input-field cursor-pointer flex items-center gap-2 min-h-[40px] flex-wrap"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selected.length === 0 && (
          <span className="text-[var(--cast-text-muted)] text-sm">{placeholder}</span>
        )}
        {selected.slice(0, 4).map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-badge bg-[var(--cast-green-muted)] text-[var(--cast-green)] border border-[var(--cast-green)]/20"
          >
            {name}
            <button onClick={(e) => { e.stopPropagation(); toggle(name); }} className="hover:text-white">
              <X size={9} />
            </button>
          </span>
        ))}
        {selected.length > 4 && (
          <span className="text-badge text-[var(--cast-text-muted)]">+{selected.length - 4} more</span>
        )}
        <ChevronDown size={13} className="ml-auto text-[var(--cast-text-muted)] shrink-0" />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-[var(--cast-panel)] border border-[var(--cast-border-strong)] rounded-lg shadow-2xl max-h-80 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-[var(--cast-border)]">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--cast-text-muted)]" />
              <input
                className="input-field !pl-8 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search use cases..."
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {sortedCategories.map((category) => (
              <div key={category}>
                <div className="px-3 py-1 text-tiny font-semibold text-[var(--cast-text-muted)] uppercase tracking-wider bg-[var(--cast-bg)] sticky top-0">
                  {category}
                </div>
                {filteredGrouped[category].map((profile) => {
                  const isSelected = selected.includes(profile.name);
                  return (
                    <button
                      key={profile.id}
                      onClick={() => toggle(profile.name)}
                      className={`w-full text-left px-3 py-1.5 text-label hover:bg-[var(--cast-panel-alt)] flex items-center gap-2 ${
                        isSelected ? 'text-[var(--cast-green)]' : 'text-[var(--cast-text-secondary)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="accent-[var(--cast-green)] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{profile.name}</div>
                        <div className="text-badge text-[var(--cast-text-muted)] truncate">{profile.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="p-3 text-label text-[var(--cast-text-muted)] text-center">No matching use cases</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
