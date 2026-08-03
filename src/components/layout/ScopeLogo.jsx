/**
 * Shared Splunk Scope logo mark (gradient lens icon).
 * @param {string} [gradientId] — unique id for SVG gradient defs when multiple logos render on one page
 */
export default function ScopeLogo({ size = 28, gradientId = 'scope-logo-grad', className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E954B7" />
          <stop offset="55%" stopColor="#FF7A1A" />
          <stop offset="100%" stopColor="#FFD84D" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="var(--cast-panel-alt)" />
      <circle cx="16" cy="15" r="8" fill="none" stroke={`url(#${gradientId})`} strokeWidth="2" />
      <circle cx="16" cy="15" r="2.5" fill={`url(#${gradientId})`} />
      <line x1="22" y1="21" x2="27" y2="26" stroke={`url(#${gradientId})`} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
