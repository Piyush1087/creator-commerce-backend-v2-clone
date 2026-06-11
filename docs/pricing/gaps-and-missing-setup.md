# Brand pricing — gaps and missing setup



What is **done**, what is **partially done**, and what is **explicitly deferred** so we do not lose track. **Product source of truth:** `docs/pricing/product-docs/` (read-only).



---



## Done (usable today)



### Backend



| Area | Status |

| --- | --- |

| Database models (`brand_subscriptions`, `feature_usages`, `brand_billing_invoices`) + migrations | Done |

| `SubscriptionTier`, `SubscriptionCurrency`, `HALTED` / `PAST_DUE` on `SubscriptionStatus` | Done |

| Plan catalog with grandfathering filter | Done |

| Geo routing (IN → INR, US/ROW → USD) | Done |

| Local 30-day trial bootstrap (no card) | Done |

| Razorpay deferred trial creation API | Done |

| Tier change (Growth Starter, Professional) — trial checkout + ACTIVE PATCH pro-rata | Done |

| Razorpay plan auto-provisioning (`RAZORPAY_PLAN_DEFINITIONS`) | Done |

| Webhook tier resolution from subscription notes / plan id on paid activation | Done |

| Cancel subscription API | Done |

| **Reactivate API** (`POST /api/v1/pricing/reactivate`) — resume halted sub, new sub after cancel, payment links for past-due | Done |

| Subscription webhooks with signature verify | Done |

| **`PAST_DUE` from webhooks** (`subscription.pending`, `payment.failed`, `invoice.payment_failed`) | Done |

| Cyclic counter reset on `subscription.charged` / `authenticated` | Done |

| Entitlement check + increment service | Done |

| Usage snapshot API | Done |

| Invoice list (live Razorpay) + webhook audit upsert + view redirect | Done |

| Legacy `brand_profiles.plan_type` / `subscription_status` sync on lifecycle writes | Done |

| **`ESCROW_TAKE_RATES` + aggregate cap wired into escrow lock/breakdown** | Done |

| Module registered in `app.module.ts` | Done |



### Frontend (v2)



| Area | Status |

| --- | --- |

| Settings → Billing overview pricing UI | Done |

| Wired to pricing APIs (subscription, plans, usage, geo, trial, tier change, invoices) | Done |

| Razorpay subscription checkout on paid-tier upgrade from trial (`razorpay-subscription-checkout.ts`) | Done |

| Founder's Preview + tier comparison cards | Done |

| Past-due banner + frozen (HALTED/CANCELED) overlay | Done |

| **Reactivate / update-payment CTAs** call reactivate API + reveal tier picker | Done |

| Regulatory disclaimers + feature teasers | Done |

| Missing values show **—** | Done |

| Escrow remains separate sub-tab | Done |



---



## Partially done — needs configuration or follow-up



### Razorpay plan IDs in dashboard



- **Done (local dev):** `RazorpayPlanProvisioningService` creates plans via API on first `trial/razorpay` or `tier/change` when ids are missing.

- **Production:** Set explicit `RAZORPAY_PLAN_<TIER>_<CURRENCY>` env vars or pre-create plans per `product-docs/Razorpay-setup.md`.

- **Symptom if misconfigured:** Trial/razorpay, tier change, reactivate, or webhooks fail with Razorpay errors.



### Subscription webhooks in non-production



- **Gap:** Status transitions and monthly rollover depend on webhooks reaching `/api/v1/webhooks/subscription`.

- **Action:** Configure webhook URL + secret; subscribe to `subscription.*`, `payment.failed`, `invoice.paid`, `invoice.payment_failed`.

- **Symptom if missing:** Trial never becomes ACTIVE; `PAST_DUE` never auto-sets on failed payment.



### Local trial vs Razorpay trial



- **Done:** **Start My Free Trial** / onboarding uses **local bootstrap** only (no Razorpay id, no card).

- **Done:** **Subscribe** on Growth Starter or Professional during trial opens Razorpay checkout immediately (`tier/change` + subscription checkout).

- **Optional:** **Connect Billing for Renewal** (`trial/razorpay`) — deferred Founder's sub for charge at trial end; not required before paid-tier upgrade.

- **Deferred:** Auto-create Razorpay sub at day 25 reminder (Pipeline 1 in product docs) — no scheduler yet.



### Read-only / frozen enforcement outside Settings



- **Gap:** Frozen overlay is billing UI only; Brand Centre, campaigns, and outreach are **not** globally gated on `PAST_DUE` / `HALTED` / `CANCELED`.

- **Action (later sprint):** App-level guard using subscription status — **out of scope for escrow/pricing-ready pass**.



### Onboarding pricing step



- **Done:** `pricing-view.tsx` calls `complete-registration` then `POST /api/v1/pricing/trial/bootstrap` → **FOUNDERS_BETA** / **TRIALING** (30-day local trial, no Razorpay id).



### `subscription.updated` webhook



- **Partial:** Updates `razorpayPlanId` only; does not change `tier` enum (tier is set on `authenticated` / `charged` / `activated` via notes or plan-id lookup).

- **Action (later):** Map `subscription.updated` plan changes to tier for ACTIVE customers who PATCH outside our API.



---



## Explicitly deferred (product intent — not forgotten)



These are **in product-docs** but intentionally **not** built in the current escrow + pricing focus. Do not treat as bugs.



| Capability | Product reference | Why deferred |

| --- | --- | --- |

| Trial reminder notification (day 25) | Razorpay-setup.md | No scheduler job yet |

| Downgrade asset lock (products 6–20, etc.) | Scenario-handling.md | Plan/feature enforcement sprint |

| AI / outreach / product-create entitlement hooks | developer-documentation.md | Service exists; feature routes not gated |

| Global app freeze on billing states | Razorpay-setup Pipeline 3 | Settings-only UX for now |

| Subscription charge → escrow_transaction_ledger | Razorpay-setup.md | **N/A — product decision: not required** |

| RBI 24h pre-debit notification (IN) | Geo compliance | Warning in geo API only |

| Billing details / tax org form | Settings teasers | Placeholder only |

| Payment methods CRUD | Settings teasers | No API |

| Enterprise self-serve reactivation | Plan card | Contact Sales |

| Proration/refund UI | Tier change | Razorpay handles charge |

| Public marketing pricing page | `plans/public` API | No dedicated route in v2 |

| Usage meters in Settings UI | usage API | Not displayed in billing panel |

| Custom multi-tranche / BARTER / MANUAL payout by tier | Pricing-escrow-connection.md | Escrow engine scope |



---



## Escrow ↔ pricing interlock (current behaviour)



Per `product-docs/Pricing-escrow-connection.md`:



- **Take rate** on lock and `calculate-breakdown` comes from `BrandSubscription.tier` via `ESCROW_TAKE_RATES` (not hardcoded 7%).

- **Aggregate cap** (`ESCROW_AGGREGATE_CAP`) enforced on lock when `locked_campaign_funds + new lock` would exceed tier cap.

- **Billing gate:** Escrow lock requires subscription `ACTIVE` or `TRIALING` (`PAST_DUE` / `HALTED` / `CANCELED` rejected).



**Still not tier-gated in escrow:** concurrent campaign count, per-transaction single-lock ceiling, multi-tranche modes — see deferred table above.



---



## Infrastructure / production readiness



| Item | Notes |

| --- | --- |

| Dev RDS migrations | `20260608140000_pricing_module`, `20260608160000_pricing_billing_invoices` |

| Deploy backend with `PricingModule` + updated `BrandEscrowModule` | Escrow/pricing routes on api.dev |

| `RAZORPAY_*` env on host | Same vars as escrow |

| Webhook raw body | Subscription webhook uses raw body HMAC |

| Monitoring | Alert on webhook failures, stuck TRIALING past `trialEndsAt`, HALTED/PAST_DUE spikes |

| Live keys | Separate live plan IDs and webhook URL before production |



---



## Quick test checklist (dev)



1. Sign in as brand → **Settings → Billing overview** (or complete onboarding pricing step).

2. **Start My Free Trial** → TRIALING, `razorpay_subscription_id` null.

3. `GET /api/v1/pricing/usage` → limits for Founder's Beta.

4. **Subscribe** on Growth Starter or Professional → Razorpay checkout → webhook → ACTIVE on paid tier.

5. **Or** optional **Connect Billing** → `trial/razorpay` → deferred Founder's charge at trial end.

6. Simulate `subscription.pending` or `payment.failed` → **PAST_DUE** + banner.

7. **Reactivate** on frozen/past-due → API + tier picker / payment link.

8. Escrow **calculate-breakdown** → `platform_take_rate` matches tier (e.g. 0.05 for Professional).

9. Escrow lock with aggregate over cap → 400 with tier cap message.



---



## Related docs



- [expected-behaviour.md](./expected-behaviour.md) — scenarios in plain language

- [testing-guide.md](./testing-guide.md) — local QA steps

- [README.md](./README.md) — module index and API table

- `docs/escrow/gaps-and-missing-setup.md` — escrow-specific gaps


