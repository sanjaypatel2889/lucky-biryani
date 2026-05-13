'use client';

// Accessible accordion. Each entry expands independently. Keyboard support:
// Enter / Space toggles, Esc closes the currently focused panel.

import { useState, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type FaqItem = { q: string; a: React.ReactNode };

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();
  return (
    <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
      {items.map((it, idx) => {
        const isOpen = open === idx;
        const panelId = `${baseId}-panel-${idx}`;
        const btnId = `${baseId}-btn-${idx}`;
        return (
          <li key={idx}>
            <h3>
              <button
                id={btnId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : idx)}
                onKeyDown={(e) => { if (e.key === 'Escape') setOpen(null); }}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-stone-900 transition hover:bg-stone-50"
              >
                <span className="text-sm font-semibold md:text-base">{it.q}</span>
                <span
                  aria-hidden
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border border-stone-200 text-stone-500 transition ${isOpen ? 'rotate-180 bg-brand-50 text-brand-700' : ''}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={panelId}
                  role="region"
                  aria-labelledby={btnId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 text-sm leading-relaxed text-stone-600">{it.a}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
