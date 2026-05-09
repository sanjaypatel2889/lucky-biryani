'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

type User = { id: string; phone: string; name?: string | null; role: string; loyaltyPoints?: number };
type Ctx = {
  user: User | null;
  loading: boolean;
  loginOTP: (phone: string) => Promise<{ devOtp?: string }>;
  verifyOTP: (phone: string, otp: string, name?: string) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const tok = typeof window !== 'undefined' ? localStorage.getItem('lbc_token') : null;
    if (!tok) { setUser(null); setLoading(false); return; }
    try {
      const r = await api<{ user: User }>('/api/v1/auth/me');
      setUser(r.user);
    } catch { setUser(null); localStorage.removeItem('lbc_token'); }
    setLoading(false);
  }

  useEffect(() => { void refresh(); }, []);

  const value: Ctx = {
    user, loading,
    async loginOTP(phone) {
      return api('/api/v1/auth/otp/send', { method: 'POST', body: JSON.stringify({ phone }) });
    },
    async verifyOTP(phone, otp, name) {
      const r = await api<{ token: string; user: User }>('/api/v1/auth/otp/verify', {
        method: 'POST', body: JSON.stringify({ phone, otp, name }),
      });
      localStorage.setItem('lbc_token', r.token);
      setUser(r.user);
      return r.user;
    },
    logout() {
      localStorage.removeItem('lbc_token');
      setUser(null);
      void api('/api/v1/auth/logout', { method: 'POST' }).catch(() => {});
    },
    refresh,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
