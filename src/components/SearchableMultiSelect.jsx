import { useState, useRef, useEffect } from 'react';
import { X, Search, ChevronDown } from 'lucide-react';

export default function SearchableMultiSelect({ options, selected = [], onChange, placeholder = 'Search...', allowCustom = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customValue, setCustomValue] = useState('');
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

  const flatOptions = options.flatMap((cat) =>
    cat.apps.map((app) => ({ ...app, category: cat.category }))
  );

  const filtered = flatOptions.filter((app) => {
    const q = search.toLowerCase();
    return (
      app.name.toLowerCase().includes(q) ||
      app.category.toLowerCase().includes(q) ||
      (app.shortName && app.shortName.toLowerCase().includes(q)) ||
      (app.description && app.description.toLowerCase().includes(q))
    );
  });

  const grouped = filtered.reduce((acc, app) => {
    if (!acc[app.category]) acc[app.category] = [];
    acc[app.category].push(app);
    return acc;
  }, {});

  function toggle(appId) {
    if (selected.includes(appId)) {
      onChange(selected.filter((id) => id !== appId));
    } else {
      onChange([...selected, appId]);
    }
  }

  function addCustom() {
    if (customValue.trim() && !selected.includes(`custom:${customValue.trim()}`)) {
      onChange([...selected, `custom:${customValue.trim()}`]);
      setCustomValue('');
    }
  }

  function getDisplayName(id) {
    if (id.startsWith('custom:')) return id.replace('custom:', '');
    const app = flatOptions.find((a) => a.id === id);
    return app?.shortName || app?.name || id;
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
        {selected.slice(0, 5).map((id) => (
          <span
            key={id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-badge bg-[var(--cast-green-muted)] text-[var(--cast-green)] border border-[var(--cast-green)]/20"
          >
            {getDisplayName(id)}
            <button
              onClick={(e) => { e.stopPropagation(); toggle(id); }}
              className="hover:text-white"
            >
              <X size={9} />
            </button>
          </span>
        ))}
        {selected.length > 5 && (
          <span className="text-badge text-[var(--cast-text-muted)]">+{selected.length - 5} more</span>
        )}
        <ChevronDown size={13} className="ml-auto text-[var(--cast-text-muted)] shrink-0" />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-[var(--cast-panel)] border border-[var(--cast-border-strong)] rounded-lg shadow-2xl max-h-72 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-[var(--cast-border)]">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--cast-text-muted)]" />
              <input
                className="input-field !pl-8 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search apps..."
                autoFocus
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {Object.entries(grouped).map(([category, apps]) => (
              <div key={category}>
                <div className="px-3 py-1 text-tiny font-semibold text-[var(--cast-text-muted)] uppercase tracking-wider bg-[var(--cast-bg)] sticky top-0">
                  {category}
                </div>
                {apps.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => toggle(app.id)}
                    className={`w-full text-left px-3 py-1.5 text-label hover:bg-[var(--cast-panel-alt)] flex items-center gap-2 ${
                      selected.includes(app.id) ? 'text-[var(--cast-green)]' : 'text-[var(--cast-text-secondary)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(app.id)}
                      readOnly
                      className="accent-[var(--cast-green)] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{app.name}</div>
                      {app.description && (
                        <div className="text-badge text-[var(--cast-text-muted)] truncate">{app.description}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="p-3 text-label text-[var(--cast-text-muted)] text-center">No matching apps</div>
            )}
          </div>

          {allowCustom && (
            <div className="p-2 border-t border-[var(--cast-border)] flex gap-2">
              <input
                className="input-field flex-1"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder="Add custom..."
                onKeyDown={(e) => e.key === 'Enter' && addCustom()}
              />
              <button onClick={addCustom} className="btn-primary !py-1 !px-2 text-badge">Add</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
