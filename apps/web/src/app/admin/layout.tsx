'use client';

import { useAuth } from '@/lib/auth-store';
import { LoginModal } from '@/components/LoginModal';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const TABS = [
  { href: '/admin',           label: 'Dashboard' },
  { href: '/admin/orders',    label: 'Orders / KDS' },
  { href: '/admin/tables',    label: 'Tables' },
  { href: '/admin/fleet',     label: 'Fleet' },
  { href: '/admin/menu',      label: 'Menu' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const path = usePathname();

  if (loading) return <div className="grid min-h-screen place-items-center text-slate-400">Loading…</div>;

  if (!user || !['ADMIN', 'OWNER'].includes(user.role)) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <div className="card max-w-md p-6 text-center">
          <h1 className="font-display text-2xl font-bold">Staff login required</h1>
          <p className="mt-1 text-sm text-slate-500">
            {user ? `Logged in as ${user.role.toLowerCase()} — ask an owner to grant admin access.` : 'Use a staff phone number.'}
          </p>
          <button className="btn-primary mt-4" onClick={() => setLoginOpen(true)}>Login</button>
          <p className="mt-3 text-xs text-slate-400">Demo: <strong>+919999000002</strong> (Manager) — OTP <strong>000000</strong></p>
        </div>
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link href="/admin" className="font-display text-lg font-bold text-brand-700">Lucky Biryani · Admin</Link>
          <nav className="ml-4 flex gap-1">
            {TABS.map((t) => (
              <Link key={t.href} href={t.href}
                    className={`rounded-md px-3 py-1.5 text-sm ${path === t.href ? 'bg-brand-100 font-medium text-brand-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                {t.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-slate-500">{user.name} ({user.role})</span>
            <button className="btn-ghost" onClick={logout}>Logout</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">{children}</main>
    </div>
  );
}
