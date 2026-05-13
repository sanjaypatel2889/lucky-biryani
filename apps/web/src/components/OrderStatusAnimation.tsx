'use client';

// Animated illustration that matches the current order status. SVG +
// framer-motion only — no Lottie JSON files needed. Picks a different
// scene per state: cook, ready, scooter, delivered, cancelled.

import { motion } from 'framer-motion';

type Status =
  | 'PENDING_PAYMENT' | 'PAID' | 'ACCEPTED' | 'PREPARING'
  | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED'
  | 'CANCELLED' | 'REFUNDED';

export function OrderStatusAnimation({ status, height = 140 }: { status: Status; height?: number }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 ring-1 ring-stone-100"
      style={{ height }}
      aria-hidden
    >
      <div className="absolute inset-0">
        {(status === 'PAID' || status === 'ACCEPTED') && <PotScene />}
        {status === 'PREPARING' && <SteamingPotScene />}
        {status === 'READY' && <BoxScene />}
        {status === 'OUT_FOR_DELIVERY' && <ScooterScene />}
        {status === 'DELIVERED' && <DeliveredScene />}
        {(status === 'CANCELLED' || status === 'REFUNDED') && <CancelledScene />}
        {status === 'PENDING_PAYMENT' && <PaymentPendingScene />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scenes — each is a small SVG vignette inspired by the dish, the kitchen, or
// the road. All paths are hand-drawn here; no external assets.
// ---------------------------------------------------------------------------

function PotScene() {
  return (
    <svg viewBox="0 0 320 140" className="h-full w-full">
      <defs>
        <linearGradient id="pot1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c2410c" />
          <stop offset="1" stopColor="#7c2d12" />
        </linearGradient>
      </defs>
      <ellipse cx="160" cy="118" rx="100" ry="8" fill="rgba(0,0,0,0.08)" />
      <motion.g
        initial={{ y: 6, rotate: 0 }}
        animate={{ y: [6, 2, 6], rotate: [-1, 1, -1] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '160px 80px' }}
      >
        <rect x="100" y="70" width="120" height="48" rx="10" fill="url(#pot1)" />
        <rect x="92" y="64" width="136" height="12" rx="6" fill="#1c1917" opacity="0.85" />
        <rect x="150" y="56" width="20" height="10" rx="3" fill="#fbbf24" />
      </motion.g>
    </svg>
  );
}

function SteamingPotScene() {
  return (
    <svg viewBox="0 0 320 140" className="h-full w-full">
      {/* steam wisps */}
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={i}
          cx={130 + i * 30}
          cy={50}
          r={6}
          fill="rgba(255,255,255,0.6)"
          initial={{ opacity: 0, y: 0, scale: 0.7 }}
          animate={{ opacity: [0, 0.8, 0], y: -40, scale: 1.4 }}
          transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.5 }}
        />
      ))}
      <PotScene />
    </svg>
  );
}

function BoxScene() {
  return (
    <svg viewBox="0 0 320 140" className="h-full w-full">
      <motion.g
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <rect x="120" y="58" width="80" height="56" rx="6" fill="#a16207" />
        <rect x="120" y="58" width="80" height="14" rx="6" fill="#854d0e" />
        <rect x="155" y="50" width="10" height="14" fill="#fbbf24" />
        <text x="160" y="98" textAnchor="middle" fontSize="11" fill="#fef3c7" fontWeight="700">READY</text>
      </motion.g>
      <motion.circle
        cx="245" cy="76" r="14" fill="#10b981"
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, type: 'spring' }}
      />
      <motion.path
        d="M239 76 l4 4 l8 -8"
        stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.6, duration: 0.4 }}
      />
    </svg>
  );
}

function ScooterScene() {
  return (
    <svg viewBox="0 0 320 140" className="h-full w-full">
      {/* dashed road */}
      <motion.line
        x1="0" y1="110" x2="320" y2="110"
        stroke="#fcd34d" strokeWidth="3" strokeDasharray="14 12"
        initial={{ strokeDashoffset: 0 }}
        animate={{ strokeDashoffset: -26 }}
        transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
      />
      <motion.g
        initial={{ x: -120 }}
        animate={{ x: 360 }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'linear' }}
      >
        {/* rider body */}
        <circle cx="60" cy="58" r="9" fill="#fef3c7" stroke="#78350f" strokeWidth="2" />
        <rect x="46" y="60" width="34" height="22" rx="5" fill="#c2410c" />
        {/* delivery box */}
        <rect x="22" y="56" width="22" height="22" rx="3" fill="#7c2d12" />
        <rect x="24" y="58" width="18" height="6" fill="#fbbf24" />
        {/* scooter frame */}
        <path d="M30 90 L80 90 L92 78 L78 78" stroke="#1c1917" strokeWidth="4" fill="none" strokeLinecap="round" />
        {/* wheels */}
        <motion.circle cx="38" cy="96" r="9" fill="#1c1917"
          animate={{ rotate: 360 }} transition={{ duration: 0.4, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '38px 96px' }}
        />
        <circle cx="38" cy="96" r="3" fill="#a8a29e" />
        <motion.circle cx="85" cy="96" r="9" fill="#1c1917"
          animate={{ rotate: 360 }} transition={{ duration: 0.4, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '85px 96px' }}
        />
        <circle cx="85" cy="96" r="3" fill="#a8a29e" />
      </motion.g>
    </svg>
  );
}

function DeliveredScene() {
  return (
    <svg viewBox="0 0 320 140" className="h-full w-full">
      {/* confetti */}
      {Array.from({ length: 14 }).map((_, i) => {
        const x = 30 + i * 19;
        const colors = ['#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#a855f7'];
        return (
          <motion.rect
            key={i}
            x={x} y={-6} width={4} height={9}
            fill={colors[i % colors.length]}
            initial={{ y: -10, opacity: 0, rotate: 0 }}
            animate={{ y: 150, opacity: [0, 1, 1, 0], rotate: 360 }}
            transition={{ duration: 1.4 + (i % 5) * 0.2, delay: i * 0.05, repeat: Infinity, repeatDelay: 1.2 }}
          />
        );
      })}
      {/* check badge */}
      <motion.g
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 12 }}
      >
        <circle cx="160" cy="70" r="32" fill="#10b981" />
        <motion.path
          d="M146 72 l10 10 l20 -22"
          stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.25, duration: 0.5 }}
        />
      </motion.g>
      <text x="160" y="120" textAnchor="middle" fontSize="12" fill="#065f46" fontWeight="700">DELIVERED</text>
    </svg>
  );
}

function CancelledScene() {
  return (
    <svg viewBox="0 0 320 140" className="h-full w-full">
      <motion.g initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.4 }}>
        <circle cx="160" cy="70" r="32" fill="#fecaca" />
        <path d="M146 56 l28 28 M174 56 l-28 28" stroke="#b91c1c" strokeWidth="5" strokeLinecap="round" />
      </motion.g>
      <text x="160" y="120" textAnchor="middle" fontSize="12" fill="#7f1d1d" fontWeight="700">CANCELLED</text>
    </svg>
  );
}

function PaymentPendingScene() {
  return (
    <svg viewBox="0 0 320 140" className="h-full w-full">
      <motion.rect
        x="118" y="50" width="84" height="48" rx="6" fill="#1c1917"
        initial={{ y: 56 }} animate={{ y: [56, 50, 56] }} transition={{ duration: 2.4, repeat: Infinity }}
      />
      <rect x="118" y="60" width="84" height="8" fill="#fbbf24" />
      <rect x="126" y="78" width="22" height="6" rx="1" fill="#fef3c7" />
      <text x="160" y="120" textAnchor="middle" fontSize="11" fill="#7c2d12" fontWeight="700">AWAITING PAYMENT</text>
    </svg>
  );
}
