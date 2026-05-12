'use client';

// Rotates through a small list of marketing taglines, swapping every 3.5s
// with a soft cross-fade. Picks one randomly on first paint so refreshing
// doesn't always show the same first line.

import { useEffect, useState } from 'react';

const LINES = [
  "Hyderabad's most-loved dum biryani — sealed in a copper handi.",
  'Free delivery over ₹500. First order: ₹50 off with FIRST50.',
  'Open every day · 11 AM to 11 PM · 6 km service radius.',
  '70 spices. 8 hours of dum. One pot, one ritual.',
  'Live rider tracking from kitchen to door, no third-party apps.',
];

export function RotatingTagline({ className = '' }: { className?: string }) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * LINES.length));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setVisible(false);
      // After fade-out, advance the index and fade back in
      window.setTimeout(() => {
        setIdx((i) => (i + 1) % LINES.length);
        setVisible(true);
      }, 320);
    }, 3500);
    return () => window.clearInterval(tick);
  }, []);

  return (
    <span
      className={`inline-block transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'} ${className}`}
      aria-live="polite"
    >
      {LINES[idx]}
    </span>
  );
}
