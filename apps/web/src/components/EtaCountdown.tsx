'use client';

// Big "Arriving in 14 min" countdown. Fetches /eta on mount + every 30s,
// and ticks down between polls so the number actually moves.

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Eta = {
  minutesRemaining: number;
  arrivalAt: string;
  distanceKm?: number;
  breakdown: { prepRemaining: number; deliveryMin: number };
};

export function EtaCountdown({ orderId, status }: { orderId: string; status: string }) {
  const [eta, setEta] = useState<Eta | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await api<Eta>(`/api/v1/orders/${orderId}/eta`);
        if (alive) setEta(r);
      } catch { /* not yours, or not in flight */ }
    }
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, [orderId, status]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  if (!eta) return null;
  if (['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(status)) return null;

  const arriveMs = new Date(eta.arrivalAt).getTime();
  const minLeft = Math.max(0, Math.round((arriveMs - now) / 60_000));

  return (
    <div className="card flex items-center gap-4 overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 p-5 text-white shadow-lg">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur">
        <span className="text-2xl">🛵</span>
      </div>
      <div className="flex-1">
        <div className="text-xs uppercase tracking-[0.18em] opacity-80">
          {status === 'OUT_FOR_DELIVERY' ? 'Arriving in' : 'Estimated arrival'}
        </div>
        <div className="font-display text-3xl font-bold leading-tight md:text-4xl">
          {minLeft === 0 ? 'Any minute now' : `${minLeft} min`}
        </div>
        <div className="text-xs opacity-80">
          By {new Date(arriveMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {eta.distanceKm != null && ` · ${eta.distanceKm} km away`}
        </div>
      </div>
    </div>
  );
}
