import {
  CISCO_INGEST_PROMO_COPY,
  CISCO_INGEST_PROMO_EXAMPLE,
  isCiscoVendor,
  resolveSourceVendor,
} from '../../services/ciscoIngestPromo.js';

export default function CiscoIngestPromoBanner({ source, sourceState, catalog, allInputs, vendorOverride }) {
  const vendor = vendorOverride
    || resolveSourceVendor(source, sourceState, { catalog, allInputs });
  if (!isCiscoVendor(vendor)) return null;

  return (
    <div
      className="rounded-xl border border-[var(--cast-accent)]/35 bg-[var(--cast-accent-muted)]/40 px-4 py-3 sm:px-5"
      role="status"
    >
      <p className="text-sm font-semibold text-[var(--cast-accent)] leading-snug">
        {CISCO_INGEST_PROMO_COPY}
      </p>
      <p className="text-sm text-[var(--cast-text-secondary)] mt-1 leading-relaxed">
        {CISCO_INGEST_PROMO_EXAMPLE} This advantage does not expire.
      </p>
    </div>
  );
}
