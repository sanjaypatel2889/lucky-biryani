'use client';

import { Header } from '@/components/Header';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useParams } from 'next/navigation';

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ booking: any; qr: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<any>(`/api/v1/bookings/${id}`).then(setData); }, [id]);

  async function cancel() {
    setBusy(true);
    try {
      await api(`/api/v1/bookings/${id}/cancel`, { method: 'POST' });
      const r = await api<any>(`/api/v1/bookings/${id}`);
      setData(r);
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
      </main>
    </>
  );
}
