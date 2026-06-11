# Brand pricing — local testing guide

Use this to verify subscription, billing, invoices, grandfathering, and entitlement behaviour on your laptop. You have **local Postgres** — many scenarios can be tested by **UI + API + direct DB edits** without waiting for Razorpay. Razorpay + ngrok is still required for charge, invoice, and tier-change flows.

| Doc | Purpose |
| --- | --- |
| [expected-behaviour.md](./expected-behaviour.md) | What should happen (scenarios A–L) |
| [product-docs/Scenario-handling.md](./product-docs/Scenario-handling.md) | New plan launch, grandfathering, new feature counters (read-only) |
| [gaps-and-missing-setup.md](./gaps-and-missing-setup.md) | What is not built yet |

---

## Can you test everything locally?

**Mostly yes** — with two modes:

| Mode | What you can cover |
| --- | --- |
| **A — UI + API + DB** | No subscription, local trial, trialing UI, ACTIVE/CANCELED/HALTED/PAST_DUE banners, frozen overlay, reactivate CTA + tier picker reveal, grandfathering catalog, geo currency, usage/limits API, cyclic counter reset (SQL), escrow take-rate on `calculate-breakdown` (tier via DB) |
| **B — Razorpay test + ngrok** | Paid-tier **Subscribe** checkout from trial, deferred Founder's renewal, real charges, invoices + `short_url`, ACTIVE tier PATCH pro-rata, **PAST_DUE** webhooks, reactivate (resume / new sub / payment links), full webhook lifecycle |

**Deferred / not built** (see [gaps-and-missing-setup.md](./gaps-and-missing-setup.md)):

| Scenario | How to test today |
| --- | --- |
| Trial reminder (day 25 email) | Not testable — no scheduler |
| Downgrade asset lock (products 6–20) | Not implemented — verify limits via `/usage` only |
| Entitlement on real features (AI chat, outreach) | Service exists; feature routes not hooked |
| Global app freeze outside Settings | Billing UI only — SQL status changes do not block Brand Centre routes |
| Subscription charge → escrow ledger row | **N/A** — intentionally not built |
| Escrow concurrent campaign cap / custom tranches | Not tier-gated yet — take rate + aggregate cap only |

---

## 1. Local environment

Same stack as escrow testing. See also [docs/escrow/testing-guide.md](../escrow/testing-guide.md) §1.

### 1.1 Backend

```powershell
cd D:\Work\cursor-repos\creator-commerce-backend-v2
docker compose up -d
npm run prisma:generate
npm run db:migrate:deploy
npm run dev
```

API: **http://localhost:3000**

### 1.2 Frontend

```powershell
cd D:\Work\cursor-repos\creator-commerce-frontend-v2
npm run dev
```

UI: **http://localhost:5173** → log in as **brand** → **Settings → Billing overview**

### 1.3 Backend `.env` (pricing uses same Razorpay vars as escrow)

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/thecreatorshop?schema=public
RAZORPAY_API_KEY_ID=rzp_test_xxxxxxxx
RAZORPAY_API_KEY_SECRET=your_test_secret
RAZORPAY_WEBHOOK_SECRET=your_long_random_webhook_secret
```

### 1.3b Frontend `.env` (subscription checkout)

```env
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxx   # same Key Id as backend (public)
```

Paid-tier **Subscribe** during trial uses Razorpay **subscription checkout** (`subscription_id`), not escrow order checkout.

### 1.4 Razorpay subscription webhook (Mode B)

Add a **second** webhook (or extend events on a dedicated webhook):

| Field | Local (ngrok) |
| --- | --- |
| **URL** | `https://<ngrok-host>/api/v1/webhooks/subscription` |
| **Secret** | Same as `RAZORPAY_WEBHOOK_SECRET` |

**Enable events** (Subscription + Invoice + Payment groups):

- `subscription.authenticated`
- `subscription.activated`
- `subscription.charged`
- `subscription.pending` → sets **PAST_DUE**
- `subscription.updated`
- `subscription.halted`
- `subscription.cancelled`
- `payment.failed` → sets **PAST_DUE** (when subscription id present on payload)
- `invoice.paid`
- `invoice.payment_failed` → sets **PAST_DUE**

```powershell
ngrok http 3000
```

**Plans:** On first **Connect Billing**, **Subscribe** (tier change), or `trial/razorpay`, the API auto-creates Razorpay plans if missing (see `RAZORPAY_PLAN_DEFINITIONS`). Optional env overrides: `RAZORPAY_PLAN_FOUNDERS_BETA_USD=plan_xxx`. Manual dashboard plans are no longer required for local dev.

---

## 2. DB tables you will touch

| Table | Purpose |
| --- | --- |
| `brand_profiles` | `country_code`, legacy `plan_type`, `subscription_status`, `trial_ends_at` |
| `brand_subscriptions` | Tier, status, currency, Razorpay ids, billing period dates |
| `feature_usages` | Per-feature counters + `reset_at` |
| `brand_billing_invoices` | Audit rows from webhooks (not used for list API — list is live Razorpay) |

**Find your brand id:**

```sql
SELECT bp.id AS brand_profile_id, bp.brand_name, u.email
FROM brand_profiles bp
JOIN organizations o ON o.id = bp.organization_id
JOIN users u ON u.organization_id = o.id
WHERE u.email = 'your-brand@example.com';
```

**Inspect subscription:**

```sql
SELECT * FROM brand_subscriptions WHERE brand_id = '<brand_profile_id>';
```

**Prisma Studio (GUI):**

```powershell
cd D:\Work\cursor-repos\creator-commerce-backend-v2
npm run db:studio
```

---

## 3. Get a JWT for API calls

1. Log in via the UI, or:

```powershell
curl -X POST http://localhost:3000/api/v1/auth/login `
  -H "Content-Type: application/json" `
  -d "{\"email\":\"your-brand@example.com\",\"otp\":\"123456\"}"
```

2. Copy `accessToken` from the response.
3. Use header: `Authorization: Bearer <accessToken>`

**Pricing API smoke:**

```powershell
curl http://localhost:3000/api/v1/pricing/subscription `
  -H "Authorization: Bearer <token>"
```

---

## 4. Scenario playbook

Each row maps to [expected-behaviour.md](./expected-behaviour.md). **Mode** = A (DB/UI) or B (Razorpay).

### Scenario A — No subscription (first visit)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Delete subscription row (optional): `DELETE FROM brand_subscriptions WHERE brand_id = '…';` | Clean slate |
| 2 | Open **Settings → Billing overview** | Current plan shows **—**; Founder's Preview visible |
| 3 | `GET /api/v1/pricing/plans/public` (no auth) | No Founder's Beta in list |
| 4 | `GET /api/v1/pricing/invoices` | `{ "invoices": [] }` |

---

### Scenario B — Local 30-day trial (no card)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | **Onboarding:** complete email verify → pricing → **Start My Free Trial** | `complete-registration` then `trial/bootstrap` |
| 1b | **Or Settings:** click **Start My Free Trial** | `POST /api/v1/pricing/trial/bootstrap` only |
| 2 | Refresh billing page (or finish onboarding → Settings → Billing) | Status **TRIALING**, tier **Founder's Beta**, renewal = trial end |
| 3 | SQL check | `razorpay_subscription_id` is **NULL** |
| 4 | `GET /api/v1/pricing/usage` | Limits for FOUNDERS_BETA; counters at 0 |

**DB shortcut (skip button):**

```sql
INSERT INTO brand_subscriptions (
  subscription_id, brand_id, tier, status, currency,
  current_period_start, current_period_end, trial_ends_at, updated_at
) VALUES (
  gen_random_uuid()::text, '<brand_profile_id>',
  'FOUNDERS_BETA', 'TRIALING', 'USD',
  NOW(), NOW() + interval '30 days', NOW() + interval '30 days', NOW()
);
-- Seed feature_usages via UI bootstrap or copy rows from another test brand
```

---

### Scenario C — Trial → ACTIVE (first charge / rollover)

Two paths:

| Path | Steps |
| --- | --- |
| **C1 — Paid tier during trial** | Settings → **Subscribe** on Growth/Pro → complete checkout → webhook sets **ACTIVE** + target tier |
| **C2 — Founder's renewal** | `POST /api/v1/pricing/trial/razorpay` → deferred charge at trial end → webhook → **ACTIVE** on Founder's |

| Step | Mode | Action | Expected |
| --- | --- | --- | --- |
| 1 | B | C1: **Subscribe** on Professional, or C2: `POST /api/v1/pricing/trial/razorpay` | C1: `tier/change` returns `checkout`; C2: `razorpaySubscriptionId` set |
| 2 | B | Complete test payment in Razorpay checkout (C1) or wait for deferred charge (C2) | `subscription.charged` / `authenticated` webhook |
| 3 | B | Check ngrok `POST /api/v1/webhooks/subscription` → **200** | Status **ACTIVE** in DB |
| 4 | A+B | SQL: `SELECT current_usage_count FROM feature_usages WHERE feature_key = 'MAX_AI_CHATS'` | Cyclic counters **0** after charge |
| 5 | B | `GET /api/v1/pricing/invoices` | Rows from Razorpay (paid invoices) |
| 6 | B | Click **View** on invoice | Opens Razorpay `short_url` |

**DB-only partial test (UI only, no real invoice):**

```sql
UPDATE brand_subscriptions
SET status = 'ACTIVE',
    trial_ends_at = NOW() - interval '1 day',
    current_period_start = NOW() - interval '30 days',
    current_period_end = NOW() + interval '1 day',
    updated_at = NOW()
WHERE brand_id = '<brand_profile_id>';

UPDATE brand_profiles
SET subscription_status = 'ACTIVE', plan_type = 'FREE_TRIAL'
WHERE id = '<brand_profile_id>';
```

Simulate exhausted cyclic usage then “rollover”:

```sql
UPDATE feature_usages
SET current_usage_count = 50
WHERE subscription_id = (SELECT subscription_id FROM brand_subscriptions WHERE brand_id = '<brand_profile_id>')
  AND feature_key = 'MAX_AI_CHATS';

-- After webhook or manual reset:
UPDATE feature_usages
SET current_usage_count = 0, reset_at = NOW() + interval '30 days'
WHERE feature_key IN ('MAX_DEEP_SCANS_MONTHLY', 'MAX_MANAGED_OUTREACH', 'MAX_AI_CHATS');
```

> **Note:** `brand_billing_invoices` rows are created only when the webhook fetches a **real** `inv_…` from Razorpay. Fake webhook `invoice_id` values will fail on upsert.

---

### Scenario D — ACTIVE monthly renewal

Same as C step 3 on each billing cycle. **Mode B only** for real renewal. Locally, re-run charge in Razorpay test or replay webhook from dashboard **Recent Deliveries**.

---

### Scenario E — Upgrade / downgrade tier

| Step | Mode | Action | Expected |
| --- | --- | --- | --- |
| 1 | B | Founder's **TRIALING** (local bootstrap, no Razorpay yet) | Settings → **Subscribe** on Growth Starter or Professional |
| 2 | B | Complete Razorpay subscription checkout | `POST /api/v1/pricing/tier/change` returns `checkout.subscriptionId` |
| 3 | B | After webhook (`subscription.charged` / `authenticated`) | SQL: `tier` = target, `status` = `ACTIVE` |
| 4 | B | Already **ACTIVE** on a paid tier | **Change plan** → PATCH pro-rata, `checkout: null` |
| 5 | A | `GET /api/v1/pricing/usage` | Limits reflect new tier |

**DB-only (UI tier cards, no Razorpay):**

```sql
UPDATE brand_subscriptions
SET tier = 'PROFESSIONAL', razorpay_plan_id = 'plan_usd_pro_399', updated_at = NOW()
WHERE brand_id = '<brand_profile_id>';

UPDATE brand_profiles SET plan_type = 'PROFESSIONAL' WHERE id = '<brand_profile_id>';
```

Downgrade asset lock (scenario doc) — **not implemented**; you can only verify new limits via `/usage`, not product locking.

---

### Scenario F — Grandfathering (catalog visibility)

Use **two brand accounts** (or one with/without Founder's subscription).

| Brand | Setup | `GET /api/v1/pricing/plans` |
| --- | --- | --- |
| **New** | No row or tier ≠ Founder's | Growth Starter, Professional, Enterprise only |
| **Grandfathered** | `tier = 'FOUNDERS_BETA'` | Above **plus** Founder's Beta |

**DB:**

```sql
UPDATE brand_subscriptions SET tier = 'FOUNDERS_BETA' WHERE brand_id = '<existing_beta_brand>';
```

Public catalog (signup):

```powershell
curl http://localhost:3000/api/v1/pricing/plans/public
```

---

### Scenario G — Cancel subscription

| Step | Mode | Action | Expected |
| --- | --- | --- | --- |
| 1 | B | `POST /api/v1/pricing/cancel` body `{"cancel_at_cycle_end": false}` | Razorpay cancel + status **CANCELED** |
| 2 | A | Or SQL: `UPDATE brand_subscriptions SET status = 'CANCELED'` + sync `brand_profiles.subscription_status` | Frozen overlay in Settings |
| 3 | A | Click **Reactivate Workspace Ledger & Select Plan** | `POST /api/v1/pricing/reactivate` → tier picker scrolls into view |
| 4 | B | Reactivate on **CANCELED** (with Razorpay plans configured) | New Razorpay sub created; status **ACTIVE** when API succeeds |

**End-of-cycle cancel (B):** `{"cancel_at_cycle_end": true}` — status may stay ACTIVE until `subscription.cancelled` webhook.

**Reactivate API (curl):**

```powershell
curl -X POST http://localhost:3000/api/v1/pricing/reactivate `
  -H "Authorization: Bearer <token>" `
  -H "Content-Type: application/json" `
  -d "{}"
```

Response shapes:

| `recovery_mode` | When | UI expectation |
| --- | --- | --- |
| `new_subscription` | CANCELED (or HALTED without resumable sub) | Frozen overlay clears after reload if status → ACTIVE |
| `resume_submitted` | HALTED with existing `razorpay_subscription_id` | Same |
| `update_payment` | PAST_DUE | `payment_links[]` may open Razorpay invoice; tier picker revealed |

---

### Scenario H — HALTED

| Step | Mode | Action | Expected |
| --- | --- | --- | --- |
| 1 | B | Razorpay `subscription.halted` webhook | Status **HALTED** |
| 2 | A | SQL: `UPDATE brand_subscriptions SET status = 'HALTED'` | Same frozen UI as cancel |
| 3 | B | `POST /api/v1/pricing/reactivate` | Razorpay resume called; status **ACTIVE** |

---

### Scenario H2 — PAST_DUE (failed payment)

| Step | Mode | Action | Expected |
| --- | --- | --- | --- |
| 1 | B | Razorpay `subscription.pending`, `payment.failed`, or `invoice.payment_failed` webhook | Status **PAST_DUE** in DB + `brand_profiles.subscription_status` |
| 2 | A | Or SQL: `UPDATE brand_subscriptions SET status = 'PAST_DUE'` | Past-due banner in Settings (not frozen overlay) |
| 3 | A+B | Click **Update Payment Details & Retry Clearing** | Reactivate API; may open pending invoice `short_url` |
| 4 | B | Complete payment → `subscription.charged` webhook | Status back to **ACTIVE**; banner clears |

**DB shortcut:**

```sql
UPDATE brand_subscriptions
SET status = 'PAST_DUE', updated_at = NOW()
WHERE brand_id = '<brand_profile_id>';

UPDATE brand_profiles
SET subscription_status = 'PAST_DUE'
WHERE id = '<brand_profile_id>';
```

**Manual webhook body** (`subscription.pending.json`):

```json
{
  "event": "subscription.pending",
  "payload": {
    "subscription": {
      "entity": {
        "id": "sub_xxxxxxxx",
        "plan_id": "plan_usd_founders_99"
      }
    }
  }
}
```

Use the same HMAC signing flow as §5.2. Subscription `id` must match `brand_subscriptions.razorpay_subscription_id`.

---

### Scenario I — Feature limits & counters

**Mode A** — fully testable via API today:

1. Ensure subscription **ACTIVE** or **TRIALING** (not CANCELED/HALTED).
2. `GET /api/v1/pricing/usage` — note limits and counts.
3. Bump counter in DB:

```sql
UPDATE feature_usages
SET current_usage_count = 49
WHERE feature_key = 'MAX_AI_CHATS'
  AND subscription_id = (SELECT subscription_id FROM brand_subscriptions WHERE brand_id = '<id>');
```

4. When AI/outreach routes call `EntitlementService`, the 50th call should pass and 51st fail (once wired).

**Enterprise bypass:**

```sql
UPDATE brand_subscriptions SET tier = 'ENTERPRISE' WHERE brand_id = '<id>';
```

**Scenario-handling §3 (new counter key)** — code change only: add key to `FEATURE_LIMITS` + `CYCLIC_FEATURE_KEYS` if monthly; test via usage snapshot after bootstrap.

---

### Scenario J — Geo / currency

| Step | Action | Expected |
| --- | --- | --- |
| 1 | `UPDATE brand_profiles SET country_code = 'IN' WHERE id = '…';` | |
| 2 | Delete + re-bootstrap trial with `{"currency":"INR"}` | Subscription currency **INR** |
| 3 | `GET /api/v1/pricing/geo-context` | `ZONE_IN`, INR, compliance warning |
| 4 | `country_code = 'US'` | USD, `ZONE_US` |

---

### Scenario K — Escrow ↔ pricing interlock

Requires brand JWT + initialized escrow vault. See also [escrow testing guide](../escrow/testing-guide.md).

**K1 — Take rate on breakdown (Mode A)**

| Step | Action | Expected |
| --- | --- | --- |
| 1 | SQL: set tier `FOUNDERS_BETA` (7%) or `PROFESSIONAL` (5%) on active/trialing sub | |
| 2 | `POST /api/v1/escrow/calculate-breakdown` | Response includes `platform_take_rate` matching tier |

```powershell
curl -X POST http://localhost:3000/api/v1/escrow/calculate-breakdown `
  -H "Authorization: Bearer <token>" `
  -H "Content-Type: application/json" `
  -d "{\"gross_creator_quote\":100000,\"currency\":\"INR\",\"expected_tds_percentage\":1}"
```

| Tier | Expected `platform_take_rate` |
| --- | --- |
| FOUNDERS_BETA | `0.07` |
| GROWTH_STARTER | `0.06` |
| PROFESSIONAL | `0.05` |
| ENTERPRISE | `0.02` |

**K2 — Billing gate on lock (Mode A)**

| Step | Action | Expected |
| --- | --- | --- |
| 1 | SQL: `status = 'PAST_DUE'` or `'CANCELED'` | |
| 2 | `POST /api/v1/escrow-engine/lock-funds` (or hardened lock) | **403** — no active billing subscription |

**K3 — Aggregate cap on lock (Mode A)**

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Tier `FOUNDERS_BETA` → cap **500000** (INR) per `FEATURE_LIMITS` | |
| 2 | SQL: set `locked_campaign_funds` near cap on `brand_escrow_vaults` | |
| 3 | Attempt lock that would exceed cap | **400** with tier cap message |

**K4 — No subscription row**

Breakdown still returns a rate (defaults to Founder's Beta **0.07**) for quote preview; lock paths require ACTIVE/TRIALING subscription.

---

### Scenario L — Launch new public plan (operator)

Read-only product steps in `Scenario-handling.md`. Local dry-run:

1. Add enum value + migration (if new tier name).
2. Update `PLAN_MAPPINGS`, `FEATURE_LIMITS`, `PlanCatalogService.MASTER_CATALOG`.
3. Restart backend.
4. `GET /api/v1/pricing/plans/public` — new plan appears if `isPubliclyAvailable: true`.

No Razorpay charge required to verify **catalog only**.

---

## 5. Webhook testing (Mode B)

### 5.1 Razorpay dashboard (easiest)

1. Trigger a real test subscription charge.
2. **Webhooks → Recent Deliveries** (or ngrok **http://127.0.0.1:4040**).
3. Confirm `POST /api/v1/webhooks/subscription` → **200**.

### 5.2 Manual POST (signature required)

Body must be the **raw JSON** used for HMAC. Signature = `HMAC-SHA256(RAZORPAY_WEBHOOK_SECRET, rawBody)`.

PowerShell example (replace secret and save body to `body.json`):

```powershell
$secret = "your_RAZORPAY_WEBHOOK_SECRET"
$body = Get-Content -Raw -Path ".\subscription-charged.json"
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
$hash = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($body))
$sig = -join ($hash | ForEach-Object { $_.ToString("x2") })

curl.exe -X POST http://localhost:3000/api/v1/webhooks/subscription `
  -H "Content-Type: application/json" `
  -H "x-razorpay-signature: $sig" `
  --data-binary "@subscription-charged.json"
```

Minimal `subscription-charged.json` shape (use **real** ids from your test account):

```json
{
  "event": "subscription.charged",
  "payload": {
    "subscription": {
      "entity": {
        "id": "sub_xxxxxxxx",
        "current_start": 1710000000,
        "current_end": 1712592000,
        "plan_id": "plan_usd_founders_99"
      }
    },
    "payment": {
      "entity": {
        "id": "pay_xxxxxxxx",
        "invoice_id": "inv_xxxxxxxx"
      }
    }
  }
}
```

> If `invoice_id` is fake, subscription status/counters may still update, but invoice upsert will error when fetching from Razorpay. Use ids from a real test charge.

### 5.3 Status webhooks (no invoice required)

Same signing pattern — change `event` and subscription entity:

| Event | Expected DB status |
| --- | --- |
| `subscription.halted` | HALTED |
| `subscription.cancelled` | CANCELED |
| `subscription.pending` | PAST_DUE |
| `payment.failed` | PAST_DUE (needs `subscription.entity.id` or `invoice.entity.subscription_id`) |
| `invoice.payment_failed` | PAST_DUE (needs `invoice.entity.subscription_id`) |

### 5.4 PAST_DUE → ACTIVE recovery

1. Send `subscription.pending` → confirm **PAST_DUE**.
2. Send `subscription.charged` (or complete payment in Razorpay test) → confirm **ACTIVE** and cyclic counters reset.

---

## 6. API quick reference

| Method | Path |
| --- | --- |
| GET | `/api/v1/pricing/subscription` |
| GET | `/api/v1/pricing/plans` |
| GET | `/api/v1/pricing/plans/public` |
| GET | `/api/v1/pricing/usage` |
| GET | `/api/v1/pricing/geo-context` |
| GET | `/api/v1/pricing/invoices` |
| GET | `/api/v1/pricing/invoices/:razorpayInvoiceId` |
| GET | `/api/v1/pricing/invoices/:razorpayInvoiceId/view` |
| POST | `/api/v1/pricing/trial/bootstrap` |
| POST | `/api/v1/pricing/trial/razorpay` |
| POST | `/api/v1/pricing/tier/change` — body `{"target_tier":"PROFESSIONAL"}` → `{ subscription, checkout }` (`checkout` non-null from TRIALING) |
| POST | `/api/v1/pricing/cancel` — body `{"cancel_at_cycle_end": false}` |
| POST | `/api/v1/pricing/reactivate` — body `{}` |
| POST | `/api/v1/escrow/calculate-breakdown` — body `{"gross_creator_quote":100000,"currency":"INR","expected_tds_percentage":1}` |

---

## 7. Suggested test order (one afternoon)

1. **A** — No subscription → Founder's Preview → bootstrap trial.
2. **A** — SQL set ACTIVE → check plan summary + tier cards.
3. **A** — SQL CANCELED / HALTED → frozen overlay → **Reactivate** → tier picker visible.
4. **A** — SQL PAST_DUE (or webhook) → past-due banner → **Update Payment** CTA.
5. **A** — `calculate-breakdown` at two tiers → verify `platform_take_rate`.
6. **A** — Second brand + grandfathering on `/plans`.
7. **A** — `country_code` IN vs US → geo-context.
8. **B** — ngrok webhook (all events in §1.4) + `VITE_RAZORPAY_KEY_ID` on frontend.
9. **B** — From TRIALING: **Subscribe** on Professional → checkout → ACTIVE + tier updated.
10. **B** — Test charge → invoices list + View link.
11. **B** — `subscription.pending` → PAST_DUE → charge again → ACTIVE.
12. **B** — ACTIVE customer **Change plan** → PATCH pro-rata → breakdown shows `0.05` take rate on Professional.
13. **B** — Cancel → frozen UI → reactivate (new sub) or resume (halted).
14. **B** — (Optional) `trial/razorpay` → deferred Founder's renewal at trial end.

---

## 8. Troubleshooting

| Symptom | Check |
| --- | --- |
| Razorpay: "seller does not support recurring payments" | Enable **Subscriptions** on your Razorpay test account: Dashboard → **Subscriptions** (or Account & Settings → activate recurring). Subscriptions are a separate product from one-time Orders (escrow). Contact Razorpay support if the option is missing on test mode. |
| Subscribe / upgrade fails from trial | `VITE_RAZORPAY_KEY_ID` set? ngrok webhook running? Check backend logs on `tier/change` |
| Frozen after closing failed checkout | Click **Reactivate** (restores TRIALING) or `POST /api/v1/pricing/trial/restore`. Fixed in webhook: `subscription.cancelled` during Founder's trial no longer sets CANCELED. |
| Checkout opens but tier stays TRIALING | Webhook not received — verify `subscription.authenticated` / `charged` in §1.4 |
| Upgrade fails when ACTIVE | Razorpay sub must be `authenticated` or `active` for PATCH; check Razorpay dashboard status |
| Reactivate fails (CANCELED) | Razorpay plans match `PLAN_MAPPINGS`? Enterprise needs sales |
| Reactivate on HALTED no-op | `razorpay_subscription_id` present? Check Razorpay resume API errors in logs |
| PAST_DUE not auto-setting | Webhook events `subscription.pending` / `payment.failed` enabled? |
| Past-due banner stuck after pay | `subscription.charged` webhook received? |
| Take rate always 0.07 | No subscription row — expected for preview; set tier on `brand_subscriptions` |
| Escrow lock 403 | Subscription must be ACTIVE or TRIALING (not PAST_DUE/CANCELED/HALTED) |
| Escrow lock 400 cap | `locked_campaign_funds + new lock` vs `ESCROW_AGGREGATE_CAP` for tier |
| Invoices empty | No Razorpay sub or no charges yet |
| View invoice disabled | Invoice missing `short_url` in Razorpay response |
| Webhook 400 | `RAZORPAY_WEBHOOK_SECRET` mismatch; raw body must match signature |
| Webhook 200 but no invoice row | Invalid `invoice_id` on fetch; check backend logs |
| Plans missing Founder's | Expected for new users; grandfather needs `FOUNDERS_BETA` tier |
| Legacy profile out of sync | Compare `brand_profiles.subscription_status` vs `brand_subscriptions.status` |

---

## 9. Checklist before merging pricing work

- [ ] Migrations applied: `20260608140000_pricing_module`, `20260608160000_pricing_billing_invoices`
- [ ] Local trial bootstrap works (onboarding + Settings)
- [ ] TRIALING → **Subscribe** on paid tier → Razorpay checkout → ACTIVE via webhook
- [ ] TRIALING / ACTIVE / PAST_DUE / CANCELED / HALTED UI states verified (UI or SQL)
- [ ] `VITE_RAZORPAY_KEY_ID` configured on frontend for subscription checkout
- [ ] Reactivate CTA works for frozen + past-due states
- [ ] `subscription.pending` (or SQL) → PAST_DUE; `subscription.charged` → ACTIVE
- [ ] Escrow `calculate-breakdown` returns tier-correct `platform_take_rate`
- [ ] Escrow lock rejected when subscription not ACTIVE/TRIALING
- [ ] Grandfathering verified with two brands
- [ ] Razorpay plans exist (auto-provision or `PLAN_MAPPINGS` / env overrides)
- [ ] Subscription webhook URL points to ngrok or dev API (all events in §1.4)
- [ ] At least one test charge → invoice in list + view link
