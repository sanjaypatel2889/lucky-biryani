'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Today = { orders: number; delivered: number; revenue: number; byStatus: Record<string, number>; bookings: number };
type Deep = {
  customers: { total: number; repeat: number; repeatRatePct: number; avgLtv: number; topCustomers: Array<{ id: string; name: string; orders: number; revenue: number }> };
  menu:      { topItems: Array<{ id: string; name: string; qty: number; revenue: number }> };
  delivery:  { avgDeliveryMin: number; overSla: number; slaCompliancePct: number };
  revenue7d: Array<{ date: string; revenue: number; orders: number }>;
};

export default function AdminHome() {
  const [a, setA] = useState<Today | null>(null);
  const [d, setD] = useState<Deep | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);

  function load() {
    api<Today>('/api/v1/admin/analytics/today').then(setA);
    api<Deep>('/api/v1/admin/analytics/deep').then(setD);
    api<any>('/api/v1/admin/bookings/today').then((r) => setBookings(r.bookings));
    api<any>('/api/v1/admin/automation/health').then(setHealth);
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-slate-900">Dashboard</h1>

      {a && (
        <div className="grid gap-4 md:grid-cols-4">
          <Stat label="Orders today"  value={a.orders} />
          <Stat label="Delivered"     value={a.delivered} />
          <Stat label="Revenue today" value={`₹${a.revenue.toFixed(0)}`} accent />
          <Stat label="Bookings"      value={a.bookings} />
        </div>
      )}

      {a && Object.keys(a.byStatus).length > 0 && (
        <div className="card p-4">
          <h3 className="font-medium">Order pipeline</h3>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm md:grid-cols-6">
            {Object.entries(a.byStatus).map(([k, v]) => (
              <div key={k} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                <div className="text-xs text-slate-500">{k.replace(/_/g, ' ')}</div>
                <div className="font-semibold">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {d && (
        <>
          {/* 7-day revenue mini-chart */}
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Last 7 days · revenue</h3>
              <span className="text-xs text-slate-500">Sum: ₹{d.revenue7d.reduce((s, x) => s + x.revenue, 0).toFixed(0)}</span>
            </div>
            <RevenueBars data={d.revenue7d} />
          </div>

          {/* Customer metrics */}
          <div className="grid gap-4 md:grid-cols-3">
            <Stat label="Customers (30d)"  value={d.customers.total} />
            <Stat label="Repeat rate"      value={`${d.customers.repeatRatePct}%`} hint={`${d.customers.repeat} of ${d.customers.total}`} />
            <Stat label="Avg lifetime value" value={`₹${d.customers.avgLtv}`} accent />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="card p-4">
              <h3 className="font-medium">Top customers</h3>
              {d.customers.topCustomers.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">No data yet.</p>
              ) : (
                <table className="mt-2 w-full text-sm">
                  <thead><tr className="text-left text-slate-500"><th>Name</th><th className="text-right">Orders</th><th className="text-right">Revenue</th></tr></thead>
                  <tbody>
                    {d.customers.topCustomers.map((c) => (
                      <tr key={c.id} className="border-t border-slate-100">
                        <td className="py-1.5">{c.name}</td>
                        <td className="text-right">{c.orders}</td>
                        <td className="text-right">₹{c.revenue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card p-4">
              <h3 className="font-medium">Top dishes (30d)</h3>
              {d.menu.topItems.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">No data yet.</p>
              ) : (
                <table className="mt-2 w-full text-sm">
                  <thead><tr className="text-left text-slate-500"><th>Dish</th><th className="text-right">Qty</th><th className="text-right">Revenue</th></tr></thead>
                  <tbody>
                    {d.menu.topItems.map((it) => (
                      <tr key={it.id} className="border-t border-slate-100">
                        <td className="py-1.5">{it.name}</td>
                        <td className="text-right">{it.qty}</td>
                        <td className="text-right">₹{it.revenue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Delivery SLA */}
          <div className="card p-4">
            <h3 className="font-medium">Delivery performance (30d)</h3>
            <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs text-slate-500">Avg time</div>
                <div className="display text-2xl font-bold">{d.delivery.avgDeliveryMin} min</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">SLA compliance</div>
                <div className={`display text-2xl font-bold ${d.delivery.slaCompliancePct >= 90 ? 'text-emerald-700' : d.delivery.slaCompliancePct >= 75 ? 'text-amber-700' : 'text-rose-700'}`}>
                  {d.delivery.slaCompliancePct}%
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Over 45 min</div>
                <div className="display text-2xl font-bold text-rose-700">{d.delivery.overSla}</div>
              </div>
            </div>
          </div>
        </>
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

function Stat({ label, value, accent, hint }: { label: string; value: any; accent?: boolean; hint?: string }) {
  return (
    <div className={`card p-4 ${accent ? 'bg-brand-50' : ''}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 font-display text-3xl font-bold text-brand-800">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

function RevenueBars({ data }: { data: Array<{ date: string; revenue: number; orders: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.revenue));
  return (
    <div className="mt-4 flex items-end gap-2">
      {data.map((d) => {
        const h = Math.max(4, Math.round((d.revenue / max) * 100));
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center">
            <div className="text-[10px] text-slate-400">₹{d.revenue}</div>
            <div className="mt-1 w-full bg-brand-100 rounded-t-md" style={{ height: `${h}px` }}>
              <div className="h-full w-full rounded-t-md bg-brand-600" style={{ opacity: 0.85 }} />
            </div>
            <div className="mt-1 text-[10px] text-slate-500">{new Date(d.date).toLocaleDateString([], { weekday: 'short' })}</div>
            <div className="text-[10px] text-slate-400">{d.orders} ord</div>
          </div>
        );
      })}
    </div>
  );
}
