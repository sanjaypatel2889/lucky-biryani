'use client';

// First-visit onboarding. Three short slides — welcome, location prompt,
// notifications + AI hint. Dismisses with localStorage so it never shows
// again. Only mounted on the home page so it doesn't interrupt deep-link
// landings.

import { useEffect, useState } from 'react';
import Link from 'next/link';

const KEY = 'lbc_onboarded_v1';

export function Onboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) {
        // Tiny delay so it doesn't fight with hero load
        const t = setTimeout(() => setOpen(true), 1200);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);

  function done() {
    try { localStorage.setItem(KEY, '1'); } catch {}
    setOpen(false);
  }

  function tryLocate() {
    if (!navigator.geolocation) { setStep(2); return; }
    navigator.geolocation.getCurrentPosition(() => setStep(2), () => setStep(2), { timeout: 5000 });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-stone-900/70 p-4 backdrop-blur-sm" onClick={done}>
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative h-40 bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700">
          <button onClick={done} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/20 text-white/90 backdrop-blur hover:bg-white/30">✕</button>
          <div className="absolute inset-0 grid place-items-center text-6xl text-white drop-shadow">
            {step === 0 && '🍛'}
            {step === 1 && '📍'}
            {step === 2 && '🔔'}
          </div>
        </div>

        <div className="p-6">
          {step === 0 && (
            <>
              <h2 className="display text-2xl font-bold text-stone-900">Welcome to Lucky Biryani</h2>
              <p className="mt-2 text-sm text-stone-600">
                Hyderabad's most-loved dum biryani — slow-cooked, sealed-handi, delivered hot in about 30 minutes.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-stone-700">
                <li className="flex items-center gap-2"><span>🛵</span> Live tracking from kitchen to door</li>
                <li className="flex items-center gap-2"><span>★</span> Loyalty points on every order</li>
                <li className="flex items-center gap-2"><span>💬</span> Lucky AI in the corner — text or voice</li>
              </ul>
              <button onClick={() => setStep(1)} className="btn-primary mt-5 w-full">Get started →</button>
            </>
          )}
          {step === 1 && (
            <>
              <h2 className="display text-2xl font-bold text-stone-900">Share your location?</h2>
              <p className="mt-2 text-sm text-stone-600">
                We use it once to compute delivery distance and ETA — never shared, never tracked between visits.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button onClick={() => setStep(2)} className="btn-secondary">Not now</button>
                <button onClick={tryLocate} className="btn-primary">Use my location</button>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="display text-2xl font-bold text-stone-900">Stay in the loop</h2>
              <p className="mt-2 text-sm text-stone-600">
                Enable notifications on your order page for live updates (rider on the way, food arriving). And try Lucky AI in the bottom-right — ask anything about the menu by text or voice.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Link onClick={done} href="/menu" className="btn-secondary text-center">Browse menu</Link>
                <button onClick={done} className="btn-primary">All set</button>
              </div>
            </>
          )}

          <div className="mt-5 flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full transition ${i === step ? 'bg-brand-600 w-6' : 'bg-stone-300'}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
