// Coloured rating pill — green ≥ 4.0, amber 3.0–3.9, red < 3.0.
// Matches the universal "trust at a glance" pill pattern used across
// food-delivery apps. Tiny, inline, fixed-width.

export function RatingPill({
  rating,
  count,
  size = 'md',
}: {
  rating: number | null | undefined;
  count?: number;
  size?: 'sm' | 'md';
}) {
  if (rating == null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-500">
        New
      </span>
    );
  }
  const tone =
    rating >= 4.0 ? 'bg-emerald-600 text-white'
    : rating >= 3.0 ? 'bg-amber-500 text-white'
    : 'bg-rose-600 text-white';
  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs';
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md font-bold tabular-nums ${tone} ${padding}`}>
      {rating.toFixed(1)}
      <span aria-hidden className="text-[10px] leading-none">★</span>
      {count != null && count > 0 && (
        <span className="ml-1 font-normal opacity-80">({count > 999 ? '999+' : count})</span>
      )}
    </span>
  );
}
