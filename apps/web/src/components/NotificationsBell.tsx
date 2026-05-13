'use client';

// Notifications bell — small button with an unread-count dot. Polls the
// /unread endpoint every 30s while the user is logged in. Click navigates
// to /inbox.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '@/lib/auth-store';
import { api } from '@/lib/api';

export function NotificationsBell({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) { setCount(0); return; }
    let alive = true;
    function pull() {
      api<{ count: number }>('/api/v1/notifications/unread')
        .then((r) => { if (alive) setCount(r.count); })
        .catch(() => {});
    }
    pull();
    const t = setInterval(pull, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, [user?.id]);

  if (!user) return null;

  return (
    <Link
      href="/inbox"
      aria-label={`Notifications${count ? ` (${count} new)` : ''}`}
      className={`relative inline-flex items-center rounded-md px-2 py-1.5 transition ${
        tone === 'dark' ? 'text-stone-600 hover:bg-stone-100' : 'text-white/90 hover:bg-white/10'
      }`}
    >
      <Bell size={16} />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow ring-2 ring-cream">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
