'use client';

// Fullscreen photo gallery with keyboard nav (← →, Esc), swipe on mobile, and
// thumbnail strip at the bottom. Mount via a controlled `open` flag — when
// open, the page scrolls lock and Esc closes.

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

export function PhotoGallery({
  open,
  photos,
  initialIndex = 0,
  alt,
  onClose,
}: {
  open: boolean;
  photos: string[];
  initialIndex?: number;
  alt?: string;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const [mounted, setMounted] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (open) setIdx(initialIndex); }, [open, initialIndex]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIdx((i) => (i + 1) % photos.length);
      if (e.key === 'ArrowLeft')  setIdx((i) => (i - 1 + photos.length) % photos.length);
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, photos.length, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && photos.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[80] flex flex-col bg-stone-950/95 backdrop-blur"
          onClick={onClose}
        >
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <span className="text-xs uppercase tracking-wider text-white/60">
              {idx + 1} / {photos.length}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"
              aria-label="Close gallery"
            >✕</button>
          </div>

          <div
            className="relative flex flex-1 items-center justify-center px-4"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
            onTouchEnd={(e) => {
              if (!touch.current) return;
              const dx = e.changedTouches[0].clientX - touch.current.x;
              const dy = e.changedTouches[0].clientY - touch.current.y;
              if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
                if (dx < 0) setIdx((i) => (i + 1) % photos.length);
                else setIdx((i) => (i - 1 + photos.length) % photos.length);
              }
              touch.current = null;
            }}
          >
            {photos.length > 1 && (
              <button
                aria-label="Previous"
                onClick={() => setIdx((i) => (i - 1 + photos.length) % photos.length)}
                className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >‹</button>
            )}
            <motion.img
              key={idx}
              src={photos[idx]}
              alt={alt ?? `Photo ${idx + 1}`}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="max-h-[75vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
              draggable={false}
            />
            {photos.length > 1 && (
              <button
                aria-label="Next"
                onClick={() => setIdx((i) => (i + 1) % photos.length)}
                className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >›</button>
            )}
          </div>

          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-thin" onClick={(e) => e.stopPropagation()}>
              {photos.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`h-14 w-14 shrink-0 overflow-hidden rounded-md ring-2 transition ${i === idx ? 'ring-amber-400' : 'ring-transparent opacity-70 hover:opacity-100'}`}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
