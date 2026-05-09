'use client';

import { useAuth } from '@/lib/auth-store';
import { LoginModal } from '@/components/LoginModal';
import { useState } from 'react';

export default function RiderLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) return <div className="grid min-h-screen place-items-center">…</div>;

  if (!user || user.role !== 'RIDER') {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <div className="card max-w-sm p-6 text-center">
          <h1 className="font-display text-2xl font-bold">Rider login</h1>
          <p className="mt-1 text-sm text-slate-500">Use your registered phone.</p>
          <button className="btn-primary mt-4" onClick={() => setOpen(true)}>Login</button>
          <p className="mt-3 text-xs text-slate-400">Demo riders: <strong>+919999000010 / 11 / 12</strong> · OTP <strong>000000</strong></p>
        </div>
        <LoginModal open={open} onClose={() => setOpen(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="font-display text-lg font-bold text-brand-700">Rider</h1>
        <span className="ml-auto text-sm text-slate-500">{user.name}</span>
        <button onClick={logout} className="btn-ghost text-xs">Logout</button>
      </header>
      <main className="mx-auto max-w-md p-3">{children}</main>
    </div>
  );
}
