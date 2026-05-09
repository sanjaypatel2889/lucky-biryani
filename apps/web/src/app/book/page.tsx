'use client';

import { Header } from '@/components/Header';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { LoginModal } from '@/components/LoginModal';
import { useRouter } from 'next/navigation';

type Slot = { start: string; end: string; freeTables: number };

export default function BookPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [branchId, setBranchId] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [partySize, setPartySize] = useState(2);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [picked, setPicked] = useState<Slot | null>(null);
  const [occasion, setOccasion] = useState('');
  const [special, setSpecial] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    api<{ branch: any }>('/api/v1/menu/branch').then((r) => setBranchId(r.branch?.id ?? null));
  }, []);

  useEffect(() => {
    if (!branchId) return;
    setPicked(null);
    api<{ slots: Slot[] }>(`/api/v1/bookings/availability?branchId=${branchId}&date=${date}&partySize=${partySize}`)
      .then((r) => setSlots(r.slots));
  }, [branchId, date, partySize]);

  async function book() {
    if (!user) { setLoginOpen(true); return; }
    if (!branchId || !picked) return;
    setBusy(true); setErr('');
    try {
      const r = await api<{ booking: any }>('/api/v1/bookings', {
        method: 'POST',
        body: JSON.stringify({
          branchId, partySize, slotStart: picked.start,
          occasion: occasion || undefined,
          specialRequest: special || undefined,
        }),
      });
      router.push(`/bookings/${r.booking.id}`);
    } catch (e: any) {
      setErr(e.detail?.error ?? e.message);
    }
    setBusy(false);
  }

  // group slots into morning / afternoon / evening
  const grouped = slots.reduce<Record<string, Slot[]>>((acc, s) => {
    const h = new Date(s.start).getHours();
    const k = h < 14 ? 'Lunch (11–2)' : h < 18 ? 'Afternoon (2–6)' : 'Dinner (6–11)';
    (acc[k] ??= []).push(s);
    return acc;
  }, {});

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="font-display text-3xl font-bold text-brand-900">Reserve a table</h1>
        <p className="mt-1 text-slate-600">Pick a date, party size, and a slot. We'll send a QR for instant check-in.</p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="card p-4">
            <label className="label">Date</label>
            <input type="date" className="input" value={date} min={new Date().toISOString().slice(0,10)} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="card p-4">
            <label className="label">Party size</label>
            <div className="flex items-center gap-2">
              <button className="btn-secondary !px-3" onClick={() => setPartySize(Math.max(1, partySize - 1))}>−</button>
              <span className="w-8 text-center">{partySize}</span>
              <button className="btn-secondary !px-3" onClick={() => setPartySize(Math.min(20, partySize + 1))}>+</button>
            </div>
          </div>
          <div className="card p-4">
            <label className="label">Occasion (optional)</label>
            <select className="input" value={occasion} onChange={(e) => setOccasion(e.target.value)}>
              <option value="">—</option>
              <option>Birthday</option>
              <option>Anniversary</option>
              <option>Business meal</option>
            </select>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {Object.keys(grouped).length === 0 ? (
            <p className="text-sm text-slate-500">No slots available for this party size on this day.</p>
          ) : Object.entries(grouped).map(([label, ss]) => (
            <div key={label}>
              <h3 className="mb-2 font-medium">{label}</h3>
              <div className="flex flex-wrap gap-2">
                {ss.map((s) => {
                  const t = new Date(s.start);
                  const time = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const sel = picked?.start === s.start;
                  return (
                    <button key={s.start} onClick={() => setPicked(s)}
                            className={`rounded-md border px-3 py-2 text-sm transition ${sel ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 hover:border-slate-300'}`}>
                      {time}
                      <span className="ml-2 text-xs text-slate-400">{s.freeTables} free</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {picked && (
          <div className="card mt-6 p-4">
            <label className="label">Special request (optional)</label>
            <textarea className="input" rows={2} value={special} onChange={(e) => setSpecial(e.target.value)} placeholder="Window seat, dietary notes, etc." />
            <button className="btn-primary mt-3" onClick={book} disabled={busy}>
              {busy ? 'Confirming…' : `Confirm — ${new Date(picked.start).toLocaleString()} (party of ${partySize})`}
            </button>
            {err && <p className="mt-2 text-xs text-rose-600">⚠ {err}</p>}
          </div>
        )}
      </main>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
