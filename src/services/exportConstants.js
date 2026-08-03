/** Shared constants for customer exports (avoids circular imports). */
import installGuidance from '../data/splunkInstallationGuidance.json' with { type: 'json' };

export const EXPORT_DISCLAIMER_FULL = installGuidance.disclaimer.full;
export const EXPORT_DISCLAIMER_SHORT = installGuidance.disclaimer.short;
export const EXPORT_OFFICIAL_LINKS = installGuidance.officialLinks;
export const EXPORT_FOOTER = installGuidance.disclaimer.footer;
