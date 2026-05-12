'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useWsTopic } from '@/lib/ws';

const COLUMNS: Array<{ key: string; label: string; next?: string; bg: string }> = [
  { key: 'PAID',             label: 'New',         next: 'ACCEPTED',         bg: 'bg-amber-50 border-amber-200' },
  { key: 'ACCEPTED',         label: 'Accepted',    next: 'PREPARING',        bg: 'bg-sky-50 border-sky-200' },
  { key: 'PREPARING',        label: 'Preparing',   next: 'READY',            bg: 'bg-violet-50 border-violet-200' },
  { key: 'READY',            label: 'Ready',       next: 'OUT_FOR_DELIVERY', bg: 'bg-emerald-50 border-emerald-200' },
  { key: 'OUT_FOR_DELIVERY', label: 'On the way',  next: 'DELIVERED',        bg: 'bg-teal-50 border-teal-200' },
];

// Per-order SLA budget by stage, in minutes from `createdAt`. If we cross
// these the card pulses red. Tuned conservatively for a single-restaurant flow.
const SLA: Record<string, number> = {
  PAID: 3,
  ACCEPTED: 8,
  PREPARING: 25,
  READY: 35,
  OUT_FOR_DELIVERY: 60,
};

export default function KDS() {
  const [orders, setOrders] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());
  const [soundOn, setSoundOn] = useState(true);
  const knownIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function load() {
    api<{ orders: any[] }>('/api/v1/admin/orders').then((r) => setOrders(r.orders));
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 5_000);
    return () => clearInterval(t);
  }, []);

  // Re-tick the timers every 5s so the elapsed numbers don't drift
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  // Bump sound on any new PAID order. First load seeds the known set so we
  // don't blast through the kitchen on a fresh page open.
  useEffect(() => {
    if (!initialized.current) {
      knownIds.current = new Set(orders.map((o) => o.id));
      initialized.current = orders.length >= 0;
      return;
    }
    let bumped = false;
    for (const o of orders) {
      if (!knownIds.current.has(o.id) && o.status === 'PAID') {
        bumped = true;
        knownIds.current.add(o.id);
      } else if (!knownIds.current.has(o.id)) {
        knownIds.current.add(o.id);
      }
    }
    if (bumped && soundOn) {
      try { audioRef.current?.play().catch(() => {}); } catch {}
    }
  }, [orders, soundOn]);

  useWsTopic('admin:orders', () => load());

  async function move(id: string, to: string) {
    await api(`/api/v1/admin/orders/${id}/transition`, {
      method: 'POST', body: JSON.stringify({ to }),
    });
    load();
  }

  const grouped = COLUMNS.map((c) => ({ ...c, orders: orders.filter((o) => o.status === c.key) }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Kitchen / KDS</h1>
          <p className="text-sm text-slate-500">Auto-refresh every 5s · live updates via WebSocket · timers flash red past SLA.</p>
        </div>
        <button
          onClick={() => setSoundOn((v) => !v)}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${soundOn ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-stone-200 bg-white text-stone-500'}`}
          title="Toggle bump sound on new orders"
        >
          {soundOn ? '🔔 Sound on' : '🔕 Sound off'}
        </button>
      </div>

      <audio
        ref={audioRef}
        // Tiny inline ding — base64 WAV, no external file needed. Single short beep.
        src="data:audio/wav;base64,UklGRpQDAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YXADAAB//3z/hP9w/4j/cP+G/3z/c/+S/2j/jP9z/3//hP9z/4T/hP9z/4r/dP+G/4D/c/+P/2X/lP9l/5X/Z/+R/3D/iv9w/4//cP+M/3T/iv94/4j/eP+L/3X/iv96/4n/eP+I/3v/iv95/4f/fP+E/4D/g/+C/4D/hf99/4f/fP+I/3v/iP98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H/3z/h/98/4f/fP+H"
        preload="auto"
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        {grouped.map((col) => (
          <div key={col.key} className={`rounded-lg border p-2 ${col.bg}`}>
            <h3 className="px-2 py-1 text-sm font-semibold text-slate-700">
              {col.label} <span className="text-slate-400">· {col.orders.length}</span>
            </h3>
            <div className="space-y-2">
              {col.orders.map((o) => {
                const elapsedMin = Math.max(0, Math.floor((now - new Date(o.createdAt).getTime()) / 60_000));
                const budget = SLA[o.status] ?? 999;
                const overBy = elapsedMin - budget;
                const ratio = elapsedMin / budget;
                const tone =
                  ratio >= 1   ? 'border-rose-300 bg-rose-50 text-rose-800 animate-pulse'
                  : ratio >= 0.75 ? 'border-amber-300 bg-amber-50 text-amber-800'
                  :                'border-stone-200 bg-white text-stone-600';
                return (
                  <div key={o.id} className="card p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <strong>{o.orderNumber}</strong>
                      <span className="chip bg-slate-100 text-slate-600">{o.type}</span>
                    </div>
                    <div className="text-xs text-slate-500">{o.user?.name ?? 'Customer'} · ₹{o.total.toFixed(0)}</div>

                    {/* Per-card timer */}
                    <div className={`mt-1.5 flex items-center justify-between rounded-md border px-2 py-1 text-[11px] font-semibold ${tone}`}>
                      <span>{elapsedMin} min in stage</span>
                      <span>
                        {overBy > 0
                          ? `⚠ +${overBy}m over SLA`
                          : `SLA ${budget}m`}
                      </span>
                    </div>

                    <ul className="mt-1.5 space-y-0.5 text-xs">
                      {o.items.map((it: any) => (
                        <li key={it.id}>
                          {it.qty} × {it.item.name}
                          {(JSON.parse(it.modifiers) as any[]).length > 0 && (
                            <span className="text-slate-400"> ({(JSON.parse(it.modifiers) as any[]).map((m) => m.name).join(', ')})</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {o.notes && <p className="mt-1 text-xs italic text-slate-500">"{o.notes}"</p>}
                    {o.deliveryNote && <p className="mt-1 text-xs text-amber-700">📝 {o.deliveryNote}</p>}
                    {(o.contactless || o.dontRingBell || o.leaveAtDoor || o.noCutlery) && (
                      <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                        {o.contactless  && <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-violet-700">contactless</span>}
                        {o.dontRingBell && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-700">no bell</span>}
                        {o.leaveAtDoor  && <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-sky-700">leave at door</span>}
                        {o.noCutlery    && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-emerald-700">no cutlery</span>}
                      </div>
                    )}
                    {o.rider && (
                      <p className="mt-1 text-xs text-emerald-700">🛵 {o.rider.user.name} · {o.rider.vehicleNumber}</p>
                    )}
                    {col.next && (
                      <button onClick={() => move(o.id, col.next!)} className="btn-primary mt-2 w-full !py-1 text-xs">
                        → {col.next.replace(/_/g, ' ')}
                      </button>
                    )}
                  </div>
                );
              })}
              {col.orders.length === 0 && <p className="px-2 py-3 text-xs text-slate-400">—</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
