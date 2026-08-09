# Brand escrow — testing guide

Use this when verifying escrow end-to-end, especially **Razorpay test mode**.

For what users should see (non-technical), see [expected-behaviour.md](./expected-behaviour.md).  
For what is still missing, see [gaps-and-missing-setup.md](./gaps-and-missing-setup.md).

---

## Quick map — three ways to test

| Setup | Best for | Webhook URL |
| --- | --- | --- |
| **Local** (Docker + ngrok) | Day-to-day dev on your laptop | `https://<ngrok-id>.ngrok-free.app/api/v1/webhooks/escrow` |
| **Dev deployed** | QA on shared staging | `https://api.dev.thecreatorshop.in/api/v1/webhooks/escrow` |
| **Prod** | Live payments only (not test mode) | `https://api.thecreatorshop.in/api/v1/webhooks/escrow` |

Card top-ups **do not** credit the vault until Razorpay sends a webhook to the backend. Checkout alone is not enough.

---

## 1. Run locally (recommended first)

You need **two terminals** — backend API and frontend UI. Postgres runs in Docker.

### 1.1 Backend (`creator-commerce-backend-v2`)

```powershell
cd D:\Work\cursor-repos\creator-commerce-backend-v2

npm install
cp .env.example .env   # if you have not created .env yet

docker compose up -d

npm run prisma:generate
npm run db:migrate:deploy

npm run dev
```

**Expect:** API listening on **http://localhost:3000**

Sanity check:

```powershell
curl http://localhost:3000/health/live
```

More detail: [docs/local-development/README.md](../local-development/README.md)

### 1.2 Frontend (`creator-commerce-frontend-v2`)

```powershell
cd D:\Work\cursor-repos\creator-commerce-frontend-v2

npm install
```

Create or edit `.env` in the frontend repo root:

```env
VITE_STAGE=local

# Public Razorpay key — same Key ID as backend (rzp_test_… in test mode)
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxx

# Optional in local dev — Vite proxies /api to localhost:3000 if unset
# VITE_API_URL=http://localhost:3000
```

```powershell
npm run dev
```

**Expect:** UI at **http://localhost:5173**

Open **Settings → Escrow** (footer nav) while logged in as a **brand** user.

> **Restart** `npm run dev` after any `.env` change. Vite only reads env vars at startup.

### 1.3 Backend `.env` — Razorpay + database

Add these to `creator-commerce-backend-v2/.env` (never commit real values):

```env
# Database (local Docker — default from README)
DATABASE_URL=postgresql://postgres:password@localhost:5432/thecreatorshop?schema=public

# Razorpay test keys from dashboard → Account & Settings → API Keys (Test mode)
RAZORPAY_API_KEY_ID=rzp_test_xxxxxxxx
RAZORPAY_API_KEY_SECRET=your_test_secret

# You choose this string — must match the webhook secret in Razorpay dashboard
RAZORPAY_WEBHOOK_SECRET=your_long_random_webhook_secret
```

Generate a webhook secret (example):

```powershell
# PowerShell — random hex string
-join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
```

Or use any long random string (32+ characters).

---

## 2. Razorpay Dashboard setup (test mode)

Do this in the [Razorpay Dashboard](https://dashboard.razorpay.com/). All steps below assume **Test Mode** (toggle in the top bar).

### 2.1 Switch to Test Mode

1. Log in to Razorpay.
2. Turn **Test Mode** **ON** (top-right toggle).
3. All keys, payments, and webhooks below apply to test only.

### 2.2 Get API keys

1. Go to **Account & Settings** → **API Keys** (under **Developer Controls**).
2. Under **Test Mode**, click **Generate Key** (or view existing test keys).
3. Copy:
   - **Key Id** → `RAZORPAY_API_KEY_ID` (backend) and `VITE_RAZORPAY_KEY_ID` (frontend)
   - **Key Secret** → `RAZORPAY_API_KEY_SECRET` (backend only — never put secret in frontend)

### 2.3 Create or update the webhook

1. Go to **Account & Settings** → **Webhooks**.
2. Click **+ Add New Webhook** (or **Edit** an existing one).

| Field | Local dev (ngrok) | Dev deployed |
| --- | --- | --- |
| **Webhook URL** | `https://<your-ngrok-host>/api/v1/webhooks/escrow` | `https://api.dev.thecreatorshop.in/api/v1/webhooks/escrow` |
| **Secret** | Same value as `RAZORPAY_WEBHOOK_SECRET` in backend `.env` | Same — must match env on deployed API |
| **Alert email** | Optional | Optional |

3. Under **Active Events**, Razorpay groups checkboxes by category. Expand each group and tick **only** these (you do not need every event in the list):

   | Dashboard group | Event to enable | Why |
   | --- | --- | --- |
   | **order Events** | `order.paid` | Card top-up — credits vault when checkout order is paid |
   | **payment Events** | `payment.captured` | Card top-up — backup; our backend treats this the same as `order.paid` |
   | **payment Events** | `payment.failed` | Declined card — marks ledger row as failed |
   | **virtual_account Events** | `virtual_account.credited` | Bank wire — credits vault when money hits the VAN |

   **Do not enable** other events for escrow testing (subscriptions, payouts, disputes, etc.) unless you are debugging something else.

   **Optional (not required):** `virtual_account.created` — fires when the vault is initialized; our webhook handler ignores it.

4. Save the webhook.

> **Note:** Older product docs list only three events. The live Razorpay UI uses grouped names — the table above matches what you actually see in the dashboard.

### 2.4 When you change the webhook URL

You must update Razorpay whenever your public backend URL changes:

| Change | Action |
| --- | --- |
| ngrok restarted (new subdomain) | Edit webhook URL in Razorpay → paste new `https://….ngrok-free.app/api/v1/webhooks/escrow` |
| Moved from local to dev deploy | Change URL to `https://api.dev.thecreatorshop.in/api/v1/webhooks/escrow` |
| Secret rotated | Update **both** Razorpay webhook secret **and** `RAZORPAY_WEBHOOK_SECRET` in backend env, then redeploy/restart API |

### 2.5 Verify webhook deliveries

After a test payment or simulated bank credit:

1. Razorpay Dashboard → **Webhooks** → your webhook → **Recent Deliveries** (or **Logs**).
2. Look for `order.paid`, `payment.captured`, `payment.failed`, or `virtual_account.credited`.
3. **200** = backend accepted the event. **4xx/5xx** = check backend logs and secret/URL.

---

## 3. ngrok — expose local backend for webhooks

Razorpay cannot call `http://localhost:3000`. Use ngrok to give your **backend** a public HTTPS URL.

### 3.1 Install ngrok

1. Sign up at [ngrok.com](https://ngrok.com/) and install the CLI.
2. Authenticate once:

```powershell
ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
```

### 3.2 Start the tunnel

**Terminal C** (keep open while testing card/bank webhooks):

```powershell
ngrok http 3000
```

Copy the **Forwarding** HTTPS URL, e.g. `https://a1b2c3d4.ngrok-free.app`.

Your webhook URL for Razorpay:

```text
https://a1b2c3d4.ngrok-free.app/api/v1/webhooks/escrow
```

Paste that into Razorpay (section 2.3).

### 3.3 Quick webhook smoke test (optional)

With backend + ngrok running:

```powershell
curl -i https://a1b2c3d4.ngrok-free.app/health/live
```

You should get `200` from your local Nest app via ngrok.

### 3.4 ngrok tips

- **Free plan:** URL changes every time you restart ngrok → update Razorpay webhook URL each session.
- **Paid static domain:** You can reserve a fixed subdomain and avoid daily URL updates.
- Tunnel **backend port 3000**, not the Vite frontend (5173). Webhooks hit the API only.
- Keep **Terminal A** (backend `npm run dev`) and **Terminal C** (ngrok) running during card top-up tests.

---

## 4. Deploy to dev (shared staging)

Use this when testing on `dashboard.dev.thecreatorshop.in` instead of localhost.

Full runbooks:

- Backend: [docs/deployment/README.md](../deployment/README.md)
- Frontend: `creator-commerce-frontend-v2/docs/deployment/README.md`

### 4.1 Apply escrow migration to dev RDS (if not done)

When `prisma/migrations` includes escrow:

1. AWS SSO: `aws sso login --profile creator-dev`
2. **Terminal A** — SSM tunnel to dev RDS (port `5435`):

   ```powershell
   cd D:\Work\cursor-repos\creator-commerce-backend-v2
   .\scripts\start-dev-tunnel.ps1
   ```

3. **Terminal B** — migrate (use password from `DEV_DATABASE_URL` in `.env`):

   ```powershell
   $env:DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@localhost:5435/creatorshop_be?schema=public&sslmode=require"
   npm run db:migrate:deploy
   ```

4. Stop the tunnel (`Ctrl+C` in Terminal A).

### 4.2 Deploy backend API

From **WSL** (recommended — see deployment README):

```bash
cd ~/Work/creator-commerce-backend-v2
export AWS_PROFILE=creator-dev
export SST_SKIP_DEPENDENCY_CHECK=1
aws sso login --profile creator-dev
npm install
npm run build
npx sst deploy --stage dev --print-logs
```

Verify:

```bash
curl -s https://api.dev.thecreatorshop.in/health/live
```

### 4.3 Deploy frontend

Ensure build-time env includes Razorpay public key. Today `sst.config.ts` passes `VITE_API_URL` and `VITE_STAGE`; for card checkout on dev you also need `VITE_RAZORPAY_KEY_ID` in the StaticSite `environment` block (or equivalent CI secret) before deploy.

```bash
cd ~/Work/creator-commerce-frontend-v2
export AWS_PROFILE=creator-dev
aws sso login --profile creator-dev
npm install
npx sst deploy --stage dev --print-logs
```

Open: **https://dashboard.dev.thecreatorshop.in** → Settings → Escrow.

### 4.4 Razorpay + env after dev deploy

| Item | Dev value |
| --- | --- |
| Webhook URL | `https://api.dev.thecreatorshop.in/api/v1/webhooks/escrow` |
| Backend Razorpay keys | Must be present in ECS task environment (add `RAZORPAY_*` to `sst.config.ts` `apiEnvironment` if not already — see [gaps-and-missing-setup.md](./gaps-and-missing-setup.md)) |
| Frontend public key | `VITE_RAZORPAY_KEY_ID` baked in at `npm run build` / SST deploy |

After deploy, update the Razorpay webhook URL (section 2.3) and confirm webhook deliveries show **200**.

---

## 5. Environment variables cheat sheet

### Backend

| Variable | Local | Deployed |
| --- | --- | --- |
| `RAZORPAY_API_KEY_ID` | `.env` | ECS env / `sst.config.ts` |
| `RAZORPAY_API_KEY_SECRET` | `.env` | ECS env / `sst.config.ts` |
| `RAZORPAY_WEBHOOK_SECRET` | `.env` | ECS env / `sst.config.ts` |
| `DATABASE_URL` | Local Docker URL | `DEV_DATABASE_URL` via SST |

### Frontend

| Variable | Local | Deployed |
| --- | --- | --- |
| `VITE_RAZORPAY_KEY_ID` | `.env` | SST StaticSite `environment` at build |
| `VITE_API_URL` | Optional (proxy) | `https://api.dev.thecreatorshop.in` via SST |
| `VITE_STAGE` | `local` | `dev` / `prod` |

**Rule:** Key **Id** is public (frontend + backend). Key **Secret** and **Webhook Secret** are backend-only.

---

## 6. Razorpay test cards

In **Test Mode**, use Razorpay’s documented test cards when the checkout popup opens.

| Scenario | Typical test card |
| --- | --- |
| Success | `4111 1111 1111 1111` (any future expiry, any CVV) |
| Failure | Use Razorpay docs for failure simulation cards |

Always confirm the latest numbers in [Razorpay test card docs](https://razorpay.com/docs/payments/payments/test-card-upi-details/).

---

## 7. Functional test cases

### Test 1 — Initialize vault

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Log in as a brand user with no vault | Escrow shows initialize CTA; balances show **—** |
| 2 | Click **Initialize Secure Escrow Vault** | Brief provisioning, then **Active** |
| 3 | Check API `GET /api/v1/escrow/vault` (with brand JWT) | 200 with `virtual_account_number`, `ifsc_code`, balances `0` |
| 4 | Refresh page | State persists; still Active |

**Known gap:** Beneficiary name shows **—** (not returned by API yet).

---

### Test 2 — Card top-up (main flow)

**Prerequisites:** ngrok → backend (local) or dev API URL in Razorpay; all env vars set; webhook events enabled.

#### Step-by-step (local)

1. **Settings → Escrow** → **Top Up Balance**
2. **Enter amount to allocate** — e.g. `10000` (or `100` for a quick test)
3. Select **Instant Deposit (Corporate Credit Card)**
4. Click **Proceed to Secure Payment Gateway**
5. In the Razorpay popup, pay with test card **`4111 1111 1111 1111`**, any **future expiry**, any **CVV**
6. Complete payment

#### Then verify

| Where | What to see |
| --- | --- |
| **UI** | Success modal; **Available Balance** increases by the **allocation** amount (not the card charge total) |
| **Razorpay → Webhooks → Recent Deliveries** | `order.paid` or `payment.captured` → HTTP **200** |
| **Escrow page → Financial Ledger** | **Card top-up** row; status **`CLEARED`** (not `PROCESSING_GATEWAY`) |

#### Two phases — why ledger can show a row but balance stays $0

Card top-up is **two steps**:

| Phase | When | Ledger | Balances |
| --- | --- | --- | --- |
| **1. Checkout started** | You click Proceed; backend creates Razorpay order | **Card top-up** appears with **`PROCESSING_GATEWAY`** | Still **$0.00** / **₹0.00** — correct |
| **2. Webhook confirmed** | Razorpay sends `order.paid` or `payment.captured` to your webhook URL | Same row updates to **`CLEARED`** | **Total Pooled** and **Available** increase |

So if you see:

```text
Card top-up · PROCESSING_GATEWAY · +$100.00
Total Pooled Balance: $0.00
Available Balance: $0.00
```

**Payment likely succeeded in Razorpay**, but the **webhook has not cleared yet** (or failed). Balances only move on phase 2.

**If payment works but balance stays 0** → webhook issue (secret, URL, or ngrok). Check **Recent Deliveries** first, then refresh the escrow page.

**If checkout does not open**

1. `VITE_RAZORPAY_KEY_ID` set and dev server restarted.
2. Key Id matches backend test key (`rzp_test_…`).
3. Browser console — Razorpay script or network errors.

---

### Test 3 — Cancel / fail card payment

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Start card top-up, close Razorpay without paying | Cancelled/failed message; balance unchanged |
| 2 | Use failure test card | `payment.failed` webhook; no credit |

---

### Test 4 — Bank wire top-up (optional, test mode)

Only after the vault exists. Use **VAN + IFSC** from the escrow UI and simulate a test credit per Razorpay Smart Collect test docs. Expect a **`virtual_account.credited`** webhook → **200**.

Harder to exercise in test mode than card top-up; **card top-up is enough for local** end-to-end verification.

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Note VAN + IFSC from escrow UI | Match `GET /api/v1/escrow/vault` |
| 2 | Trigger test virtual account credit (per Razorpay test docs) | `virtual_account.credited` webhook → **200** |
| 3 | Refresh escrow page | Balance up; **Bank wire top-up** in ledger |

Without a simulated credit, zero balance is correct.

---

### Keep running while testing (local)

Leave these running for the whole card top-up test:

| Terminal | Command |
| --- | --- |
| **Docker** | `docker compose up -d` (Postgres) |
| **Backend** | `npm run dev` (port **3000**) |
| **Frontend** | `npm run dev` (port **5173**) |
| **ngrok** | `ngrok http 3000` |

If you **restart ngrok**, the public URL changes → update the Razorpay webhook URL again.

---

### Test 5 — Ledger and empty states

| Scenario | Expected |
| --- | --- |
| New vault, no transactions | Ledger visible; one row with **—** |
| After top-up | Real rows with dates and amounts |
| API error | Error on card; sections still visible |

---

### Test 6 — Auth and security

| Step | Expected |
| --- | --- |
| Escrow APIs without JWT | 401 |
| Brand A vs Brand B vault | Scoped to logged-in brand only |
| Webhook without valid Razorpay signature | Rejected |

---

### Test 7 — API smoke (optional)

With brand JWT (`Authorization: Bearer …`):

```http
GET  /api/v1/escrow/vault
GET  /api/v1/escrow/ledger
POST /api/v1/escrow/initialize
POST /api/v1/escrow/topup-intent
POST /api/v1/escrow/calculate-breakdown
```

Collaboration endpoints (no Settings UI yet — use Postman + real `collaboration_id`):

```http
POST /api/v1/escrow-engine/lock-collaboration-funds
POST /api/v1/escrow-engine/disburse-tranche-payout
POST /api/v1/escrow-interlock/transition-stage
POST /api/v1/escrow-interlock/trigger-rule-refund
```

---

## 8. End-to-end checklist

### Local (test mode)

- [ ] Docker Postgres up; migrations applied
- [ ] Backend `npm run dev` on `:3000`
- [ ] Frontend `npm run dev` on `:5173`; brand user logged in
- [ ] Razorpay **Test Mode** on
- [ ] `RAZORPAY_*` in backend `.env`
- [ ] `VITE_RAZORPAY_KEY_ID` in frontend `.env`; dev server restarted
- [ ] ngrok `http 3000` running
- [ ] Razorpay webhook URL = `https://<ngrok>/api/v1/webhooks/escrow`
- [ ] Webhook secret matches `RAZORPAY_WEBHOOK_SECRET`
- [ ] Events enabled: `order.paid`, `payment.captured`, `payment.failed`, `virtual_account.credited`
- [ ] Initialize vault → Active
- [ ] Card top-up → webhook 200 → balance + ledger update

### Dev deployed (test mode)

- [ ] Migration applied to dev RDS
- [ ] `sst deploy --stage dev` (backend + frontend)
- [ ] `curl https://api.dev.thecreatorshop.in/health/live` → OK
- [ ] Razorpay webhook URL = `https://api.dev.thecreatorshop.in/api/v1/webhooks/escrow`
- [ ] `RAZORPAY_*` on ECS / SST env
- [ ] `VITE_RAZORPAY_KEY_ID` in frontend build env
- [ ] Same functional tests on dashboard.dev

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Ledger shows **Card top-up** + **`PROCESSING_GATEWAY`**, balances **$0** | Webhook not delivered or not **200** yet | See **§9.1** below; refresh escrow page after **200** |
| Razorpay **No webhook logs found** | Non-owner account, wrong test-mode webhook, or ngrok URL stale | See **§9.1** — use ngrok inspector instead of dashboard |
| Payment succeeds, balance stays 0 | Webhook not received or failed | ngrok running? URL in Razorpay correct? Check Recent Deliveries |
| Webhook 401/403 | Wrong `RAZORPAY_WEBHOOK_SECRET` | Align dashboard secret and backend env; restart API |
| Initialize vault fails | Missing/invalid Razorpay API keys | Test mode keys in `.env`; check backend logs |
| Checkout does not open | Missing `VITE_RAZORPAY_KEY_ID` | Add to `.env`; restart Vite |
| CORS errors (non-proxy setup) | Frontend calling API directly | Use Vite proxy locally or set `VITE_API_URL` + `CORS_ORIGINS` on API |
| ngrok 502 | Backend not on 3000 | Start `npm run dev` in backend repo |
| Works locally, not on dev | Webhook still points to ngrok | Update Razorpay URL to `api.dev.thecreatorshop.in` |
| Deployed API, no Razorpay | Keys not in ECS env | Add `RAZORPAY_*` to `sst.config.ts` and redeploy |

---

### 9.1 Webhook debugging when Razorpay dashboard shows no logs

If you see **“Only owner accounts can access this feature”** or **“No webhook logs found”**, you may not have permission to view delivery logs in Razorpay. Use these alternatives.

#### What we listen for (not `payment.create`)

The escrow balance only updates on:

| Event | Purpose |
| --- | --- |
| `order.paid` | Card top-up cleared (primary) |
| `payment.authorized` | Card authorized — backend auto-captures, then clears balance |
| `payment.captured` | Card top-up cleared (backup) |
| `virtual_account.credited` | Bank wire |
| `payment.failed` | Declined card |

`payment.create` fires when a payment object is created — **our backend ignores it**. Filter or search for **`order.paid`** / **`payment.captured`** instead.

#### Checklist — no deliveries at all

1. **Test Mode ON** (top-right in Razorpay) — webhooks are separate for test vs live.
2. **Account & Settings → Webhooks** — a webhook exists with URL:  
   `https://<your-ngrok-host>/api/v1/webhooks/escrow`  
   (must match ngrok **right now**; restart = new URL).
3. **Active events** include `order.paid`, `payment.authorized`, and `payment.captured`.
4. **ngrok** running: `ngrok http 3000`
5. **Backend** running: `npm run dev` on port 3000
6. **`RAZORPAY_WEBHOOK_SECRET`** in backend `.env` **exactly** matches the secret on that webhook.

#### Use ngrok inspector (works without owner access)

1. Open **http://127.0.0.1:4040** in your browser (ngrok local UI).
2. Make another small test top-up (e.g. `100`).
3. Watch for a **POST** to `/api/v1/webhooks/escrow`.

| ngrok shows | Meaning |
| --- | --- |
| **No POST** after payment | Razorpay is not calling your URL — fix webhook URL / test mode / events |
| **POST → 200** with `payment.authorized` + `"captured": false` | Authorized only — backend now auto-captures; expect a follow-up `payment.captured` or balance update after capture |
| **POST → 200** with `order.paid` or `payment.captured` | Webhook OK — refresh escrow; ledger should show **CLEARED**, balances update |
| **POST → 400** | Usually **webhook secret mismatch** or bad signature — align `RAZORPAY_WEBHOOK_SECRET` and restart backend |

#### Manual curl smoke test (optional)

With backend + ngrok running, a missing signature should return **400** (proves the route is reachable):

```powershell
curl.exe -X POST https://<your-ngrok-host>/api/v1/webhooks/escrow -H "Content-Type: application/json" -d "{}"
```

You should **not** get connection refused. A **400** “Missing Razorpay webhook signature” is expected.

#### After a successful webhook

- Ledger: **Card top-up** → **`CLEARED`**
- **Total Pooled Balance** and **Available Balance** increase
- Hard refresh **Settings → Escrow** if the UI was already open

---

## 10. Reporting issues

Include:

1. Brand user email (no passwords or API secrets).
2. Environment: local / dev / prod.
3. Vault initialized? Y/N.
4. Top-up method: card / bank.
5. Razorpay **order id** or **payment id** (from dashboard).
6. Webhook delivery status and HTTP code from Razorpay logs.
7. ngrok URL or `api.dev` URL configured in webhook.
8. Screenshot of UI, including any **—** fields that look wrong.
