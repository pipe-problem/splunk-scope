import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/layout/Toast';
import { ArrowRight, FolderOpen, BarChart3, Shield, GitBranch, FileText, Lock, Cpu } from 'lucide-react';
import { APP_VERSION } from '../config/version';
import { getResumePaths, STEP } from '../config/workflowSteps.js';
import ScopeLogo from '../components/layout/ScopeLogo';

const NODES = [
  { cx: 110, cy: 38, r: 3 },
  { cx: 168, cy: 72, r: 2.5 },
  { cx: 52, cy: 88, r: 2.5 },
  { cx: 182, cy: 138, r: 3 },
  { cx: 38, cy: 152, r: 2.5 },
  { cx: 110, cy: 182, r: 3 },
  { cx: 148, cy: 48, r: 2 },
  { cx: 72, cy: 168, r: 2 },
];

const EDGES = [
  [0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5], [0, 6], [2, 7], [1, 3], [3, 5],
];

const RESUME_PATHS = getResumePaths();

export default function HomePage() {
  const { dispatch } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  function handleBegin() {
    dispatch({ type: 'RESET_SESSION' });
    dispatch({ type: 'SET_STEP', payload: STEP.INTAKE });
    navigate('/intake');
  }

  function handleImportSession(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        dispatch({ type: 'LOAD_SESSION', payload: data });
        const step = Math.min(Math.max(0, Number(data.currentStep) || 1), RESUME_PATHS.length - 1);
        navigate(RESUME_PATHS[step] || '/intake');
        toast.success('Session imported successfully.');
      } catch {
        toast.error('Invalid session file. Please check the file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const capabilities = [
    { icon: BarChart3, label: '78 data sources' },
    { icon: Shield, label: 'Coverage validation' },
    { icon: GitBranch, label: 'Phased architecture paths' },
    { icon: FileText, label: 'Executive report' },
  ];

  return (
    <div className="h-full flex flex-col bg-[var(--cast-bg)] overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 px-6">
        <div className="flex flex-col items-center max-w-lg w-full animate-fade-in-up">
          <div className="flex items-center gap-2.5 mb-6">
            <ScopeLogo size={32} gradientId="home-logo-grad" />
            <div>
              <h1 className="text-page-title font-bold text-gradient tracking-tight leading-none">Splunk Scope</h1>
              <p className="text-label text-[var(--cast-text-muted)] uppercase tracking-widest">Planning & Architecture</p>
            </div>
            <div className="flex items-center gap-1.5 ml-3">
              <span className="flex items-center gap-1.5 text-badge text-[var(--cast-text-muted)] px-2 py-1 rounded-full border border-[var(--cast-border)]"><Lock size={12} /> Local-only</span>
              <span className="flex items-center gap-1.5 text-badge text-[var(--cast-text-muted)] px-2 py-1 rounded-full border border-[var(--cast-border)]"><Cpu size={12} /> AI-assisted</span>
            </div>
          </div>

          <div className="relative w-[200px] h-[200px] mx-auto mb-5" aria-hidden="true">
            <svg viewBox="0 0 220 220" width="200" height="200" className="absolute inset-0">
              <defs>
                <linearGradient id="radar-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#E954B7" />
                  <stop offset="55%" stopColor="#FF7A1A" />
                  <stop offset="100%" stopColor="#FFD84D" />
                </linearGradient>
                <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#E954B7" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="#E954B7" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="110" cy="110" r="100" fill="url(#radar-glow)" />
              {[35, 55, 75, 95].map((r) => (
                <circle key={r} cx="110" cy="110" r={r} fill="none" stroke="url(#radar-grad)" strokeWidth="0.75" opacity={0.12 + (95 - r) * 0.004} />
              ))}
              {EDGES.map(([a, b], i) => (
                <line
                  key={i}
                  x1={NODES[a].cx}
                  y1={NODES[a].cy}
                  x2={NODES[b].cx}
                  y2={NODES[b].cy}
                  stroke="url(#radar-grad)"
                  strokeWidth="0.8"
                  opacity="0.2"
                  className="topology-link"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
              {NODES.map((n, i) => (
                <circle key={i} cx={n.cx} cy={n.cy} r={n.r} fill="url(#radar-grad)" opacity="0.85" className="topology-node" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
              <circle cx="110" cy="110" r="5" fill="url(#radar-grad)" />
            </svg>
            <svg viewBox="0 0 220 220" width="200" height="200" className="absolute inset-0">
              <circle cx="110" cy="110" r="50" fill="none" stroke="url(#radar-grad)" strokeWidth="1.5" opacity="0.45" className="radar-ring" />
              <circle cx="110" cy="110" r="50" fill="none" stroke="url(#radar-grad)" strokeWidth="1.5" opacity="0.45" className="radar-ring-delayed" />
            </svg>
            <svg viewBox="0 0 220 220" width="200" height="200" className="absolute inset-0 radar-sweep-line">
              <line x1="110" y1="110" x2="110" y2="12" stroke="url(#radar-grad)" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
            </svg>
          </div>

          <p className="text-body text-[var(--cast-text-secondary)] leading-relaxed text-center mb-8 max-w-sm">
            Plan data onboarding, validate telemetry coverage, and build architecture paths for Splunk deployments.
          </p>

          <button
            type="button"
            onClick={handleBegin}
            className="btn-primary inline-flex items-center justify-center gap-2.5 text-base px-8 py-3 mb-3 w-full max-w-sm"
          >
            Begin <ArrowRight size={18} />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary inline-flex items-center justify-center gap-2 text-sm px-6 py-2.5 w-full max-w-sm"
          >
            <FolderOpen size={16} /> Resume & Import
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportSession} className="hidden" />
        </div>
      </div>

      <div className="shrink-0 flex items-center justify-center gap-8 px-6 py-3 border-t border-[var(--cast-border)] bg-[var(--cast-panel)] animate-fade-in-up-delayed-2">
        {capabilities.map((cap) => (
          <div key={cap.label} className="flex items-center gap-1.5">
            <cap.icon size={16} className="text-[var(--cast-accent)]" />
            <span className="text-badge text-[var(--cast-text-secondary)]">{cap.label}</span>
          </div>
        ))}
        <span className="text-tiny text-[var(--cast-text-muted)] tabular-nums ml-4">v{APP_VERSION}</span>
      </div>
    </div>
  );
}
