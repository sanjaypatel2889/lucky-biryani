'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type CartLine = {
  itemId: string;
  name: string;
  qty: number;
  unitPrice: number;
  modifierIds: string[];
  modifierLabels: string[];
  notes?: string;
};

type Ctx = {
  lines: CartLine[];
  add: (line: CartLine) => void;
  setQty: (idx: number, qty: number) => void;
  remove: (idx: number) => void;
  clear: () => void;
  total: number;
  count: number;
};

const CartCtx = createContext<Ctx | null>(null);

const KEY = 'lbc_cart_v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(lines)); }, [lines]);

  const value: Ctx = useMemo(() => ({
    lines,
    add(line) {
      setLines((cur) => {
        // merge if identical config
        const key = (l: CartLine) => `${l.itemId}|${l.modifierIds.sort().join(',')}|${l.notes ?? ''}`;
        const idx = cur.findIndex((l) => key(l) === key(line));
        if (idx >= 0) {
          const copy = [...cur];
          copy[idx] = { ...copy[idx], qty: copy[idx].qty + line.qty };
          return copy;
        }
        return [...cur, line];
      });
    },
    setQty(idx, qty) {
      setLines((cur) => {
        if (qty <= 0) return cur.filter((_, i) => i !== idx);
        return cur.map((l, i) => (i === idx ? { ...l, qty } : l));
      });
    },
    remove(idx) { setLines((cur) => cur.filter((_, i) => i !== idx)); },
    clear() { setLines([]); },
    total: lines.reduce((s, l) => s + l.unitPrice * l.qty, 0),
    count: lines.reduce((s, l) => s + l.qty, 0),
  }), [lines]);

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error('useCart outside CartProvider');
  return ctx;
}
