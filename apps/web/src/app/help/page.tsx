'use client';

// Help / FAQ page. Static content + a "Need a human?" CTA. Searchable so
// people don't have to scroll the full list.

import { useMemo, useState } from 'react';
import { Header } from '@/components/Header';
import Link from 'next/link';

type FaqItem = { q: string; a: string };
type FaqSection = { title: string; emoji: string; items: FaqItem[] };

const FAQ: FaqSection[] = [
  {
    title: 'Ordering & delivery',
    emoji: '🛵',
    items: [
      { q: 'How long does delivery take?', a: 'Most deliveries arrive in 25–35 minutes. The live tracker on your order page shows the exact ETA based on prep + distance.' },
      { q: 'What is your delivery area?', a: 'About a 6 km radius around Banjara Hills. If the cart says "out of zone", we cannot deliver to that address yet.' },
      { q: 'Is there a minimum order?', a: 'Yes — ₹150 minimum for delivery. Pickup orders have no minimum.' },
      { q: 'Do you charge a delivery fee?', a: 'Base ₹30 + ₹8/km after the first kilometre. Orders over ₹500 ship free. Use code FREEDEL on orders over ₹300.' },
      { q: 'Can I schedule an order for later?', a: 'Yes — pick the "Schedule" tab in the cart and choose any time at least 20 minutes in the future, within our hours.' },
      { q: 'Can I cancel after paying?', a: 'You can cancel for free until the kitchen accepts the order (usually 2–3 minutes). After that, please call us.' },
    ],
  },
  {
    title: 'Payments & coupons',
    emoji: '💳',
    items: [
      { q: 'What payment methods do you accept?', a: 'UPI, credit/debit cards, netbanking, and wallets via Razorpay. Cash on delivery is available up to ₹2,000 for first orders and ₹5,000 after.' },
      { q: 'What coupons are available?', a: 'FIRST50 (₹50 off your first order), OFFPEAK10 (10% off on orders above ₹200), FREEDEL (free delivery on orders above ₹300).' },
      { q: 'How do loyalty points work?', a: 'Earn 1 point for every ₹100 spent — 1 point = ₹1 off, capped at 20% of your subtotal. Points credit when the order is delivered.' },
    ],
  },
  {
    title: 'Bookings & dine-in',
    emoji: '🍽',
    items: [
      { q: 'How far in advance can I book?', a: 'Up to 30 days. Tables are held for 90 minutes from your slot start.' },
      { q: 'What if I am running late?', a: 'We hold the table for 15 minutes past your slot start. Beyond that, the system marks it a no-show and may release the table.' },
      { q: 'Can I pre-order food?', a: 'Yes — on the booking page after confirming, hit "Pre-order your food". We start cooking 25 minutes before your slot so it lands as you sit down.' },
      { q: 'How do I check in?', a: 'Show the QR code from your booking to the host. The QR is also on the booking confirmation we email you.' },
    ],
  },
  {
    title: 'Refunds & issues',
    emoji: '🆘',
    items: [
      { q: 'My order is late — what now?', a: 'Open the order page; the tracker is real-time. If the rider is delayed, you can chat them through the chat box on the same page. If something is genuinely wrong, call us at +91 99990 00001 — we will make it right.' },
      { q: 'Something arrived wrong / cold.', a: 'Email hello@luckybiryani.in with your order number and a photo. Our standard is a full refund or remake — no questions for orders under ₹500.' },
      { q: 'Allergens / dietary restrictions?', a: 'Every menu item lists its allergens and dietary tags (vegan, jain, halal, eggless, etc). Use the filters on the menu page. For severe allergies, please call ahead so we can confirm the line.' },
    ],
  },
  {
    title: 'Account & privacy',
    emoji: '🔐',
    items: [
      { q: 'How do I log in?', a: 'Enter your email — we send a 6-digit code. No password to remember.' },
      { q: 'How is my data used?', a: 'Only to fulfil your orders, run loyalty, and improve recommendations. We do not sell your data. See our Privacy Policy.' },
      { q: 'Can I delete my account?', a: 'Yes — email hello@luckybiryani.in and we will purge your data within 30 days, except records required for tax (7 years per GST law).' },
    ],
  },
];

export default function HelpPage() {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return FAQ;
    return FAQ.map((s) => ({
      ...s,
      items: s.items.filter((i) => i.q.toLowerCase().includes(needle) || i.a.toLowerCase().includes(needle)),
    })).filter((s) => s.items.length > 0);
  }, [q]);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="display text-4xl font-bold text-stone-900">How can we help?</h1>
        <p className="mt-2 text-stone-600">Tap a topic, or search if you know what you are looking for.</p>

        <input
          className="input mt-6"
          placeholder="Search the FAQ — delivery, refund, coupon…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {filtered.length === 0 && (
          <div className="mt-10 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center">
            <p className="text-stone-600">No FAQ matched "{q}".</p>
            <p className="mt-1 text-sm text-stone-500">Try Lucky AI in the bottom-right corner, or call +91 99990 00001.</p>
          </div>
        )}

        {filtered.map((s) => (
          <section key={s.title} className="mt-8">
            <h2 className="display text-2xl font-bold text-stone-900">
              <span className="mr-2">{s.emoji}</span>{s.title}
            </h2>
            <div className="mt-3 space-y-2">
              {s.items.map((it, i) => (
                <details key={i} className="card group p-4 open:bg-cream/40">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-stone-800">
                    <span className="text-stone-400 group-open:hidden">+ </span>
                    <span className="text-stone-400 hidden group-open:inline">− </span>
                    {it.q}
                  </summary>
                  <p className="mt-2 text-sm text-stone-600">{it.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}

        <div className="mt-12 rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 p-6 text-white shadow-lg">
          <h3 className="display text-2xl font-bold">Still stuck?</h3>
          <p className="mt-1 text-white/85">Lucky AI (bottom-right) can answer most questions instantly. For anything else:</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="tel:+919999000001" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm hover:bg-cream">📞 Call us</a>
            <a href="mailto:hello@luckybiryani.in" className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/25">✉ Email</a>
            <a href="https://wa.me/919999000001" target="_blank" rel="noreferrer" className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/25">💬 WhatsApp</a>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-2 text-center text-xs text-stone-500 sm:grid-cols-4">
          <Link href="/privacy" className="rounded-md border border-stone-200 px-3 py-2 hover:bg-stone-50">Privacy Policy</Link>
          <Link href="/terms"   className="rounded-md border border-stone-200 px-3 py-2 hover:bg-stone-50">Terms of Service</Link>
          <Link href="/orders"  className="rounded-md border border-stone-200 px-3 py-2 hover:bg-stone-50">My orders</Link>
          <Link href="/refer"   className="rounded-md border border-stone-200 px-3 py-2 hover:bg-stone-50">Refer & earn</Link>
        </div>
      </main>
    </>
  );
}
