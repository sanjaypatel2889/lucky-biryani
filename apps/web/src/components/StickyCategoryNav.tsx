'use client';

// Sticky category sidebar with scroll-spy. As the user scrolls the menu, the
// active category in the list highlights. Uses IntersectionObserver against
// the category section headings.

import { useEffect, useRef, useState } from 'react';

type Category = { id: string; name: string; slug: string };

export function StickyCategoryNav({
  categories,
  countByCat,
  header,
}: {
  categories: Category[];
  countByCat: Map<string, number>;
  header?: React.ReactNode;
}) {
  const [active, setActive] = useState<string | null>(categories[0]?.id ?? null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const headings = categories
      .map((c) => document.getElementById(`cat-${c.slug}`))
      .filter((el): el is HTMLElement => !!el);

    if (!headings.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) {
          const slug = visible.target.id.replace(/^cat-/, '');
          const cat = categories.find((c) => c.slug === slug);
          if (cat) setActive(cat.id);
        }
      },
      { rootMargin: '-110px 0px -55% 0px', threshold: [0, 0.1, 0.5, 1] },
    );

    for (const h of headings) obs.observe(h);
    return () => obs.disconnect();
  }, [categories]);

  function jump(c: Category) {
    setActive(c.id);
    const el = document.getElementById(`cat-${c.slug}`);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  return (
    <div className="card p-4">
      {header}
      <ul
        ref={listRef}
        className={`space-y-0.5 ${header ? 'mt-3 border-t border-stone-100 pt-3' : ''}`}
      >
        {categories.map((c) => {
          const n = countByCat.get(c.id) ?? 0;
          if (!n) return null;
          const isActive = active === c.id;
          return (
            <li key={c.id}>
              <button
                onClick={() => jump(c)}
                className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm transition ${
                  isActive
                    ? 'bg-brand-100/80 font-semibold text-brand-900 ring-1 ring-brand-200'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <span className="flex items-center gap-2">
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />}
                  {c.name}
                </span>
                <span className={`text-xs ${isActive ? 'text-brand-700' : 'text-stone-400'}`}>{n}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
