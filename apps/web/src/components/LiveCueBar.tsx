'use client';

// Live trust-cue bar — "23 orders in the last hour · Hyderabadi Chicken Biryani
// is trending tonight". Pulled live from /api/v1/menu/live-cues (public, no
// auth). Renders nothing while loading or when there's no data, so it
// gracefully disappears on fresh installs.

import { useEffect, useState } from 'react';

type Cue = {
  ordersThisHour: number;
  ordersToday: number;
  trending: { id: string; name: string; qty: number } | null;
};

export function LiveCueBar() {
  const [cue, setCue] = useState<Cue | null>(null);

  useEffect(() => {
    let alive = true;
    function load() {
      fetch('/api/v1/menu/live-cues')
        .then((r) => r.json())
        .then((j) => { if (alive) setCue(j); })
        .catch(() => {});
    }
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!cue) return null;
  const bits: string[] = [];
  if (cue.ordersThisHour > 0) bits.push(`🔥 ${cue.ordersThisHour} order${cue.ordersThisHour === 1 ? '' : 's'} in the last hour`);
  else if (cue.ordersToday > 0) bits.push(`🍛 ${cue.ordersToday} order${cue.ordersToday === 1 ? '' : 's'} today`);
  if (cue.trending) bits.push(`Trending tonight · ${cue.trending.name}`);
  if (bits.length === 0) return null;

  return (
    <div className="border-y border-emerald-200 bg-emerald-50 py-2 text-center text-xs font-medium text-emerald-800">
      {bits.join('  ·  ')}
    </div>
  );
}
