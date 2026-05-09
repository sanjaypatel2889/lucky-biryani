'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-store';
import { useCart } from '@/lib/cart-store';
import { LoginModal } from './LoginModal';

export function Header({ transparent = false }: { transparent?: boolean }) {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const [loginOpen, setLoginOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const solid = !transparent || scrolled;

  return (
    <header
      className={`sticky top-0 z-30 transition-all duration-300 ${
        solid
          ? 'border-b border-stone-200 bg-cream/85 backdrop-blur-md shadow-sm shadow-stone-200/30'
          : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 md:py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-display text-white shadow-md shadow-brand-300/40">L</span>
          <div className="leading-tight">
            <div className="display text-lg font-bold tracking-tight text-brand-900">Lucky Biryani</div>
            <div className="-mt-0.5 text-[10px] uppercase tracking-[0.18em] text-brand-700/70">Hyderabad · est. demo</div>
          </div>
        </Link>

        <nav className="ml-8 hidden items-center gap-7 md:flex">
          <Link href="/menu"   className={`text-sm font-medium transition ${solid ? 'text-stone-700 hover:text-brand-700' : 'text-white/90 hover:text-white'}`}>Menu</Link>
          <Link href="/book"   className={`text-sm font-medium transition ${solid ? 'text-stone-700 hover:text-brand-700' : 'text-white/90 hover:text-white'}`}>Book a table</Link>
          <Link href="/orders" className={`text-sm font-medium transition ${solid ? 'text-stone-700 hover:text-brand-700' : 'text-white/90 hover:text-white'}`}>My orders</Link>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <Link
            href="/cart"
            className={`relative rounded-md px-3 py-1.5 text-sm font-medium transition ${solid ? 'text-stone-700 hover:bg-stone-100' : 'text-white/90 hover:bg-white/10'}`}
          >
            Cart
            {count > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-brand-600 px-1 text-xs font-bold text-white shadow">
                {count}
              </span>
            )}
          </Link>
          {user ? (
            <div className="hidden items-center gap-2 md:flex">
              <span className="text-sm text-stone-600">Hi, {user.name?.split(' ')[0] ?? 'there'}</span>
              <button onClick={logout} className="btn-ghost text-sm">Logout</button>
            </div>
          ) : (
            <button onClick={() => setLoginOpen(true)} className="btn-primary text-sm">Login</button>
          )}
          <button
            className={`md:hidden rounded-md p-2 ${solid ? 'text-stone-700' : 'text-white'}`}
            onClick={() => setMobile(!mobile)}
            aria-label="Open menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobile ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobile && (
        <div className="border-t border-stone-200 bg-white md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-2">
            <Link href="/menu"   className="rounded-md px-3 py-2.5 text-sm hover:bg-stone-100" onClick={() => setMobile(false)}>Menu</Link>
            <Link href="/book"   className="rounded-md px-3 py-2.5 text-sm hover:bg-stone-100" onClick={() => setMobile(false)}>Book a table</Link>
            <Link href="/orders" className="rounded-md px-3 py-2.5 text-sm hover:bg-stone-100" onClick={() => setMobile(false)}>My orders</Link>
            {user && <button onClick={logout} className="rounded-md px-3 py-2.5 text-left text-sm hover:bg-stone-100">Logout</button>}
          </nav>
        </div>
      )}

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </header>
  );
}
