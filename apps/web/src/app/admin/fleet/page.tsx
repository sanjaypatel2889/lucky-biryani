'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useWsTopic } from '@/lib/ws';

export default function Fleet() {
  const [riders, setRiders] = useState<any[]>([]);

  function load() {
    api<{ riders: any[] }>('/api/v1/admin/fleet/live').then((r) => setRiders(r.riders));
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 5_000);
    return () => clearInterval(t);
  }, []);
  useWsTopic('admin:fleet', () => load());

  const grouped = {
    AVAILABLE: riders.filter((r) => r.status === 'AVAILABLE'),
    ON_DELIVERY: riders.filter((r) => r.status === 'ON_DELIVERY'),
    ON_BREAK: riders.filter((r) => r.status === 'ON_BREAK'),
    OFFLINE: riders.filter((r) => r.status === 'OFFLINE'),
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-900">Fleet</h1>
      <p className="text-sm text-slate-500">Live rider status. Updated every 5s.</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Object.entries(grouped).map(([k, list]) => (
          <div key={k} className="card p-3">
            <h3 className="font-medium">{k.replace('_', ' ')} <span className="text-slate-400">· {list.length}</span></h3>
            <ul className="mt-2 space-y-2">
              {list.map((r) => (
                <li key={r.id} className="rounded-md border border-slate-100 p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <strong>{r.user.name}</strong>
                    <span className="text-xs text-slate-400">⭐ {r.ratingAvg}</span>
                  </div>
                  <div className="text-xs text-slate-500">{r.vehicleType} · {r.vehicleNumber ?? '—'}</div>
                  {r.lastLat && (
                    <div className="text-xs text-slate-400">📍 {r.lastLat.toFixed(4)}, {r.lastLng.toFixed(4)}</div>
                  )}
                  {r.lastPingAt && (
                    <div className="text-xs text-slate-400">last seen {timeAgo(r.lastPingAt)}</div>
                  )}
                </li>
              ))}
              {list.length === 0 && <p className="text-xs text-slate-400">—</p>}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.round(s)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}
