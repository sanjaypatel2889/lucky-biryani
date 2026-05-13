// FSSAI-style veg / non-veg indicator — a tiny outlined square with a filled
// dot inside. Green dot = vegetarian, brown dot = non-vegetarian. Sized so it
// sits inline next to a dish name.

export function VegDot({ veg, size = 12 }: { veg: boolean; size?: number }) {
  const border = veg ? 'border-emerald-700' : 'border-amber-900';
  const fill = veg ? 'bg-emerald-600' : 'bg-amber-800';
  return (
    <span
      role="img"
      aria-label={veg ? 'Vegetarian' : 'Non-vegetarian'}
      title={veg ? 'Vegetarian' : 'Non-vegetarian'}
      className={`relative inline-block shrink-0 border-[1.5px] ${border}`}
      style={{ width: size, height: size }}
    >
      <span
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${fill}`}
        style={{ width: size * 0.5, height: size * 0.5 }}
      />
    </span>
  );
}
