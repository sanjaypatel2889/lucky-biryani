'use client';

// Surge / busy indicator. Calls /api/v1/menu/busyness every 60s.
// When the kitchen is at capacity, shows "Busier than usual · +N min" so
// customers don't get a surprise when ETAs run long.

import { useEffect, useState } from 'react';

type Status = {
  level: 'quiet' | 'normal' | 'busy' | 'slammed';
  activeOrders: number;
  softCap: number;
  extraEtaMin: number;
};

const STYLES: Record<Status['level'], { dot: string; bg: string; text: string; label: string }> = {
  quiet:   { dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200',   text: 'text-emerald-800',  label: 'Quiet · fastest delivery' },
  normal:  { dot: 'bg-sky-500',     bg: 'bg-sky-50 border-sky-200',           text: 'text-sky-800',      label: 'Open · normal pace' },
  busy:    { dot: 'bg-amber-500',   bg: 'bg-amber-50 border-amber-200',       text: 'text-amber-800',    label: 'Busier than usual' },
  slammed: { dot: 'bg-rose-500',    bg: 'bg-rose-50 border-rose-200',         text: 'text-rose-800',     label: 'Slammed right now' },
};

export function BusyIndicator({ inline = false }: { inline?: boolean }) {
  const [s, setS] = useState<Status | null>(null);

  useEffect(() => {
    let alive = true;
    function load() {
      fetch('/api/v1/menu/busyness').then((r) => r.json()).then((j) => { if (alive) setS(j); }).catch(() => {});
    }
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!s) return null;
  const sty = STYLES[s.level];

  if (inline) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${sty.bg} ${sty.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${sty.dot} ${s.level !== 'quiet' && s.level !== 'normal' ? 'animate-pulse' : ''}`} />
        {sty.label}{s.extraEtaMin > 0 && ` · +${s.extraEtaMin} min`}
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium ${sty.bg} ${sty.text}`}>
      <span className={`h-2 w-2 rounded-full ${sty.dot} ${s.level !== 'quiet' && s.level !== 'normal' ? 'animate-pulse' : ''}`} />
      {sty.label}{s.extraEtaMin > 0 && ` · expect +${s.extraEtaMin} min on delivery`}
    </div>
  );
}
