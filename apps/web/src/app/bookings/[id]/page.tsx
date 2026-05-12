'use client';

import { Header } from '@/components/Header';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useParams } from 'next/navigation';

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ booking: any; qr: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await api<any>(`/api/v1/bookings/${id}`);
    setData(r);
  }
  useEffect(() => { void load(); }, [id]);

  async function cancel() {
    setBusy(true);
    try {
      await api(`/api/v1/bookings/${id}/cancel`, { method: 'POST' });
      await load();
    } catch (e: any) {
      alert(e.detail?.error ?? e.message);
    }
    setBusy(false);
  }

  if (!data) return <><Header /><main className="p-8">Loading…</main></>;
  const b = data.booking;
  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="font-display text-2xl font-bold text-brand-900">Reservation {b.bookingNumber}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {new Date(b.slotStart).toLocaleString()} → {new Date(b.slotEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
        <div className="card mt-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm">Party of <strong>{b.partySize}</strong> · Table <strong>{b.table.number}</strong> ({b.table.zone})</div>
              <div className="text-sm">Branch: {b.branch.name}</div>
              {b.preferredZone && <div className="text-sm text-slate-500">Preferred zone: {b.preferredZone}</div>}
              {b.occasion && <div className="text-sm text-slate-500">Occasion: {b.occasion}</div>}
              {b.specialRequest && <div className="text-sm italic text-slate-500">"{b.specialRequest}"</div>}
            </div>
            <span className={`chip ${b.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' : b.status === 'CANCELLED' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>{b.status}</span>
          </div>

          {data.qr && (
            <div className="mt-6 grid place-items-center">
              <img src={data.qr} alt="check-in QR" className="h-56 w-56" />
              <p className="mt-2 text-xs text-slate-500">Show this at the host stand to check in.</p>
            </div>
          )}

          {['CONFIRMED', 'PENDING'].includes(b.status) && (
            <button className="btn-secondary mt-6 w-full" onClick={cancel} disabled={busy}>
              {busy ? 'Cancelling…' : 'Cancel reservation'}
            </button>
          )}
        </div>

        {/* Pre-order food — only available before the booking has happened */}
        {['CONFIRMED', 'PENDING'].includes(b.status) && !b.preOrderId && (
          <PreOrderPanel bookingId={b.id} onAttached={load} />
        )}

        {b.preOrder && (
          <div className="card mt-4 p-4">
            <h3 className="font-medium">Pre-ordered for your table</h3>
            <p className="mt-1 text-xs text-slate-500">We'll start cooking ~25 minutes before your slot so it lands as you sit down.</p>
            <ul className="mt-2 space-y-1 text-sm">
              {b.preOrder.items.map((it: any) => (
                <li key={it.id} className="flex justify-between">
                  <span>{it.qty} × {it.item.name}</span>
                  <span>₹{it.lineTotal.toFixed(0)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 border-t border-stone-100 pt-2 text-sm font-semibold text-stone-800">
              Total: ₹{b.preOrder.total.toFixed(0)}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function PreOrderPanel({ bookingId, onAttached }: { bookingId: string; onAttached: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    api<{ items: any[] }>('/api/v1/menu/items').then((r) => setItems(r.items.filter((i: any) => i.availDinein)));
  }, [open]);

  const total = items.reduce((s, it) => s + (qtys[it.id] ?? 0) * it.basePrice, 0);
  const lines = items.filter((it) => (qtys[it.id] ?? 0) > 0).map((it) => ({ itemId: it.id, qty: qtys[it.id] }));

  async function submit() {
    if (lines.length === 0) return;
    setBusy(true); setErr(null);
    try {
      await api(`/api/v1/bookings/${bookingId}/pre-order`, {
        method: 'POST',
        body: JSON.stringify({ cart: lines, paymentMode: 'ONLINE' }),
      });
      onAttached();
    } catch (e: any) {
      setErr(e?.detail?.error ?? e?.message ?? 'Could not attach pre-order');
    }
    setBusy(false);
  }

  return (
    <div className="card mt-4 overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-stone-50">
        <div>
          <div className="text-sm font-medium text-stone-900">🍽 Pre-order your food</div>
          <div className="text-xs text-stone-500">We start cooking 25 min before — your dum lands as you sit down.</div>
        </div>
        <span className="text-stone-400">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="border-t border-stone-100 p-4">
          {items.length === 0 ? (
            <p className="text-sm text-stone-400">Loading menu…</p>
          ) : (
            <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {items.map((it) => {
                const q = qtys[it.id] ?? 0;
                return (
                  <li key={it.id} className="flex items-center justify-between gap-2 rounded-md border border-stone-100 px-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{it.name}</div>
                      <div className="text-[10px] text-stone-500">{it.categoryName} · ₹{it.basePrice}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setQtys((c) => ({ ...c, [it.id]: Math.max(0, (c[it.id] ?? 0) - 1) }))} className="grid h-6 w-6 place-items-center rounded-full border border-stone-200 text-sm">−</button>
                      <span className="w-5 text-center text-sm">{q}</span>
                      <button onClick={() => setQtys((c) => ({ ...c, [it.id]: (c[it.id] ?? 0) + 1 }))} className="grid h-6 w-6 place-items-center rounded-full border border-stone-200 text-sm">+</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
            <div className="text-sm font-semibold">Total: ₹{total.toFixed(0)}</div>
            <button onClick={submit} disabled={busy || lines.length === 0} className="btn-primary !py-1.5 text-sm">
              {busy ? 'Attaching…' : 'Attach to booking'}
            </button>
          </div>
          {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
        </div>
      )}
    </div>
  );
}
