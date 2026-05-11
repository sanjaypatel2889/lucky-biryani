# Deploying Lucky Biryani Centre

This repo deploys as a **free 3-host hybrid**: Neon Postgres + Render API + Vercel web. Total cost: **₹0/month** for low traffic, ~$5–7/mo if you want the API to stop sleeping.

```
        ┌──────────────────┐         ┌────────────────────┐
        │  Vercel (web)    │ ──────▶ │  Render (lbc-api)  │
        │  apps/web        │  HTTPS  │  apps/api          │
        │  Next.js 14      │  + WSS  │  Express + WS      │
        └────────┬─────────┘         └─────────┬──────────┘
                 │                             │
                 │                             ▼
                 │                   ┌─────────────────────┐
                 └──────────────────▶│   Neon Postgres      │
                                     │   (free 3 GB)        │
                                     └─────────────────────┘
```

---

## Prerequisites you must do yourself

These can't be automated:

1. **Push the repo to GitHub** (Render and Vercel deploy from a git remote).
2. **Create three accounts** — all free:
   - [neon.tech](https://neon.tech) — for the Postgres DB
   - [render.com](https://render.com) — for the API
   - [vercel.com](https://vercel.com) — for the Next.js web

---

## Step 1 — Provision the database (Neon)

1. Sign up at https://neon.tech.
2. Create a project named `lucky-biryani`. Region: **Singapore** (closest to most Indian users).
3. Once provisioned, open **Connection Details → Connection string (pooled)** and copy it. It looks like:
   ```
   postgresql://USER:PASSWORD@ep-foo-bar-12345.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Save this — you'll paste it into Render in the next step.

---

## Step 2 — Deploy the API (Render)

1. Push this repo to GitHub.
2. In Render, click **New → Blueprint** and connect your GitHub repo.
3. Render reads [`render.yaml`](render.yaml) and offers to create the `lbc-api` web service. Click **Apply**.
4. On the **Environment** tab of the new service, fill in:

| Variable | Value |
|---|---|
| `DATABASE_URL` | (paste the Neon connection string from Step 1) |
| `FRONTEND_URL` | _Leave blank for now — fill after Step 3._ |
| `JWT_SECRET` | _Render auto-generates a strong value (`generateValue: true` in the blueprint)._ |

**Optional integrations** (all skipped means stubs / fallbacks stay active):

| Feature | Variable(s) | Where to get the key |
|---|---|---|
| Email OTP delivery | `BREVO_API_KEY` + `BREVO_SENDER_EMAIL` | app.brevo.com → SMTP & API → API Keys |
| Lucky AI chatbot (live mode) | `ANTHROPIC_API_KEY` | console.anthropic.com |
| Web push notifications | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | run locally: `npx web-push generate-vapid-keys` |
| Real payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | razorpay.com dashboard |
| SMS OTP for India | `FAST2SMS_API_KEY` | fast2sms.com → Dev API |
| WhatsApp notifications | `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_VERIFY_TOKEN` | Meta Business → WhatsApp → API setup |

5. The build runs:
   - `node scripts/use-postgres.js` (flips Prisma provider from sqlite → postgresql)
   - `npm install` → `npm run build --workspace apps/api`
   - `npm run release --workspace apps/api` (`prisma db push --accept-data-loss && tsx prisma/seed.ts`)
6. When the service is **live**, copy its URL — e.g. `https://lbc-api.onrender.com`.

---

## Step 3 — Deploy the web (Vercel)

1. In Vercel, click **Add New → Project** and import the same GitHub repo.
2. On the configuration screen:
   - **Root Directory**: `apps/web`
   - **Framework Preset**: Next.js _(should auto-detect)_
   - **Build Command**: leave default (`next build`)
3. **Environment Variables** — set these before clicking Deploy:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://lbc-api.onrender.com` (your Render API URL) |
| `API_PROXY_URL` | `https://lbc-api.onrender.com` |
| `NEXT_PUBLIC_WS_URL` | `wss://lbc-api.onrender.com` (note **wss**, not https) |
| `NEXT_PUBLIC_SITE_URL` | (your Vercel URL, set after first deploy) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | optional — Google Cloud Console → Maps JavaScript API |

4. Click **Deploy**. First build takes ~2 minutes.
5. Copy the deployed URL (e.g. `https://lucky-biryani.vercel.app`).
6. Add it to `NEXT_PUBLIC_SITE_URL` and redeploy once. (Needed for OG previews & manifest URLs.)

---

## Step 4 — Wire the cross-service URL

Open the **Render** service → Environment, set:

| Variable | Value |
|---|---|
| `FRONTEND_URL` | `https://lucky-biryani.vercel.app` (your Vercel URL) |

Click **Save Changes**. Render redeploys automatically. This unblocks CORS for browser → API calls.

---

## Step 5 — Verify

| Check | Expected |
|---|---|
| `https://<api>.onrender.com/api/v1/health` | `{ "ok": true, "at": "..." }` |
| `https://<api>.onrender.com/api/v1/ai/status` | `{ "enabled": true, "mode": "live" }` if `ANTHROPIC_API_KEY` is set, else `"fallback"` |
| `https://<web>.vercel.app/` | Home page loads, Lucky AI button visible bottom-right |
| `https://<web>.vercel.app/menu` | 19 menu items rendered |
| `https://<web>.vercel.app/admin` | Loads (login required) |

### Demo logins on prod

The seed creates these users with stable emails. OTP is random + emailed; either set `BREVO_API_KEY` to receive real OTPs, or set `DEV_OTP=000000` on the Render service for demos.

| Role | Email | Where it lands |
|---|---|---|
| Owner | `owner@lucky.test` | `/admin` |
| Manager | `admin@lucky.test` | `/admin` |
| Customer | `customer@lucky.test` | `/menu` |
| Rider 1 | `rider1@lucky.test` | `/rider` |

---

## Free-tier caveats

- **Render free** services **sleep after 15 min idle** — cold start is ~30 seconds, and background workers (auto-assign, no-show release, demand promos) freeze while asleep. For a real restaurant, upgrade `lbc-api` to **Starter ($7/mo)**.
- **Vercel free** has zero sleep, but only 100 GB bandwidth/month.
- **Neon free** is 3 GB storage, unlimited rows. No expiry like Render's free Postgres.
- **No backups** on Neon free — set up `pg_dump` to S3/R2 once you have real customer data.

---

## Adding HTTPS-only env vars after the fact

If you flipped on a feature flag (say `ANTHROPIC_API_KEY`) after deploy:

- **Render**: Service → Environment → Add → save → service redeploys automatically.
- **Vercel**: Project → Settings → Environment Variables → add → click **Redeploy** on the latest deployment (Vercel doesn't auto-redeploy on env changes).

`NEXT_PUBLIC_*` variables bake into the Next.js bundle at build time, so they always require a redeploy on Vercel.

---

## Custom domain

1. Buy domain (Namecheap / Hostinger / Cloudflare).
2. In Vercel → Project → Domains → add `luckybiryani.in`.
3. Vercel shows the DNS records needed (A or CNAME). Add them at your registrar.
4. In Render → Service → Settings → Custom Domains → add `api.luckybiryani.in`.
5. Update env vars to use the new domains:
   - Render `FRONTEND_URL` = `https://luckybiryani.in`
   - Vercel `NEXT_PUBLIC_API_BASE_URL` = `https://api.luckybiryani.in`
   - Vercel `NEXT_PUBLIC_WS_URL` = `wss://api.luckybiryani.in`

---

## How redeploys work

- **Push to `main`** → Render auto-deploys API (via `autoDeploy: true` in `render.yaml`), Vercel auto-deploys web.
- Both deploys run in parallel and typically finish in 3–5 minutes.
- The API runs `npm run release` on every deploy — `prisma db push --accept-data-loss` syncs the schema, then `prisma/seed.ts` runs but is idempotent (`Branch.count() > 0` short-circuits).
- To force a re-seed in prod (rare): set `SEED_FORCE=1` on Render briefly, redeploy, then unset.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| CORS errors in browser console | `FRONTEND_URL` on Render doesn't match the actual Vercel URL — fix and redeploy. |
| WebSocket disconnects every 30s | `NEXT_PUBLIC_WS_URL` uses `ws://` instead of `wss://`. Must be wss in prod. |
| `Error: P1001` on build | `DATABASE_URL` is wrong or Neon is paused. Test with `psql` first. |
| Build fails on `use-postgres.js` | The script is idempotent — if `schema.prisma` was hand-edited to be already on postgres, it bails harmlessly. Re-check by `git diff schema.prisma`. |
| Lucky AI says "lite mode" | `ANTHROPIC_API_KEY` not set. Add it on Render to enable Claude Haiku. |
| Push notifications never arrive | `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` not set on Render. Also re-subscribe in the browser after setting keys (the old subscription is for a different VAPID identity). |
| Map shows "set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" | Add the key on Vercel and **redeploy** (NEXT_PUBLIC_* bakes at build time). |
