# Deploying Ure to Vercel

Ure is a Next.js 16 app with Prisma + PostgreSQL, a database-backed job queue,
and the Nomba payment integration. This guide covers a safe, clean production
deploy.

> **Trust model note:** Stacks escrow is still mocked (Phase D not built) — locks
> auto-confirm and releases use a fake tx id. Do not present this as real,
> trustless on-chain escrow yet. Payments (Nomba) are real against sandbox.

---

## 0. Prerequisites

- A GitHub repo (already set: `github.com/Anthonyushie/Ure`)
- A Vercel account linked to that GitHub
- A hosted Postgres database — **[Neon](https://neon.tech)** recommended (serverless-friendly)

---

## 1. Provision Postgres (Neon)

1. Create a Neon project → you get two connection strings:
   - **Pooled** (host contains `-pooler`) → used by the running app.
   - **Direct** (no `-pooler`) → used only for migrations.
2. Keep both handy.

Why: serverless functions open many short-lived connections. The pooled endpoint
(PgBouncer) prevents exhausting Postgres. Migrations need the **direct** URL
because they take advisory locks the pooler doesn't support.

---

## 2. Apply migrations to the production DB

From your machine, against the **direct** URL (one-time and after every schema change):

```bash
DATABASE_URL="postgresql://…DIRECT…/neondb?sslmode=require" npm run db:deploy
```

`db:deploy` runs `prisma migrate deploy` (production-safe; never `migrate dev` in prod).

---

## 3. Push code to GitHub

The Prisma client is gitignored and regenerated on Vercel via the `postinstall`
script — nothing extra to commit. Secrets live only in `.env` (gitignored).

```bash
git push origin main
```

---

## 4. Import the project into Vercel

1. Vercel → Add New → Project → import `Anthonyushie/Ure`.
2. Framework preset: **Next.js** (auto-detected). Build command / output: defaults.
3. Add the environment variables below (Production, and Preview if you want PR previews).

### Environment variables

| Key | Value / how to get it |
|---|---|
| `APP_SECRET` | **Generate a strong one:** `openssl rand -base64 48`. Do NOT reuse the dev value. |
| `DATABASE_URL` | Neon **pooled** connection string (`…-pooler…?sslmode=require`) |
| `NEXT_PUBLIC_APP_URL` | Your prod URL, e.g. `https://ure.vercel.app` |
| `CRON_SECRET` | `openssl rand -base64 32` — authorizes the cron queue drain |
| `ADMIN_WALLET_ADDRESSES` | Comma-separated admin Stacks wallet(s) |
| `NOMBA_BASE_URL` | `https://sandbox.nomba.com` (sandbox) or `https://api.nomba.com` (live) |
| `NOMBA_CLIENT_ID` | Nomba Client ID |
| `NOMBA_CLIENT_SECRET` | Nomba private key |
| `NOMBA_ACCOUNT_ID` | Parent account id (→ `accountId` header) |
| `NOMBA_SUBACCOUNT_ID` | Sub-account id (→ transfer path) |
| `NOMBA_WEBHOOK_SECRET` | Webhook **Signature Key** from Nomba dashboard (set after step 6) |
| `STACKS_NETWORK` | `testnet` |
| `STACKS_API_URL` | `https://api.testnet.hiro.so` |
| `ESCROW_CONTRACT_NAME` | `ure-escrow` (leave `ESCROW_CONTRACT_ADDRESS` / `ESCROW_ORACLE_PRIVATE_KEY` blank → mock escrow) |

`NODE_ENV=production` is set by Vercel automatically (this also flips session
cookies to `Secure`).

4. Deploy.

---

## 5. Background jobs on Vercel (already wired)

There is no long-running worker on serverless. Two mechanisms cover it:

1. **Post-response drain** — the webhook route calls `after(() => drainJobs())`,
   so a single incoming webhook cascades the whole flow (payment → release →
   payout) in the function's post-response window.
2. **Cron safety net** — `vercel.json` schedules `GET /api/jobs/tick` every
   minute to pick up delayed retries / reconciliation, authorized by `CRON_SECRET`.

> **Plan note:** per-minute cron requires Vercel **Pro**. On **Hobby**, cron is
> limited (≈daily) — the post-response drain still carries the main happy path;
> only delayed retries wait longer. `npm run worker` (local `scripts/worker.mjs`)
> can also poll a deployed instance if you need a faster external ticker.

---

## 6. Register the Nomba webhook (after first deploy)

1. Nomba dashboard → Settings → Webhooks → add
   `https://<your-app>.vercel.app/api/nomba/webhook`, subscribe to
   `payment_success` (and payout events).
2. Also submit the URL + sub-account id in the hackathon form.
3. Copy the **Signature Key** they show → set `NOMBA_WEBHOOK_SECRET` in Vercel →
   **redeploy** (env changes need a new deployment).

Until this key is set, webhook signature verification fails closed (by design).

---

## 7. Smoke-test production

```bash
curl https://<app>.vercel.app/api/health          # {"ok":true,"data":{"status":"healthy"}}
curl https://<app>.vercel.app/api/trades          # {"ok":true,"data":{"items":[],…}}
```

Then: connect a Stacks wallet (Leather/Xverse) on `/dashboard`, create a trade,
lock, accept (creates a real Nomba VA), pay the exact amount → the webhook drives
it to `COMPLETED`. Inspect via `/admin` (admin wallet only).

---

## 8. Pre-flight security checklist

- [ ] `APP_SECRET` is a fresh strong random value (not the dev placeholder)
- [ ] **LIVE Nomba key rotated** (the one shared earlier is compromised)
- [ ] All secrets in Vercel env only — never committed (`.env` is gitignored)
- [ ] `NOMBA_WEBHOOK_SECRET` set to the real Signature Key
- [ ] `DATABASE_URL` uses the pooled endpoint; migrations run via the direct one
- [ ] `CRON_SECRET` set; `/api/jobs/tick` rejects unauthenticated callers
- [ ] Admin routes gated (only `ADMIN_WALLET_ADDRESSES` wallets)
- [ ] Trust-model copy is honest (mock escrow; exact-payment only)
