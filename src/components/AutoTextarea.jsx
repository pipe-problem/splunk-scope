import { useRef, useEffect, useCallback } from 'react';

export default function AutoTextarea({ value, onChange, className = '', minRows = 2, maxRows = 12, ...props }) {
  const ref = useRef(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 18;
    const minHeight = lineHeight * minRows + 16;
    const maxHeight = lineHeight * maxRows + 16;
    const scrollH = el.scrollHeight;
    const clamped = Math.min(Math.max(scrollH, minHeight), maxHeight);
    el.style.height = `${clamped}px`;
    el.style.overflowY = scrollH > maxHeight ? 'auto' : 'hidden';
  }, [minRows, maxRows]);

  useEffect(() => { resize(); }, [value, resize]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      className={`input-field resize-none ${className}`}
      style={{ transition: 'height 0.1s ease' }}
      autoComplete="off"
      data-1p-ignore
      data-lpignore="true"
      {...props}
    />
  );
}
