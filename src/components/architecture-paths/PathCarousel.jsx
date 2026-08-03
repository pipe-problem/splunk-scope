import { useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import PathCarouselCard from './PathCarouselCard.jsx';

function wrapIndex(index, count) {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

/**
 * Single centered path card with prev/next arrows showing the path name on each side.
 */
export default function PathCarousel({
  plans = [],
  viewIndex = 0,
  reportPathIndex = -1,
  sourceStates = {},
  onViewIndexChange,
  onUseInReport,
}) {
  const regionRef = useRef(null);
  const count = plans.length;

  const prevIndex = wrapIndex(viewIndex - 1, count);
  const nextIndex = wrapIndex(viewIndex + 1, count);
  const currentPlan = plans[viewIndex];
  const prevPlan = plans[prevIndex];
  const nextPlan = plans[nextIndex];
  const isReport = reportPathIndex >= 0 && viewIndex === reportPathIndex;

  const goPrev = useCallback(() => {
    if (count === 0) return;
    onViewIndexChange(prevIndex);
  }, [count, prevIndex, onViewIndexChange]);

  const goNext = useCallback(() => {
    if (count === 0) return;
    onViewIndexChange(nextIndex);
  }, [count, nextIndex, onViewIndexChange]);

  useEffect(() => {
    const el = regionRef.current;
    if (!el) return undefined;

    function onKeyDown(e) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    }

    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [goPrev, goNext]);

  if (count === 0 || !currentPlan) return null;

  return (
    <div className="path-carousel space-y-3">
      <div
        ref={regionRef}
        className="path-carousel__deck-region outline-none focus-visible:ring-2 focus-visible:ring-[var(--cast-accent)]/40 rounded-2xl"
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label={`Architecture paths — ${currentPlan.name} selected`}
      >
        <div className="path-carousel__stage">
          {count > 1 && (
            <button
              type="button"
              className="path-carousel__step path-carousel__step--prev"
              onClick={goPrev}
              aria-label={`Previous path: ${prevPlan.name}`}
            >
              <span className="path-carousel__step-icon" aria-hidden>
                <ChevronLeft size={28} strokeWidth={2} />
              </span>
              <span className="path-carousel__step-kicker">Previous</span>
              <span className="path-carousel__step-name">{prevPlan.name}</span>
            </button>
          )}

          <article
            key={currentPlan.pathPhase || currentPlan.name}
            className={`plan-path-card plan-path-card--center plan-path-card--solo ${isReport ? 'plan-path-card--selected' : ''}`}
            role="group"
            aria-label={`${currentPlan.name} path`}
          >
            <PathCarouselCard
              plan={currentPlan}
              sourceStates={sourceStates}
              isCenter
              isReportPath={isReport}
              onSelectForReport={() => onUseInReport(viewIndex)}
            />
          </article>

          {count > 1 && (
            <button
              type="button"
              className="path-carousel__step path-carousel__step--next"
              onClick={goNext}
              aria-label={`Next path: ${nextPlan.name}`}
            >
              <span className="path-carousel__step-icon" aria-hidden>
                <ChevronRight size={28} strokeWidth={2} />
              </span>
              <span className="path-carousel__step-kicker">Next</span>
              <span className="path-carousel__step-name">{nextPlan.name}</span>
            </button>
          )}
        </div>

        {count > 1 && (
          <div className="path-carousel__nav">
            <div className="path-carousel__dots" role="tablist" aria-label="Architecture paths">
              {plans.map((p, idx) => (
                <button
                  key={p.name}
                  type="button"
                  role="tab"
                  aria-selected={idx === viewIndex}
                  className={`path-carousel__dot ${idx === viewIndex ? 'path-carousel__dot--active' : ''}`}
                  onClick={() => onViewIndexChange(idx)}
                  aria-label={p.name}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-tiny text-[var(--cast-text-muted)]">
        {viewIndex + 1} / {count}
        {count > 1 && (
          <>
            <span className="mx-1.5">·</span>
            Use arrows or dots to compare paths — select one for your report
          </>
        )}
      </p>
    </div>
  );
}
