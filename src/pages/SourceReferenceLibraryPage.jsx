import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import sourceCatalog from '../data/sources.json';
import { flattenSourceCatalog } from '../services/sizingEngine';
import { resolveUseCaseProfiles } from '../services/useCaseResolver';
import { calculateCoverage } from '../services/coverageEngine';
import SourceDetailSummary from '../components/sources/SourceDetailSummary';
import SourceIntelSections from '../components/sources/SourceIntelSections';
import { getSuggestedDeploymentPath } from '../utils/suggestedDeploymentPath.js';
import { searchSourceCatalog, getAliasTermsForSource } from '../services/sourceSearchEngine';
import { resolveSplunkbaseLink } from '../utils/splunkbaseLinks';
import { downloadSourceBrief } from '../services/sourceExportEngine';
import { Download, ExternalLink, Search, BookMarked, ChevronRight } from 'lucide-react';

const flatCatalog = flattenSourceCatalog(sourceCatalog);
const categories = [...new Set(flatCatalog.map((s) => s.category).filter(Boolean))].sort();

export default function SourceReferenceLibraryPage() {
  const { state } = useApp();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [selectedId, setSelectedId] = useState(flatCatalog[0]?.id || null);

  const useCases = useMemo(() => resolveUseCaseProfiles(state.intake).profiles, [state.intake]);
  const currentCoverage = useMemo(() => {
    const active = flatCatalog.filter((s) => {
      const st = state.sources[s.id]?.status;
      return st === 'current' || st === 'future';
    });
    return calculateCoverage(active);
  }, [state.sources]);

  const filtered = useMemo(() => {
    const base = category === 'all'
      ? flatCatalog
      : flatCatalog.filter((s) => s.category === category);
    return searchSourceCatalog(base, query);
  }, [query, category]);

  const selected = useMemo(
    () => flatCatalog.find((s) => s.id === selectedId) || filtered[0] || null,
    [selectedId, filtered],
  );

  const deploymentPath = useMemo(
    () => (selected ? getSuggestedDeploymentPath(selected) : []),
    [selected],
  );

  return (
    <div className="page-viewport">
      <div className="page-header shrink-0 border-b border-[var(--cast-border)]">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BookMarked size={18} className="text-[var(--cast-accent)] shrink-0" />
            <h2>Source Reference Library</h2>
          </div>
          <p className="text-label text-[var(--cast-text-muted)] mt-1 max-w-2xl">
            Research source context, sizing notes, and onboarding links during customer sessions. Customer brief downloads exclude internal planning fields.
          </p>
        </div>
      </div>

      <div className="shrink-0 px-4 py-2 border-b border-[var(--cast-border)] bg-[var(--cast-panel)] space-y-2">
        <div className="relative max-w-xl">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cast-text-muted)]" />
          <input
            type="search"
            className="input-field w-full !pl-9 !text-base"
            placeholder="Search by product (Okta, ASA, M365, CrowdStrike, VPN, login logs…)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={`px-2 py-0.5 rounded-full text-badge ${category === 'all' ? 'bg-[var(--cast-accent)] text-white' : 'text-[var(--cast-text-muted)] hover:bg-[var(--cast-panel-alt)]'}`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-2 py-0.5 rounded-full text-badge ${category === cat ? 'bg-[var(--cast-accent)] text-white' : 'text-[var(--cast-text-muted)] hover:bg-[var(--cast-panel-alt)]'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <aside className="w-64 shrink-0 border-r border-[var(--cast-border)] overflow-y-auto hidden-scrollbar bg-[var(--cast-panel)]/50">
          <ul className="p-2 space-y-0.5">
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-label transition-colors ${
                    selected?.id === s.id
                      ? 'bg-[var(--cast-accent-muted)] text-[var(--cast-accent)] font-medium'
                      : 'text-[var(--cast-text-secondary)] hover:bg-[var(--cast-panel-alt)]'
                  }`}
                >
                  <span className="line-clamp-2">{s.name}</span>
                  <span className="text-tiny text-[var(--cast-text-muted)] block mt-0.5">{s.category}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-2 py-4 text-center text-badge text-[var(--cast-text-muted)]">No matches</li>
            )}
          </ul>
        </aside>

        <div className="flex-1 overflow-y-auto hidden-scrollbar p-4 md:p-6">
          {selected ? (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-[var(--cast-text)]">{selected.name}</h3>
                  <p className="text-sm text-[var(--cast-text-muted)]">{selected.category}</p>
                  {getAliasTermsForSource(selected.id).length > 0 && (
                    <p className="text-label text-[var(--cast-text-muted)] mt-1">
                      Search terms: {getAliasTermsForSource(selected.id).slice(0, 10).join(', ')}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => downloadSourceBrief(selected, useCases, currentCoverage, state.sources, flatCatalog)}
                  className="btn-secondary flex items-center gap-1.5 text-label shrink-0"
                >
                  <Download size={14} /> Download brief
                </button>
              </div>

              <SourceDetailSummary
                source={selected}
                useCases={useCases}
                currentCoverage={currentCoverage}
                sourceStates={state.sources}
                allSources={flatCatalog}
                scopeBannerOnly
              />

              <SourceIntelSections
                source={selected}
                useCases={useCases}
                sourceStates={state.sources}
                allSources={flatCatalog}
                showSizingReference
                showOverlap
              />

              {deploymentPath.length > 0 && (
                <div className="rounded-xl border border-[var(--cast-border)] bg-[var(--cast-panel)] p-4">
                  <h4 className="text-badge font-semibold text-[var(--cast-text-muted)] uppercase tracking-wide mb-3">
                    Suggested deployment path
                  </h4>
                  <ol className="space-y-2">
                    {deploymentPath.map((step, i) => (
                      <li key={i}>
                        <a
                          href={step.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-2 text-label text-[var(--cast-accent)] hover:underline group"
                        >
                          <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--cast-accent-muted)] flex items-center justify-center text-tiny font-bold text-[var(--cast-accent)]">
                            {i + 1}
                          </span>
                          <span className="flex-1 text-[var(--cast-text-secondary)] group-hover:text-[var(--cast-accent)]">
                            {step.label}
                          </span>
                          <ExternalLink size={12} className="shrink-0 mt-0.5 opacity-60" />
                        </a>
                      </li>
                    ))}
                  </ol>
                  <p className="text-tiny text-[var(--cast-text-muted)] mt-3 italic">
                    Links are starting points for self-service onboarding — not professional services requirements.
                  </p>
                </div>
              )}

              {(selected.splunkApps?.length > 0 || selected.technicalAddons?.length > 0) && (
                <div className="rounded-xl border border-[var(--cast-border)] p-4">
                  <h4 className="text-badge font-semibold text-[var(--cast-text-muted)] uppercase tracking-wide mb-2">
                    Splunkbase references
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {[...(selected.splunkApps || []), ...(selected.technicalAddons || [])].map((name, i) => {
                      const link = resolveSplunkbaseLink(name);
                      if (link?.customerUrl) {
                        return (
                          <a
                            key={i}
                            href={link.customerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-badge bg-[var(--cast-green-muted)] text-[var(--cast-green)] border border-[var(--cast-green)]/20"
                          >
                            {name}
                            <ExternalLink size={10} />
                          </a>
                        );
                      }
                      if (link?.status === 'needsReview' || link?.status === 'deprecated') {
                        return (
                          <span
                            key={i}
                            title={link.notes || link.label}
                            className="px-2 py-1 rounded-lg text-badge bg-[var(--cast-panel-alt)] border border-[var(--cast-warning)]/30 text-[var(--cast-warning)]"
                          >
                            {name} — Link needs validation
                          </span>
                        );
                      }
                      return (
                        <span key={i} className="px-2 py-1 rounded-lg text-badge bg-[var(--cast-panel-alt)] border border-[var(--cast-border)] text-[var(--cast-text-secondary)]">
                          {name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}


            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <ChevronRight size={24} className="text-[var(--cast-text-muted)] mb-2" />
              <p className="text-sm text-[var(--cast-text-muted)]">Select a source from the list</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
