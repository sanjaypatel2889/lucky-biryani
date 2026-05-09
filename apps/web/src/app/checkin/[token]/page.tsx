'use client';

// Host check-in page. Customer's QR points here. We POST to the public
// checkin endpoint (token-authenticated, no login required for the host).

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useParams } from 'next/navigation';

export default function Checkin() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api(`/api/v1/bookings/checkin/${token}`, { method: 'POST' })
      .then((r: any) => { setData(r.booking); setState('success'); })
      .catch((e) => { setErr(e.detail?.error ?? e.message); setState('error'); });
  }, [token]);

  return (
    <main className="grid min-h-screen place-items-center bg-orange-50 p-6">
      <div className="card max-w-md p-6 text-center">
        {state === 'loading' && <p>Checking in…</p>}
        {state === 'success' && data && (
          <>
            <div className="text-5xl">✅</div>
            <h1 className="mt-3 font-display text-2xl font-bold text-brand-900">Welcome!</h1>
            <p className="mt-1 text-slate-600">Booking <strong>{data.bookingNumber}</strong></p>
            <p className="text-sm text-slate-500">Party of {data.partySize} · Table will be ready momentarily.</p>
          </>
        )}
        {state === 'error' && (
          <>
            <div className="text-5xl">⚠</div>
            <h1 className="mt-3 font-display text-2xl font-bold text-rose-700">Check-in failed</h1>
            <p className="mt-1 text-slate-600">{err}</p>
            <p className="mt-1 text-xs text-slate-400">Please ask the host for help.</p>
          </>
        )}
      </div>
    </main>
  );
}
