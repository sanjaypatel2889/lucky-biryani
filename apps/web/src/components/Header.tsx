'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-store';
import { useCart } from '@/lib/cart-store';
import { api } from '@/lib/api';
import { LoginModal } from './LoginModal';
import { ShoppingBag, Menu as MenuIcon, X as CloseIcon } from 'lucide-react';

export function Header({ transparent = false }: { transparent?: boolean }) {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const [loginOpen, setLoginOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [member, setMember] = useState<{ active: boolean } | null>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const prevCount = useRef(count);

  // Club badge — small star next to the loyalty pill when the user has an
  // active subscription. Cheap fetch on login change only.
  useEffect(() => {
    if (!user) { setMember(null); return; }
    api<{ active: boolean }>('/api/v1/membership/me').then(setMember).catch(() => setMember(null));
  }, [user?.id]);

  // Re-trigger the badge pulse every time the cart count changes
  useEffect(() => {
    if (count !== prevCount.current && badgeRef.current) {
      const el = badgeRef.current;
      el.classList.remove('animate-badge-pulse');
      void el.offsetWidth; // restart the keyframe
      el.classList.add('animate-badge-pulse');
    }
    prevCount.current = count;
  }, [count]);

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
      <div className={`mx-auto flex max-w-7xl items-center gap-4 px-4 transition-all duration-300 ${scrolled ? 'py-2 md:py-2.5' : 'py-3 md:py-4'}`}>
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-display text-white shadow-md shadow-brand-300/40">L</span>
          <div className="leading-tight">
            <div className="display text-lg font-bold tracking-tight text-brand-900">Lucky Biryani</div>
            <div className="-mt-0.5 text-[10px] uppercase tracking-[0.18em] text-brand-700/70">Hyderabad · est. demo</div>
          </div>
        </Link>

        <nav className="ml-8 hidden items-center gap-7 md:flex">
          <Link href="/menu"      className={`text-sm font-medium transition ${solid ? 'text-stone-700 hover:text-brand-700' : 'text-white/90 hover:text-white'}`}>Menu</Link>
          <Link href="/book"      className={`text-sm font-medium transition ${solid ? 'text-stone-700 hover:text-brand-700' : 'text-white/90 hover:text-white'}`}>Book a table</Link>
          <Link href="/orders"    className={`text-sm font-medium transition ${solid ? 'text-stone-700 hover:text-brand-700' : 'text-white/90 hover:text-white'}`}>My orders</Link>
          <Link href="/favorites" className={`text-sm font-medium transition ${solid ? 'text-stone-700 hover:text-brand-700' : 'text-white/90 hover:text-white'}`}>Favourites</Link>
          <Link href="/club"      className={`text-sm font-medium transition ${solid ? 'text-amber-700 hover:text-amber-800' : 'text-amber-200 hover:text-amber-100'}`}>
            ★ Club
          </Link>
          <Link href="/refer"     className={`text-sm font-medium transition ${solid ? 'text-stone-700 hover:text-brand-700' : 'text-white/90 hover:text-white'}`}>Refer & earn</Link>
          <Link href="/help"      className={`text-sm font-medium transition ${solid ? 'text-stone-700 hover:text-brand-700' : 'text-white/90 hover:text-white'}`}>Help</Link>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <Link
            href="/cart"
            id="lbc-cart-target"
            className={`relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${solid ? 'text-stone-700 hover:bg-stone-100' : 'text-white/90 hover:bg-white/10'}`}
          >
            <ShoppingBag size={16} />
            <span className="hidden sm:inline">Cart</span>
            {count > 0 && (
              <span
                ref={badgeRef}
                className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-brand-600 px-1 text-xs font-bold text-white shadow"
              >
                {count}
              </span>
            )}
          </Link>
          {user ? (
            <div className="hidden items-center gap-2 md:flex">
              <span className="text-sm text-stone-600">Hi, {user.name?.split(' ')[0] ?? 'there'}</span>
              {member?.active && (
                <Link href="/club" className="rounded-full bg-gradient-to-br from-amber-400 to-amber-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm" title="Lucky Club member">
                  ★ CLUB
                </Link>
              )}
              {typeof user.loyaltyPoints === 'number' && user.loyaltyPoints > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800" title="Loyalty points">
                  ★ {user.loyaltyPoints}
                </span>
              )}
              <button onClick={logout} className="btn-ghost text-sm">Logout</button>
            </div>
          ) : (
            <button onClick={() => setLoginOpen(true)} className="btn-primary text-sm">Login</button>
          )}
          <button
            className={`md:hidden rounded-md p-2 transition ${solid ? 'text-stone-700' : 'text-white'}`}
            onClick={() => setMobile(!mobile)}
            aria-label={mobile ? 'Close menu' : 'Open menu'}
          >
            {mobile ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobile && (
        <div className="border-t border-stone-200 bg-white md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-2">
            <Link href="/menu"      className="rounded-md px-3 py-2.5 text-sm hover:bg-stone-100" onClick={() => setMobile(false)}>Menu</Link>
            <Link href="/book"      className="rounded-md px-3 py-2.5 text-sm hover:bg-stone-100" onClick={() => setMobile(false)}>Book a table</Link>
            <Link href="/orders"    className="rounded-md px-3 py-2.5 text-sm hover:bg-stone-100" onClick={() => setMobile(false)}>My orders</Link>
            <Link href="/favorites" className="rounded-md px-3 py-2.5 text-sm hover:bg-stone-100" onClick={() => setMobile(false)}>Favourites</Link>
            <Link href="/refer"     className="rounded-md px-3 py-2.5 text-sm hover:bg-stone-100" onClick={() => setMobile(false)}>Refer & earn</Link>
            <Link href="/help"      className="rounded-md px-3 py-2.5 text-sm hover:bg-stone-100" onClick={() => setMobile(false)}>Help</Link>
            {user && <button onClick={logout} className="rounded-md px-3 py-2.5 text-left text-sm hover:bg-stone-100">Logout</button>}
          </nav>
        </div>
      )}

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </header>
  );
}
