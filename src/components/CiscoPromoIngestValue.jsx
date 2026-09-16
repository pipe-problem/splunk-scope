import { formatIngestString, ingestPromoApplies } from '../utils/formatIngestDisplay.js';

/**
 * Billable ingest with optional strikethrough of pre-promo (gross) volume.
 */
export default function CiscoPromoIngestValue({
  billable,
  gross,
  promoApplied,
  className = '',
  billableClassName = '',
  grossClassName = 'text-[0.75em] text-[var(--cast-text-muted)] font-normal mr-1.5 decoration-[var(--cast-text-muted)]',
}) {
  const billableStr = formatIngestString(billable);
  if (!ingestPromoApplies(promoApplied, gross, billable)) {
    return <span className={billableClassName || className}>{billableStr}</span>;
  }
  return (
    <span className={`inline-flex items-baseline gap-0 ${className}`}>
      <s className={grossClassName}>{formatIngestString(gross)}</s>
      <span className={billableClassName}>{billableStr}</span>
    </span>
  );
}
