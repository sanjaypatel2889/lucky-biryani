'use client';

// Parallax wrapper. Translates the child element vertically based on the
// page scroll position multiplied by `speed` (0–1). Speed 0.3 = element
// moves 30% as fast as the viewport. Honors prefers-reduced-motion.
//
//   <Parallax speed={0.4}><img src="hero.jpg" /></Parallax>

import { useEffect, useRef, useState } from 'react';

export function Parallax({ children, speed = 0.3, className = '' }: { children: React.ReactNode; speed?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let ticking = false;
    function update() {
      const el = ref.current;
      if (!el) { ticking = false; return; }
      const rect = el.getBoundingClientRect();
      // Distance the element's center is from the viewport center
      const centerOffset = rect.top + rect.height / 2 - window.innerHeight / 2;
      setOffset(centerOffset * -speed);
      ticking = false;
    }
    function onScroll() {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [speed]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ transform: `translate3d(0, ${offset}px, 0)`, willChange: 'transform' }}
    >
      {children}
    </div>
  );
}
