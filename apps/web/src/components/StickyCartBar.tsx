'use client';

// Sticky bottom "View Cart" bar — appears as soon as the cart has items.
// Slides up from the bottom on first add, stays glued to viewport.
// Disappears on the cart and checkout routes (would be redundant there).

import { useCart } from '@/lib/cart-store';
import { usePathname, useRouter } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function StickyCartBar() {
  const { count, total } = useCart();
  const pathname = usePathname();
  const router = useRouter();

  const hiddenOn = pathname === '/cart' || pathname?.startsWith('/orders') || pathname?.startsWith('/admin') || pathname?.startsWith('/rider');
  const visible = count > 0 && !hiddenOn;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 px-3"
          style={{ width: 'min(92vw, 720px)' }}
        >
          <button
            onClick={() => router.push('/cart')}
            className="group flex w-full items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-4 text-white shadow-2xl shadow-emerald-900/40 ring-1 ring-emerald-400/30 transition hover:from-emerald-700 hover:to-emerald-800"
          >
            <div className="flex items-center gap-3">
              <span className="relative grid h-9 w-9 place-items-center rounded-full bg-white/20">
                <ShoppingBag size={18} />
                <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-amber-400 px-1 text-[11px] font-bold text-stone-900 shadow">
                  {count}
                </span>
              </span>
              <div className="text-left leading-tight">
                <div className="text-[11px] font-medium uppercase tracking-wider text-white/80">
                  {count} {count === 1 ? 'item' : 'items'} added
                </div>
                <div className="text-base font-bold">₹{total.toFixed(0)} · view cart</div>
              </div>
            </div>
            <span className="hidden text-sm font-semibold sm:inline-flex items-center gap-1">
              Checkout
              <span className="transition group-hover:translate-x-0.5">→</span>
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
