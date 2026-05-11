'use client';

// Refer friends — show the user's referral code + share link. Both parties
// earn 50 loyalty points on the friend's signup.

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { useAuth } from '@/lib/auth-store';

export default function ReferPage() {
  const { user, refresh } = useAuth();
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [siteOrigin, setSiteOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') setSiteOrigin(window.location.origin);
    void refresh();
  }, []);

  if (!user) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-12 text-center">
          <h1 className="display text-3xl font-bold text-stone-900">Refer a friend</h1>
          <p className="mt-3 text-stone-600">Log in to grab your referral code.</p>
        </main>
      </>
    );
  }

  const code = user.referralCode ?? '';
  const link = `${siteOrigin}/?ref=${encodeURIComponent(code)}`;
  async function copy(what: 'code' | 'link', val: string) {
    try { await navigator.clipboard.writeText(val); } catch {}
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="display text-3xl font-bold text-stone-900">Refer a friend, both eat happier</h1>
        <p className="mt-3 text-stone-600">
          Share this code or link. When your friend signs up and verifies their email,
          you both earn <strong>50 loyalty points</strong> (≈ ₹50 off your next order).
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="card p-5 text-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">Your code</div>
            <div className="mt-2 display text-3xl font-bold tracking-widest text-brand-700">{code}</div>
            <button
              onClick={() => copy('code', code)}
              className="btn-secondary mt-4 w-full"
            >
              {copied === 'code' ? 'Copied!' : 'Copy code'}
            </button>
          </div>

          <div className="card p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">Share link</div>
            <div className="mt-2 break-all rounded-md bg-stone-50 p-2 font-mono text-xs text-stone-700">{link}</div>
            <button
              onClick={() => copy('link', link)}
              className="btn-secondary mt-4 w-full"
            >
              {copied === 'link' ? 'Copied!' : 'Copy link'}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Hey! Try Lucky Biryani — sign up with my code ${code} and we both get ₹50 off. ${link}`)}`}
              target="_blank"
              rel="noreferrer"
              className="btn-primary mt-2 block w-full text-center"
            >
              Share on WhatsApp
            </a>
          </div>
        </div>

        <div className="mt-8 rounded-2xl bg-stone-50 p-5 text-sm text-stone-600">
          <h3 className="font-semibold text-stone-900">How it works</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Friend clicks your link or enters your code at sign-up.</li>
            <li>They verify their email (one-time code from us).</li>
            <li>50 points hit each of your wallets immediately.</li>
            <li>Points apply automatically at checkout — up to 20% of your subtotal.</li>
          </ol>
        </div>
      </main>
    </>
  );
}
