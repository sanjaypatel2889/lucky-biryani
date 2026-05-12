'use client';

// Lightweight toast system. Slides in from bottom-right (top on mobile),
// auto-dismisses after 3s, supports success / error / info tones. Replaces
// our scattered alert() calls.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export type ToastTone = 'success' | 'error' | 'info';
type Toast = { id: string; body: string; tone: ToastTone };

type Ctx = {
  show: (body: string, tone?: ToastTone) => void;
  success: (body: string) => void;
  error:   (body: string) => void;
  info:    (body: string) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((body: string, tone: ToastTone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((cur) => [...cur, { id, body, tone }]);
    // Auto-dismiss after 3 seconds (2.5s display + 0.5s exit padding)
    window.setTimeout(() => setToasts((cur) => cur.filter((t) => t.id !== id)), 3000);
  }, []);

  const value: Ctx = {
    show,
    success: (b) => show(b, 'success'),
    error:   (b) => show(b, 'error'),
    info:    (b) => show(b, 'info'),
  };

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end">
        {toasts.map((t) => <ToastItem key={t.id} toast={t} onDismiss={() => setToasts((cur) => cur.filter((x) => x.id !== t.id))} />)}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setShow(true)); }, []);

  const tone =
    toast.tone === 'success' ? { bg: 'bg-emerald-600',  Icon: CheckCircle2 } :
    toast.tone === 'error'   ? { bg: 'bg-rose-600',     Icon: AlertTriangle } :
                               { bg: 'bg-stone-900',    Icon: Info };

  return (
    <div
      className={`pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-sm text-white shadow-xl ring-1 ring-black/10 backdrop-blur transition-all duration-300 ${tone.bg} ${show ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
    >
      <tone.Icon size={18} className="mt-0.5 shrink-0" />
      <span className="flex-1 leading-snug">{toast.body}</span>
      <button onClick={onDismiss} className="shrink-0 rounded-md p-0.5 opacity-70 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast outside ToastProvider');
  return ctx;
}
