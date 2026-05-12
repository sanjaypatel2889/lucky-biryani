'use client';

// Thin gradient bar at the top of the viewport that grows with scroll
// position. Uses requestAnimationFrame to throttle, sets a CSS variable
// so transform happens on the GPU.

import { useEffect } from 'react';

export function ScrollProgress() {
  useEffect(() => {
    let ticking = false;
    function update() {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const p = max > 0 ? Math.min(1, h.scrollTop / max) : 0;
      h.style.setProperty('--p', String(p));
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
  }, []);
  return <div className="scroll-progress" aria-hidden="true" />;
}
