'use client';

// Post-delivery prompt — rate the food, rate the rider, and add a tip.
// Wires into the existing /reviews POST + /orders/:id/tip endpoints.
// Auto-shows once when an order page is viewed in DELIVERED state and no
// review exists yet.

import { useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const TIP_PRESETS = [20, 30, 50, 100];

export function RateAndTipModal({
  orderId,
  riderName,
  itemNames,
  onClose,
  onSubmitted,
}: {
  orderId: string;
  riderName?: string | null;
  itemNames: string[];
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const toast = useToast();
  const [foodStars, setFoodStars] = useState(0);
  const [riderStars, setRiderStars] = useState(0);
  const [comment, setComment] = useState('');
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState('');
  const [busy, setBusy] = useState(false);

  const effectiveTip = tip || Number(customTip) || 0;

  async function submit() {
    if (foodStars === 0) {
      toast.error('Tap a star to rate the food.');
      return;
    }
    setBusy(true);
    try {
      await api('/api/v1/reviews', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          rating: foodStars,
          comment: [
            comment || null,
            riderStars > 0 ? `Rider rating: ${riderStars}/5` : null,
          ].filter(Boolean).join(' · ') || undefined,
        }),
      });
      if (effectiveTip > 0) {
        await api(`/api/v1/orders/${orderId}/tip`, {
          method: 'POST',
          body: JSON.stringify({ amount: Math.round(effectiveTip) }),
        });
      }
      toast.success(effectiveTip > 0 ? `Thanks! ₹${effectiveTip} tip on its way to ${riderName ?? 'your rider'}.` : 'Thanks for the rating.');
      onSubmitted?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not save the rating.');
    }
    setBusy(false);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-stone-950/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 px-6 py-5 text-white">
          <h3 className="display text-2xl font-bold">How was it?</h3>
          <p className="mt-1 text-sm text-white/85">
            Quick rating helps us — and the rider really appreciates the tip.
          </p>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Food rating */}
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-stone-500">
              The food
            </div>
            <Stars value={foodStars} onChange={setFoodStars} />
            {itemNames.length > 0 && (
              <div className="mt-1 line-clamp-1 text-xs text-stone-400">
                {itemNames.slice(0, 3).join(', ')}{itemNames.length > 3 ? '…' : ''}
              </div>
            )}
          </div>

          {/* Rider rating */}
          {riderName && (
            <div>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Your rider · {riderName}
              </div>
              <Stars value={riderStars} onChange={setRiderStars} />
            </div>
          )}

          {/* Comment */}
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Anything to add? <span className="font-normal normal-case text-stone-400">(optional)</span>
            </div>
            <textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What stood out? Anything we should fix?"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {/* Tip */}
          {riderName && (
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Tip {riderName}
              </div>
              <div className="flex flex-wrap gap-2">
                {TIP_PRESETS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => { setTip(amt); setCustomTip(''); }}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                      tip === amt
                        ? 'border-emerald-500 bg-emerald-500 text-white shadow'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-emerald-300'
                    }`}
                  >
                    ₹{amt}
                  </button>
                ))}
                <input
                  type="number"
                  inputMode="numeric"
                  value={customTip}
                  onChange={(e) => { setCustomTip(e.target.value); setTip(0); }}
                  placeholder="Custom"
                  className="w-24 rounded-full border border-stone-200 px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
                  min={0}
                  max={2000}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-stone-100 bg-stone-50 px-6 py-4">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 disabled:opacity-50"
          >
            Maybe later
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? 'Saving…' : effectiveTip > 0 ? `Send rating + ₹${effectiveTip} tip` : 'Send rating'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className={`text-3xl leading-none transition ${
            n <= display ? 'text-amber-400 scale-110' : 'text-stone-200 hover:text-amber-200'
          }`}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
        >★</button>
      ))}
      <span className="ml-2 text-sm text-stone-500">
        {value > 0
          ? ['', 'Bad', 'Meh', 'Okay', 'Great', 'Amazing'][value]
          : 'Tap to rate'}
      </span>
    </div>
  );
}
