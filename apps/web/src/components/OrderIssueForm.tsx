'use client';

// "Report an issue" form on an order page. Compact section with a category
// chip selector, free-text box, and submit. After submit, shows a small card
// confirming the issue is logged.

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

type Issue = {
  id: string;
  category: string;
  description: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'REJECTED';
  resolution: string | null;
  refundedAmount: number;
  createdAt: string;
  resolvedAt: string | null;
};

const CATEGORIES: Array<{ id: string; label: string; emoji: string }> = [
  { id: 'MISSING_ITEM', label: 'Missing item', emoji: '🍱' },
  { id: 'WRONG_ITEM',   label: 'Wrong item',   emoji: '↔️' },
  { id: 'COLD',         label: 'Arrived cold', emoji: '❄️' },
  { id: 'LATE',         label: 'Too late',     emoji: '⏰' },
  { id: 'QUALITY',      label: 'Quality',      emoji: '👃' },
  { id: 'BILLING',      label: 'Billing',      emoji: '💳' },
  { id: 'OTHER',        label: 'Other',        emoji: '✍️' },
];

export function OrderIssueForm({ orderId }: { orderId: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<string | null>(null);
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);

  function load() {
    api<{ issues: Issue[] }>(`/api/v1/issues/order/${orderId}`).then((r) => setIssues(r.issues)).catch(() => {});
  }
  useEffect(load, [orderId]);

  async function submit() {
    if (!cat) return toast.error('Pick a category.');
    if (desc.trim().length < 5) return toast.error('Tell us a bit more.');
    setBusy(true);
    try {
      await api('/api/v1/issues', {
        method: 'POST',
        body: JSON.stringify({ orderId, category: cat, description: desc.trim() }),
      });
      toast.success("Logged. We'll be in touch within 24h.");
      setCat(null); setDesc(''); setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not submit.');
    }
    setBusy(false);
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Something not right?</h3>
        {!open && issues.length === 0 && (
          <button onClick={() => setOpen(true)} className="rounded-full border border-stone-200 px-3 py-1 text-xs font-semibold text-stone-600 hover:border-rose-300 hover:text-rose-700">
            Report an issue
          </button>
        )}
      </div>

      {issues.length > 0 && (
        <ul className="mt-3 space-y-2">
          {issues.map((i) => (
            <li key={i.id} className={`rounded-lg border p-3 text-sm ${i.status === 'RESOLVED' ? 'border-emerald-200 bg-emerald-50' : i.status === 'REJECTED' ? 'border-stone-200 bg-stone-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-stone-800">
                  {CATEGORIES.find((c) => c.id === i.category)?.emoji ?? '•'}{' '}
                  {CATEGORIES.find((c) => c.id === i.category)?.label ?? i.category}
                </span>
                <span className={`chip ${i.status === 'RESOLVED' ? 'bg-emerald-200 text-emerald-900' : i.status === 'REJECTED' ? 'bg-stone-200 text-stone-700' : 'bg-amber-200 text-amber-900'}`}>
                  {i.status.toLowerCase()}
                </span>
              </div>
              <p className="mt-1 text-stone-600">{i.description}</p>
              {i.resolution && (
                <p className="mt-1.5 text-xs italic text-stone-500">
                  Resolution: {i.resolution}
                  {i.refundedAmount > 0 && <span className="ml-1 font-semibold text-emerald-700">· refunded ₹{i.refundedAmount}</span>}
                </p>
              )}
              <p className="mt-1 text-[11px] text-stone-400">{new Date(i.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-3 space-y-3 border-t border-stone-100 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  cat === c.id
                    ? 'border-brand-500 bg-brand-50 text-brand-800'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-brand-300'
                }`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
          <textarea
            rows={3}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="What happened? Photos help — email them to hello@luckybiryani.in with this order number."
            className="input"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-ghost text-sm">Cancel</button>
            <button onClick={submit} disabled={busy} className="btn-primary text-sm">
              {busy ? 'Sending…' : 'Submit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
