import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
};

const COLORS = {
  success: 'var(--cast-success)',
  warning: 'var(--cast-warning)',
  error: 'var(--cast-critical)',
  info: 'var(--cast-info)',
};

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useMemo(() => ({
    success: (msg, dur) => addToast(msg, 'success', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  }), [addToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }) {
  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = setTimeout(() => onRemove(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const Icon = ICONS[toast.type] || Info;
  const color = COLORS[toast.type] || COLORS.info;

  return (
    <div
      className="pointer-events-auto flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg border border-[var(--cast-border-strong)] bg-[var(--cast-panel)] shadow-lg max-w-sm animate-toast-in"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      <Icon size={16} style={{ color, marginTop: 1 }} className="shrink-0" />
      <p className="text-label text-[var(--cast-text-secondary)] flex-1 leading-snug">{toast.message}</p>
      <button
        type="button"
        onClick={() => onRemove(toast.id)}
        className="shrink-0 text-[var(--cast-text-muted)] hover:text-[var(--cast-text)] transition-colors p-0.5"
        aria-label="Dismiss"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
