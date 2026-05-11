# Lucky Biryani Centre

End-to-end implementation of the **Build Plan v1** + **Deployment Guide v2** spec — a single-restaurant Zomato-grade platform with delivery, pickup, table booking, an own-fleet rider app, and a rule-based automation engine.

**This is a runnable scaffold, not the full 16-week production build the doc estimates.** It implements every pillar end-to-end with simplifications chosen so the whole stack runs locally with zero external accounts:

| Doc spec | This implementation | Swap path |
|---|---|---|
| Postgres + PostGIS | SQLite via Prisma | change `datasource.provider` + add postgis extension |
| Redis + BullMQ workers | `setInterval` workers in-process | swap `apps/api/src/workers/*` to BullMQ |
| NestJS backend | Express + TypeScript | structurally identical routes |
| 3 separate apps (web / admin / rider) | Single Next.js app with `/admin` and `/rider` sub-paths | extract sub-trees into separate Vercel projects |
| Razorpay live | Stub adapter (auto-approves) | set `RAZORPAY_*` env, the adapter switches automatically |
| MSG91 / WhatsApp / Resend | Console-log + DB log adapter | set provider env keys |
| Google Maps live tracking | Lat/lng list + WebSocket events | drop in the Maps JS SDK on the order tracking page |

Every external service has a **clean adapter** in `apps/api/src/services/` so promoting from stub to real is a config change.

## Quick start

Requires Node 20+ and npm 10+.

```bash
git init                            # optional
npm install                         # installs API + web workspaces
cd apps/api && npx prisma db push   # create SQLite schema
npx prisma generate
npx tsx prisma/seed.ts              # seed branch, 19 menu items, 22 tables, 3 riders, coupons
cd ../..
npm run dev                         # starts API (:4000) and web (:3000) concurrently
```

Open <http://localhost:3000>.

### Demo logins

The login flow is **email-OTP** (Brevo / Resend / dev console). OTP is random each time. In dev with no provider keys configured, the OTP is logged to the API console and the `NotificationLog` table — `scripts/get-otp.ts` reads it for automated tests.

| Role | Email | Where to land |
|---|---|---|
| Customer | `customer@lucky.test` | `/menu`, `/book`, `/orders` |
| Owner | `owner@lucky.test` | `/admin` |
| Manager (admin) | `admin@lucky.test` | `/admin` |
| Rider 1 | `rider1@lucky.test` | `/rider` |
| Rider 2 | `rider2@lucky.test` | `/rider` |
| Rider 3 | `rider3@lucky.test` | `/rider` |

### Demo coupons

- `FIRST50` — flat ₹50 off, first order, min ₹200
- `OFFPEAK10` — 10% off, min ₹200, capped at ₹100 — auto-pushed by the demand-promo worker
- `FREEDEL` — free delivery, min ₹300

## Architecture

```
d:\restruant\
├── apps/
│   ├── api/                    Express + Prisma + SQLite (port 4000)
│   │   ├── prisma/
│   │   │   ├── schema.prisma   doc §7 — users, branch, menu, orders, bookings,
│   │   │   │                   tables, riders, shifts, pings, inventory, coupons,
│   │   │   │                   reviews, loyalty, notifications
│   │   │   └── seed.ts
│   │   └── src/
│   │       ├── main.ts         entry: HTTP + WebSocket + workers
│   │       ├── auth.ts         JWT + role-gated middleware
│   │       ├── realtime.ts     ws topic-based pub/sub
│   │       ├── routes/         auth · menu · orders · bookings · rider · admin · webhooks
│   │       ├── services/
│   │       │   ├── pricing.ts  cart→quote with delivery fee, coupons, loyalty, weather
│   │       │   ├── orders.ts   state machine + side-effects + notifications
│   │       │   ├── bookings.ts §4.1.1 availability algorithm
│   │       │   ├── fleet.ts    §5.3 auto-assignment scoring + 10s offer window
│   │       │   ├── notify.ts   SMS / WA / email adapter (stubs in dev)
│   │       │   ├── payments.ts Razorpay adapter (stub in dev)
│   │       │   └── otp.ts      OTP store
│   │       └── workers/        §6.1 rule-based automations
│   └── web/                    Next.js 14 app router (port 3000)
│       └── src/
│           ├── app/
│           │   ├── page.tsx                customer landing
│           │   ├── menu/                   catalogue + customisation
│           │   ├── cart/                   live quote + checkout
│           │   ├── orders/[id]/            tracking with live rider pings
│           │   ├── book/                   reserve table
│           │   ├── bookings/[id]/          confirmation + QR code
│           │   ├── checkin/[token]/        host-tablet QR scan target
│           │   ├── admin/                  dashboard, KDS, tables, fleet, menu
│           │   └── rider/                  PWA — shift, GPS, offers, deliver
│           ├── components/                 Header, LoginModal
│           └── lib/                        api / auth-store / cart-store / ws
└── package.json                workspace root
```

## What you can demonstrate end-to-end

The repo includes `apps/api/test-e2e.ts`. Run it with the API up:

```bash
cd apps/api && npx tsx test-e2e.ts
```

It exercises:

1. Customer OTP login
2. Menu browse → price quote with delivery fee, tax, coupon
3. Online order placement + Razorpay confirmation
4. Admin walks PAID → ACCEPTED → PREPARING → READY
5. Auto-assignment picks the closest available rider
6. Rider accepts the offer, sends GPS ping, picks up, delivers
7. Customer creates a table booking; QR check-in flips to SEATED
8. Analytics show today's revenue + booking count

## Doc compliance — feature inventory

### Pillar 1 — Delivery & pickup

| Doc §3.1 feature | Status |
|---|---|
| Smart homepage | ✅ |
| Categorised menu | ✅ |
| Item customisation (spice, portion, add-ons, notes) | ✅ |
| Live cart (count badge in header, floating cart button on menu) | ✅ |
| Coupon engine (FIRST50 / OFFPEAK10 / FREEDEL) | ✅ |
| Address with lat/lng | ✅ (manual lat/lng — drop in Google Maps SDK to upgrade) |
| Live order tracking | ✅ via WebSocket |
| Reorder | ✅ `/orders/:id/reorder` |
| Ratings & reviews | API-ready (table seeded; UI Phase 1) |
| Loyalty points | ✅ earned on DELIVERED, redeemable up to 20% of subtotal |

### Pillar 2 — Table booking

| Doc §3.2 / §4 feature | Status |
|---|---|
| Reserve table | ✅ |
| Real-time availability grid | ✅ on `/admin/tables` |
| Smallest-fit table selection (§4.1.1.6) | ✅ |
| 30-min slots, 90-min hold | ✅ |
| Pre-order food on bookings | API + worker ready |
| Reservation deposit | ✅ flagged customers; threshold configurable |
| QR check-in (host tablet) | ✅ `/checkin/:token` |
| Cancel/reschedule (≥1h) | ✅ |
| No-show flag (3 in 90 days → deposit mandatory) | ✅ via worker |

### Pillar 3 — Automation engine (§6.1)

| Rule | Worker |
|---|---|
| Auto-confirm payment (webhook) | `routes/webhooks.ts` razorpay handler |
| Auto-assign rider (§5.3 scoring) | `services/fleet.ts` |
| Auto out-of-stock | `transition()` decrements on PAID, hides at 0 |
| Auto release table (15 min grace) | `workers/index.ts` `noShowRelease` |
| Auto refund stale orders (>15 min PENDING_PAYMENT) | `staleOrders` |
| Auto loyalty crediting | `transition()` on DELIVERED |
| Auto review request (24h post-delivery) | `reviewRequests` |
| Auto reminder for reservation (2h prior) | `bookingReminders` |
| Auto WhatsApp updates on every state change | `notify.whatsapp(...)` from `transition()` |
| Demand-based promo (off-peak 10%) | `demandPromo` |
| Pre-order kick-off (25 min before slot) | `preOrderKick` |
| Auto-assignment retry sweep | `assignSweep` |

ML / predictive layer (§6.2) is stubbed at the architecture level — the FastAPI sidecar is not built; demand forecasting / prep-time estimator can be added in `apps/ml/`.

## Going to staging — what's still required

The doc is honest about this and so am I. To take this from "runs locally" to "running real customers":

1. **Account checklist (doc §9)** — register Razorpay, MSG91 + DLT, Meta WhatsApp, Google Cloud, Resend, Cloudflare R2.
2. **Schema swap** — change Prisma `provider` to `postgresql`, add PostGIS extension on Railway, run `prisma migrate deploy`.
3. **Workers** — replace `setInterval` calls in `workers/index.ts` with BullMQ queues backed by Redis; preserves the same rule shapes.
4. **Adapters** — populate env keys; the stubs in `services/{notify,payments}.ts` switch behaviour automatically when the relevant env is set (search for `enabled:` in `config.ts`).
5. **Maps** — add Google Maps JS SDK to `/orders/[id]/page.tsx` and `/admin/fleet/page.tsx`; the lat/lng + WebSocket pings already feed the data.
6. **Legal & brand assets (doc §10)** — only you can supply FSSAI, GST, photography, privacy policy.
7. **Deploy** — push `apps/web` to Vercel and `apps/api` to Railway; the doc's §12 step-by-step applies as written.

The 16-week project plan in §17 still applies for hardening, testing, and the photography shoot. What's here is a working spine you can build on.

## Notes on simplifications

- **JWT in cookies + localStorage**: doc-typical pattern. Move to httpOnly cookies only when XSS surface justifies the extra plumbing.
- **OTP in memory**: a single-process Map. Move to Redis with TTL when running multiple API replicas.
- **Order numbers / booking numbers** include a process-local counter; safe at single-replica scale, swap for a DB sequence at multi-replica.
- **No PWA service worker yet** for offline rider mode — the manifest is registered, but the offline cache is a Phase-1.5 concern. Real PWAs need a separate Workbox config.
- **No image uploads UI** — items have an `imageUrl` field; pasting URLs in the admin still works. A real shoot + S3/R2 uploader is a follow-up.

## Disabling automation

Background workers can be turned off entirely (useful for stepping through transitions manually):

```bash
# in apps/api/.env
ENABLE_AUTOMATION=false
```
