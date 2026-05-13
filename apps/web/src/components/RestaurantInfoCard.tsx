'use client';

// Restaurant info card — surfaces the legal/operational facts a serious diner
// looks for: address, hours, FSSAI + GST registration, today's open/closed
// status. Renders the trust signals that food-delivery apps typically tuck
// at the bottom of a restaurant page.

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Clock, MapPin, Phone, ShieldCheck } from 'lucide-react';

type Branch = {
  id: string; name: string; address: string;
  openHour: number; closeHour: number;
  fssai?: string | null; gstin?: string | null;
};

export function RestaurantInfoCard() {
  const [b, setB] = useState<Branch | null>(null);

  useEffect(() => {
    api<{ branch: Branch }>('/api/v1/menu/branch').then((r) => setB(r.branch)).catch(() => {});
  }, []);

  if (!b) return null;

  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  const isOpen = h >= b.openHour && h < b.closeHour;
  const closesIn = isOpen ? Math.round((b.closeHour - h) * 60) : null;
  const opensIn = !isOpen
    ? h < b.openHour
      ? Math.round((b.openHour - h) * 60)
      : Math.round((24 + b.openHour - h) * 60)
    : null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className="rounded-2xl border border-stone-200 bg-cream/50 p-6 md:p-8">
        <div className="grid gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
              <ShieldCheck size={14} /> Registered & compliant
            </div>
            <h2 className="mt-2 display text-2xl font-bold text-stone-900 md:text-3xl">{b.name}</h2>

            <ul className="mt-4 grid gap-3 text-sm text-stone-700 md:grid-cols-2">
              <li className="flex items-start gap-2.5">
                <MapPin size={16} className="mt-0.5 shrink-0 text-brand-600" />
                <span>{b.address}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock size={16} className="mt-0.5 shrink-0 text-brand-600" />
                <span>
                  {b.openHour}:00 – {b.closeHour}:00, every day
                  {isOpen && closesIn != null && closesIn < 60 && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                      closes in {closesIn} min
                    </span>
                  )}
                </span>
              </li>
              {b.fssai && (
                <li className="flex items-start gap-2.5">
                  <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand-600" />
                  <span><span className="text-stone-500">FSSAI Lic. </span><span className="font-mono">{b.fssai}</span></span>
                </li>
              )}
              {b.gstin && (
                <li className="flex items-start gap-2.5">
                  <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand-600" />
                  <span><span className="text-stone-500">GSTIN </span><span className="font-mono">{b.gstin}</span></span>
                </li>
              )}
              <li className="flex items-start gap-2.5">
                <Phone size={16} className="mt-0.5 shrink-0 text-brand-600" />
                <span>hello@luckybiryani.in</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col items-start md:items-end">
            <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {isOpen ? 'Open now' : 'Closed'}
            </div>
            {isOpen && closesIn != null && (
              <div className="mt-2 text-xs text-stone-500">Closes in <strong className="text-stone-700">{closesIn} min</strong></div>
            )}
            {!isOpen && opensIn != null && (
              <div className="mt-2 text-xs text-stone-500">Opens in <strong className="text-stone-700">{opensIn > 60 ? `${Math.floor(opensIn / 60)}h ${opensIn % 60}m` : `${opensIn} min`}</strong></div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
