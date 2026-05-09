# Deploying Lucky Biryani Centre to Render.com

This repo ships with a `render.yaml` blueprint that provisions everything needed to run the app: a managed Postgres database, the Express API, and the Next.js web service. Follow the steps below to go from a fresh clone to a live URL.

---

## What gets deployed

| Resource | Render type | Plan in `render.yaml` | Purpose |
|---|---|---|---|
| `lbc-db` | Postgres database | `starter` | Single source of truth — replaces the local SQLite file |
| `lbc-api` | Web service (Node) | `starter` (Singapore region) | Express API on `/api/v1/*`, WebSocket on `/ws`, in-process workers |
| `lbc-web` | Web service (Node) | `starter` (Singapore region) | Next.js 14 app — customer site, `/admin`, `/rider` |

**Cost (as of the time this guide was written):** roughly **$7/month per service** (`starter` plan) plus Postgres `starter` (~$7/mo). Total ≈ **$21/mo**. Adjust plans in `render.yaml` or the Render UI to fit your budget — see "Cost knobs" below.

> **Why not the free tier?** Free Render web services sleep after 15 minutes of inactivity. The API runs in-process workers (auto-assignment, no-show release, demand promos, review requests). If the API sleeps, those workers stop firing. Free Postgres also expires after 90 days. For a real restaurant, neither is acceptable.

---

## Prerequisites you must do yourself

These steps cannot be automated for you:

1. **Create a Render account** at https://render.com and add a payment method.
2. **Push this repo to GitHub (or GitLab/Bitbucket).** Render deploys from a connected git repo. The init step below sets up the local repo; you push it.
3. **Decide whether to use real third-party services** (Razorpay, MSG91, WhatsApp Cloud, Resend, Google Maps, Sentry, S3/R2). The app boots without any of these — every adapter falls back to a working stub. You can deploy first, then add keys later via the Render UI.

---

## One-time deploy steps

### 1. Push the repo to GitHub

```bash
# from the repo root (d:\restruant)
git init
git add .
git commit -m "Initial commit: Lucky Biryani — ready for Render"
git branch -M main
# Create an empty repo on GitHub first, then:
git remote add origin https://github.com/<your-username>/lucky-biryani.git
git push -u origin main
```

### 2. Create the Render Blueprint

1. Log in to https://dashboard.render.com.
2. Click **New** → **Blueprint**.
3. Connect the GitHub repo you just pushed.
4. Render reads `render.yaml` and shows a preview of the three resources (`lbc-db`, `lbc-api`, `lbc-web`). Click **Apply**.
5. Render provisions the database first, then runs builds for both services in parallel. First build typically takes 5–8 minutes.

### 3. Wire the cross-service URLs

After the first deploy, Render generates two URLs (e.g. `https://lbc-api.onrender.com` and `https://lbc-web.onrender.com`). Render does not auto-fill them because the values are interdependent — set them manually now.

**On the `lbc-api` service → Environment:**

| Variable | Value |
|---|---|
| `FRONTEND_URL` | `https://lbc-web.onrender.com` (your web URL) |

**On the `lbc-web` service → Environment:**

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://lbc-api.onrender.com` |
| `API_PROXY_URL` | `https://lbc-api.onrender.com` |
| `NEXT_PUBLIC_WS_URL` | `wss://lbc-api.onrender.com` (note **wss**, not https) |

Click **Save Changes** on each service. Render will redeploy automatically. `NEXT_PUBLIC_*` variables bake into the Next.js bundle at build time, so the web service rebuilds itself.

### 4. Verify

- Open `https://lbc-api.onrender.com/api/v1/health` → should return `{ ok: true, at: "..." }`.
- Open `https://lbc-web.onrender.com/` → home page loads.
- Open `https://lbc-web.onrender.com/menu` → menu items appear (the `release` step seeded the DB on first deploy).
- Try logging in with phone `+919999000003`, OTP `000000` (dev OTP works only when `DEV_OTP` is set; in this blueprint it is **deliberately unset** in prod, so set it temporarily on the API service if you want demo logins to work).

---

## Adding real third-party keys

All integrations are stubbed by default. To switch to live providers, set the corresponding env vars on `lbc-api` (or `lbc-web` for `NEXT_PUBLIC_*`). The adapter code (`apps/api/src/services/{notify,payments}.ts` and `apps/api/src/config.ts`) auto-detects presence of the key and switches behavior — no code change needed.

| Feature | Vars to set | Where |
|---|---|---|
| Razorpay payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | `lbc-api` |
| SMS / OTP via MSG91 | `MSG91_AUTH_KEY`, `MSG91_DLT_TEMPLATE_ID_OTP` | `lbc-api` |
| WhatsApp Cloud | `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_VERIFY_TOKEN` | `lbc-api` |
| Email (Resend) | `RESEND_API_KEY` | `lbc-api` |
| Google Maps server-side | `GOOGLE_MAPS_SERVER_KEY` | `lbc-api` |
| Google Maps client-side | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `lbc-web` (rebuild required) |
| S3 / Cloudflare R2 image storage | `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION` | `lbc-api` |
| Sentry (backend) | `SENTRY_DSN_BACKEND` | `lbc-api` |
| Sentry (frontend) | `NEXT_PUBLIC_SENTRY_DSN_FRONTEND` | `lbc-web` (rebuild required) |

For Razorpay webhooks, set the webhook URL in the Razorpay dashboard to:
```
https://lbc-api.onrender.com/api/v1/webhooks/razorpay
```

---

## How redeploys work

- Push to `main` → Render auto-deploys both services (`autoDeploy: true` in `render.yaml`).
- The API runs `npm run release` on every deploy. That executes `prisma db push --accept-data-loss && tsx prisma/seed.ts`.
  - `prisma db push` syncs the live DB schema with `schema.prisma`. **It does not drop tables you have data in.** If a column is removed in the schema, however, that column gets dropped — so be careful with destructive schema changes.
  - The seed script has an idempotency guard: it only seeds if `branch.count() === 0`. So your customer orders / bookings are safe. To force a re-seed locally, run with `SEED_FORCE=1`.

---

## Cost knobs

You can lower cost by editing `render.yaml` (then commit and push):

| Change | Saving | Trade-off |
|---|---|---|
| Drop API plan to `free` | ~$7/mo | API sleeps after 15 min idle — workers freeze, first request after sleep takes ~30s |
| Drop Web plan to `free` | ~$7/mo | Same sleep behavior on the public site |
| Drop DB to `free` | ~$7/mo | 1 GB cap, expires 90 days after creation, no backups |
| Switch region from `singapore` to `oregon` | $0 | Adds ~250 ms latency for Indian users |

For a single-restaurant launch, `starter` plans across the board are the realistic floor. Scaling up later is one click in the Render UI.

---

## Production hardening still to do

The README's "Going to staging" section is honest about the gap between scaffold and battle-ready. The biggest items not yet addressed:

1. **Workers are in-process `setInterval` loops.** This works on a single API instance. If you ever scale the API to >1 replica (Render's `numInstances: 2+`), every replica will run every worker → duplicate auto-assignments, duplicate review requests. The fix is BullMQ + Redis as the README documents — keep the API at `numInstances: 1` until that swap happens.
2. **Health check is a simple OK ping.** Add real DB connectivity + worker liveness checks to `/api/v1/health` for proper rolling deploys.
3. **No error monitoring wired up.** Add a Sentry DSN to start capturing prod errors.
4. **JWT secret is auto-generated by Render and never rotated.** Acceptable for now; rotate annually.
5. **No backups beyond Render's daily Postgres snapshots.** Add `pg_dump` to S3 if customer data matters to you.
6. **Legal & brand assets** (FSSAI, GST display, photography, privacy policy) are placeholders only. These are non-negotiable for a real restaurant — see README §10.

---

## Troubleshooting

- **Build fails on `prisma generate`.** Ensure `DATABASE_URL` resolves; on first deploy the database may not be ready before the API build starts. Click "Manual Deploy → Deploy latest commit" once Postgres is green.
- **`Error: P1001` (can't reach DB).** `DATABASE_URL` is wrong or the DB is paused. The blueprint wires it correctly via `fromDatabase` — only happens if you edited it.
- **WebSocket disconnects every ~30s.** Render's edge keeps WS alive, but free-tier idle disconnects exist. Confirm `NEXT_PUBLIC_WS_URL` uses `wss://` not `ws://`.
- **CORS errors in browser console.** `FRONTEND_URL` on `lbc-api` does not match the actual web URL — fix and redeploy.
- **Logins via OTP `000000` stop working in prod.** Expected. `DEV_OTP` is intentionally unset in `render.yaml` so the dev backdoor closes. Set it on `lbc-api` env if you want to keep it for demos.
