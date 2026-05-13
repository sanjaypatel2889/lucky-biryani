'use client';

// Notifications inbox — the audit-trail of every outbound message we sent
// the user (order updates, booking reminders, promos, OTPs). Grouped by day,
// click to jump to the relevant order/booking page.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { useAuth } from '@/lib/auth-store';
import { api } from '@/lib/api';

type InboxItem = {
  id: string;
  template: string;
  channel: string;
  title: string;
  body: string;
  icon: string;
  tone: 'info' | 'success' | 'warning';
  url: string;
  status: string;
  createdAt: string;
};

const TONE_BG: Record<string, string> = {
  info:    'bg-sky-50 ring-sky-100',
  success: 'bg-emerald-50 ring-emerald-100',
  warning: 'bg-amber-50 ring-amber-100',
};

const CHANNEL_LABEL: Record<string, string> = {
  EMAIL: '✉ Email',
  SMS: '✆ SMS',
  WHATSAPP: '💬 WhatsApp',
  PUSH: '🔔 Push',
};

export default function InboxPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<InboxItem[] | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ items: InboxItem[] }>('/api/v1/notifications').then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [user?.id]);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="display text-3xl font-bold text-stone-900">Notifications</h1>
            <p className="mt-1 text-sm text-stone-500">Every message we have sent you, oldest at the bottom.</p>
          </div>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
            {items?.length ?? 0}
          </span>
        </div>

        {loading && <div className="mt-10 text-sm text-stone-400">Loading…</div>}

        {!loading && !user && (
          <div className="mt-10 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center">
            <p className="text-stone-600">Sign in to see your notifications.</p>
          </div>
        )}

        {user && items && items.length === 0 && (
          <div className="mt-10 rounded-2xl border border-dashed border-stone-300 bg-cream/50 p-10 text-center">
            <div className="text-4xl">🔕</div>
            <p className="mt-3 text-stone-700">Nothing here yet.</p>
            <p className="mt-1 text-sm text-stone-500">
              We&rsquo;ll drop order updates, booking reminders, and the occasional offer right here.
            </p>
            <Link href="/menu" className="btn-primary mt-5 inline-flex text-sm">Browse menu</Link>
          </div>
        )}

        {user && items && items.length > 0 && (
          <ul className="mt-6 space-y-2">
            {groupByDay(items).map(([dayLabel, group]) => (
              <li key={dayLabel}>
                <div className="mb-2 mt-4 first:mt-0 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">
                  {dayLabel}
                </div>
                <ul className="space-y-2">
                  {group.map((it) => (
                    <li key={it.id}>
                      <Link
                        href={it.url || '/orders'}
                        className={`flex items-start gap-3 rounded-xl p-3 ring-1 transition hover:shadow-md hover:shadow-stone-200 ${TONE_BG[it.tone] ?? 'bg-white ring-stone-100'}`}
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-xl shadow-sm ring-1 ring-stone-100">
                          {it.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="truncate text-sm font-semibold text-stone-900">{it.title}</h3>
                            <span className="shrink-0 text-[10px] uppercase tracking-wider text-stone-400">
                              {formatTime(it.createdAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-stone-600">{it.body}</p>
                          <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-stone-400">
                            <span>{CHANNEL_LABEL[it.channel] ?? it.channel}</span>
                            <span>·</span>
                            <span className={it.status === 'FAILED' ? 'text-rose-600' : ''}>{it.status.toLowerCase()}</span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function groupByDay(items: InboxItem[]): Array<[string, InboxItem[]]> {
  const map = new Map<string, InboxItem[]>();
  for (const it of items) {
    const k = dayLabel(it.createdAt);
    const arr = map.get(k) ?? [];
    arr.push(it);
    map.set(k, arr);
  }
  return Array.from(map.entries());
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60_000);
  if (d >= today) return 'Today';
  if (d >= yesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
