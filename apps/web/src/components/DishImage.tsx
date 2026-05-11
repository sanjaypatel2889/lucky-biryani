'use client';

// Resilient dish image. Tries the supplied URL; on any load error, swaps to a
// deterministic CSS-gradient + emoji + dish-name placeholder so the card
// never renders blank.
//
//   <DishImage src={dishPhoto(item.name, item.categoryName)}
//              name={item.name} category={item.categoryName} className="..." />

import { useMemo, useState } from 'react';

type Props = {
  src?: string | null;
  name: string;
  category?: string | null;
  className?: string;
  alt?: string;
};

export function DishImage({ src, name, category, className, alt }: Props) {
  const [failed, setFailed] = useState(false);
  const placeholder = useMemo(() => buildPlaceholder(name, category ?? undefined), [name, category]);

  if (!src || failed) {
    return (
      <div
        className={className}
        style={{
          background: placeholder.gradient,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          color: '#fff',
          textShadow: '0 1px 3px rgba(0,0,0,0.35)',
          fontFamily: 'inherit',
          position: 'relative',
          overflow: 'hidden',
        }}
        aria-label={alt ?? name}
      >
        <span style={{ fontSize: '46px', lineHeight: 1 }}>{placeholder.emoji}</span>
        <span style={{ fontSize: '13px', fontWeight: 600, padding: '0 12px', textAlign: 'center' }}>
          {name}
        </span>
        {/* subtle dot pattern overlay */}
        <span
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '14px 14px',
            mixBlendMode: 'overlay',
          }}
        />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt ?? name}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

// Stable category → emoji + gradient mapping. Names that don't match a known
// category get a generic plate emoji on a warm gradient.
function buildPlaceholder(name: string, category?: string) {
  const lower = name.toLowerCase();
  // Try by dish keywords first — emoji feels right for "Mango Lassi" even if
  // the category is just "Beverages".
  for (const [keyword, m] of KEYWORD_MAP) {
    if (lower.includes(keyword)) return m;
  }
  if (category && CATEGORY_MAP[category]) return CATEGORY_MAP[category];
  return DEFAULT_PLACEHOLDER;
}

type Placeholder = { emoji: string; gradient: string };

const DEFAULT_PLACEHOLDER: Placeholder = {
  emoji: '🍽️',
  gradient: 'linear-gradient(135deg, #c2410c 0%, #9a3412 100%)',
};

// Order matters — more specific keywords first.
const KEYWORD_MAP: Array<[string, Placeholder]> = [
  ['biryani',    { emoji: '🍛', gradient: 'linear-gradient(135deg, #d97706 0%, #92400e 100%)' }],
  ['mutton',     { emoji: '🍖', gradient: 'linear-gradient(135deg, #b45309 0%, #7c2d12 100%)' }],
  ['prawn',      { emoji: '🦐', gradient: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)' }],
  ['chicken 65', { emoji: '🍗', gradient: 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)' }],
  ['butter chicken', { emoji: '🍛', gradient: 'linear-gradient(135deg, #ea580c 0%, #9a3412 100%)' }],
  ['chicken',    { emoji: '🍗', gradient: 'linear-gradient(135deg, #d97706 0%, #78350f 100%)' }],
  ['paneer',     { emoji: '🧀', gradient: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)' }],
  ['manchurian', { emoji: '🥡', gradient: 'linear-gradient(135deg, #65a30d 0%, #365314 100%)' }],
  ['dal',        { emoji: '🍲', gradient: 'linear-gradient(135deg, #a16207 0%, #713f12 100%)' }],
  ['naan',       { emoji: '🫓', gradient: 'linear-gradient(135deg, #ca8a04 0%, #713f12 100%)' }],
  ['roti',       { emoji: '🫓', gradient: 'linear-gradient(135deg, #b45309 0%, #78350f 100%)' }],
  ['bread',      { emoji: '🍞', gradient: 'linear-gradient(135deg, #d97706 0%, #92400e 100%)' }],
  ['lassi',      { emoji: '🥭', gradient: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)' }],
  ['chai',       { emoji: '🍵', gradient: 'linear-gradient(135deg, #a16207 0%, #422006 100%)' }],
  ['tea',        { emoji: '🍵', gradient: 'linear-gradient(135deg, #a16207 0%, #422006 100%)' }],
  ['soft',       { emoji: '🥤', gradient: 'linear-gradient(135deg, #6366f1 0%, #312e81 100%)' }],
  ['drink',      { emoji: '🥤', gradient: 'linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)' }],
  ['meetha',     { emoji: '🍮', gradient: 'linear-gradient(135deg, #f59e0b 0%, #92400e 100%)' }],
  ['jamun',      { emoji: '🍩', gradient: 'linear-gradient(135deg, #d97706 0%, #7c2d12 100%)' }],
  ['qubani',     { emoji: '🍑', gradient: 'linear-gradient(135deg, #ea580c 0%, #9a3412 100%)' }],
  ['curry',      { emoji: '🍛', gradient: 'linear-gradient(135deg, #c2410c 0%, #7c2d12 100%)' }],
  ['veg',        { emoji: '🥗', gradient: 'linear-gradient(135deg, #16a34a 0%, #14532d 100%)' }],
];

const CATEGORY_MAP: Record<string, Placeholder> = {
  Biryani:    { emoji: '🍛', gradient: 'linear-gradient(135deg, #d97706 0%, #92400e 100%)' },
  Appetisers: { emoji: '🍢', gradient: 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)' },
  Curries:    { emoji: '🍲', gradient: 'linear-gradient(135deg, #c2410c 0%, #7c2d12 100%)' },
  Breads:     { emoji: '🫓', gradient: 'linear-gradient(135deg, #ca8a04 0%, #713f12 100%)' },
  Desserts:   { emoji: '🍮', gradient: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)' },
  Beverages:  { emoji: '🥤', gradient: 'linear-gradient(135deg, #0ea5e9 0%, #075985 100%)' },
};
