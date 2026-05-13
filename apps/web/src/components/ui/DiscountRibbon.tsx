// Corner discount ribbon — overlays the top-right of a dish/restaurant card.
// Pulls discount from the active home-page coupon (FIRST50 / OFFPEAK10 / FREEDEL).
// Hidden when there's nothing on offer.

export function DiscountRibbon({
  label,
  tone = 'brand',
  position = 'top-right',
}: {
  label: string;
  tone?: 'brand' | 'emerald' | 'amber';
  position?: 'top-right' | 'top-left' | 'bottom-left';
}) {
  if (!label) return null;
  const tones: Record<string, string> = {
    brand:   'bg-gradient-to-br from-brand-500 to-brand-700',
    emerald: 'bg-gradient-to-br from-emerald-500 to-emerald-700',
    amber:   'bg-gradient-to-br from-amber-500 to-amber-700',
  };
  const pos: Record<string, string> = {
    'top-right':   'right-2 top-2',
    'top-left':    'left-2 top-2',
    'bottom-left': 'left-2 bottom-2',
  };
  return (
    <span
      className={`absolute z-10 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-md ${tones[tone]} ${pos[position]}`}
    >
      <span aria-hidden>%</span>
      {label}
    </span>
  );
}
