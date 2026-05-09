'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AdminHome() {
  const [a, setA] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);

  function load() {
    api<any>('/api/v1/admin/analytics/today').then(setA);
    api<any>('/api/v1/admin/bookings/today').then((r) => setBookings(r.bookings));
    api<any>('/api/v1/admin/automation/health').then(setHealth);
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-slate-900">Today</h1>

      {a && (
        <div className="grid gap-4 md:grid-cols-4">
          <Stat label="Orders today"  value={a.orders} />
          <Stat label="Delivered"     value={a.delivered} />
          <Stat label="Revenue"       value={`₹${a.revenue.toFixed(0)}`} accent />
          <Stat label="Bookings"      value={a.bookings} />
        </div>
      )}

      {a && (
        <div className="card p-4">
          <h3 className="font-medium">Order pipeline</h3>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm md:grid-cols-6">
            {Object.entries(a.byStatus as Record<string, number>).map(([k, v]) => (
              <div key={k} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                <div className="text-xs text-slate-500">{k.replace(/_/g, ' ')}</div>
                <div className="font-semibold">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-4">
        <h3 className="font-medium">Today's bookings</h3>
        {bookings.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">None.</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead><tr className="text-left text-slate-500">
              <th>Time</th><th>Party</th><th>Customer</th><th>Table</th><th>Status</th>
            </tr></thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-t border-slate-100">
                  <td className="py-1.5">{new Date(b.slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{b.partySize}</td>
                  <td>{b.user?.name ?? '—'}</td>
                  <td>{b.table?.number}</td>
                  <td><span className="chip bg-slate-100 text-slate-700">{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {health && (
        <div className="card p-4 text-sm">
          <h3 className="font-medium">Automation</h3>
          <p className="text-xs text-slate-500">All workers reporting healthy. Last check: {new Date(health.at).toLocaleTimeString()}</p>
          <ul className="mt-2 grid grid-cols-2 gap-1 text-xs md:grid-cols-3">
            {(health.workers as string[]).map((w) => (
              <li key={w} className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">✓ {w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: boolean }) {
  return (
    <div className={`card p-4 ${accent ? 'bg-brand-50' : ''}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 font-display text-3xl font-bold text-brand-800">{value}</div>
    </div>
  );
}
