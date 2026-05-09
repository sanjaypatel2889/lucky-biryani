'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useWsTopic } from '@/lib/ws';

export default function TablesLive() {
  const [tables, setTables] = useState<any[]>([]);
  function load() {
    api<{ tables: any[] }>('/api/v1/admin/tables/live').then((r) => setTables(r.tables));
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);
  useWsTopic('admin:bookings', () => load());

  const zones = [...new Set(tables.map((t) => t.zone))];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-900">Tables · live</h1>
      <p className="text-sm text-slate-500">Updated every 10s.</p>

      <div className="mt-4 space-y-6">
        {zones.map((z) => (
          <div key={z}>
            <h2 className="font-medium text-slate-700">{z}</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-3 md:grid-cols-5">
              {tables.filter((t) => t.zone === z).map((t) => {
                const b = t.booking;
                const status = b ? b.status : 'FREE';
                return (
                  <div key={t.id} className={`rounded-lg border p-3 text-sm ${color(status)}`}>
                    <div className="flex items-center justify-between">
                      <strong>{t.number}</strong>
                      <span className="text-xs text-slate-500">cap {t.capacity}</span>
                    </div>
                    <div className="mt-1 text-xs">{label(status)}</div>
                    {b && (
                      <div className="mt-1 text-xs text-slate-600">
                        {b.user?.name} · party {b.partySize}
                        <br />
                        {new Date(b.slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function color(s: string) {
  if (s === 'FREE') return 'bg-emerald-50 border-emerald-200';
  if (s === 'CONFIRMED') return 'bg-amber-50 border-amber-200';
  if (s === 'CHECKED_IN' || s === 'SEATED') return 'bg-rose-50 border-rose-200';
  if (s === 'NO_SHOW') return 'bg-slate-100 border-slate-200';
  return 'bg-slate-50 border-slate-200';
}
function label(s: string) {
  if (s === 'FREE') return '✓ free';
  if (s === 'CONFIRMED') return '⏳ booked';
  if (s === 'SEATED') return '🍽 seated';
  if (s === 'CHECKED_IN') return '👤 checked in';
  return s;
}
