// Zomato-signature animation: when the user taps +Add, the dish image
// clones, lifts, and flies in a parabolic arc into the cart icon. Vanilla
// DOM, no library — element positions read with getBoundingClientRect,
// motion driven by a CSS transition + a single transform.
//
// Caller:  flyToCart(sourceImgEl)
// Pre-req: the cart icon in the header should have id="lbc-cart-target".

export function flyToCart(source: HTMLElement | null) {
  if (typeof window === 'undefined' || !source) return;
  const target = document.getElementById('lbc-cart-target');
  if (!target) return;

  const s = source.getBoundingClientRect();
  const t = target.getBoundingClientRect();

  const clone = source.cloneNode(true) as HTMLElement;
  clone.classList.add('fly-to-cart');
  clone.style.left = `${s.left}px`;
  clone.style.top  = `${s.top}px`;
  clone.style.width  = `${s.width}px`;
  clone.style.height = `${s.height}px`;
  clone.style.borderRadius = '12px';
  // Strip interactive children so the clone is purely visual
  clone.querySelectorAll('button, input').forEach((el) => el.remove());
  document.body.appendChild(clone);

  // Force a paint, then animate to target
  requestAnimationFrame(() => {
    const tx = t.left + t.width / 2 - s.left - s.width / 2;
    const ty = t.top  + t.height / 2 - s.top  - s.height / 2;
    clone.style.transform = `translate(${tx}px, ${ty}px) scale(0.18) rotate(8deg)`;
    clone.style.opacity = '0.1';
  });

  // Cleanup after the transition finishes (matches CSS duration)
  window.setTimeout(() => clone.remove(), 800);

  // Bump the target so the cart "catches" the item
  target.classList.remove('animate-badge-pulse');
  void target.offsetWidth;
  target.classList.add('animate-badge-pulse');
}
