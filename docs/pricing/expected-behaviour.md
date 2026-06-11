# Brand pricing & subscriptions — expected behaviour (plain language)

This document explains what a brand user should see and what should happen across subscription lifecycle, billing rollover, cancellations, and entitlements. It is written for product, QA, and anyone who is not reading code.

Product source requirements live in **`docs/pricing/product-docs/`** (read-only). This file describes **intended behaviour** and what the v2 stack does today.

---

## Where to find it

- In the brand app, open **Settings** (footer navigation).
- Pricing lives under **Settings → Billing** → **Billing overview**.
- **Secure escrow** is a separate sub-tab on the same Settings page (not covered here; see `docs/escrow/expected-behaviour.md`).

Onboarding also shows a **Founder's Beta** preview step before account creation; that screen is similar in copy but is part of the signup funnel, not Settings.

---

## Display rule (same as escrow)

- If the app does not have a value from the API, it shows **—** (em dash).
- Sections stay visible; we do not hide blocks because data is missing.
- Use **—** to spot gaps in design, Razorpay setup, or API coverage.

---

## Plans and tiers (what exists)

| Tier | Who typically sees it | Monthly list price (USD reference) | Collaboration fee (escrow) |
| --- | --- | --- | --- |
| **Founder's Beta** | Early adopters / 30-day preview | $99/mo after trial | 7% |
| **Growth Starter** | New public signups | $149/mo | 6% |
| **Professional** | Upgrades | $399/mo | 5% |
| **Enterprise** | Sales-led | Custom | 2% |

India (INR) uses parallel Razorpay plan IDs; currency is chosen from the brand's country (India → INR, US → USD, rest of world → USD).

---

## Scenario A — First visit, no subscription record

**What you see (Settings → Billing overview)**

- **Current Plan** collapsible with **—** for tier, status, currency, and renewal date until a subscription exists.
- **Founder's Preview** hero: 30-day preview, feature grid, **Start My Free Trial**.
- **Evolution Path**: grayed-out upcoming Professional / Enterprise cards (roadmap teaser).
- **Billing Details** and **Invoice History** sections (empty placeholders).
- Regulatory panels (Founder's Beta terms, data security) when relevant.

**What should happen when you click Start My Free Trial**

1. The app calls the backend to create a **local** subscription row (no card required).
2. Status becomes **TRIALING**.
3. Tier is **Founder's Beta**.
4. Trial end date is set **30 days** from now.
5. Feature usage counters are seeded at **0** with monthly reset windows.
6. The preview card disappears; **Current Plan** fills in with live values.

**What does *not* happen on bootstrap**

- No Razorpay subscription is created (no card, no mandate).
- No invoice is generated.

**Onboarding**

- After email verification, the pricing step calls `complete-registration` then `POST /api/v1/pricing/trial/bootstrap` — same **TRIALING / Founder's Beta** row as Settings **Start My Free Trial**.

---

## Scenario B — Trialing (30-day Founder's Preview)

**What you see**

- **Current Plan** shows:
  - Tier: **Founder's Beta**
  - Status: **TRIALING** (no-card preview)
  - Billing cycle: **30-Day Free Window**
  - Currency from geo routing (e.g. USD ($) or INR (₹))
  - **Next renewal** = trial end date
  - Post-trial label, e.g. *Then $99/mo + 7% Collaboration Fee*
- **Workspace Tiers** comparison cards (Growth Starter, Professional, Enterprise).
- Regulatory disclaimers under the plan summary.

**What you can do**

- Use the full platform for 30 days with no payment.
- **Upgrade paths** → click **Subscribe** on Growth Starter or Professional → Razorpay subscription checkout opens immediately (first payment + monthly auto-billing). Connect Billing is **not** required first.
- Optional **Connect Billing for Renewal** → deferred Founder's Razorpay sub for continuing on Founder's Beta at trial end.

**What should happen when you Subscribe to a paid tier during trial**

1. `POST /api/v1/pricing/tier/change` cancels any existing deferred Founder's Razorpay sub (if present).
2. Backend creates an **immediate** Razorpay subscription on the target plan (notes include `target_tier`).
3. Response includes `checkout: { subscriptionId, razorpayKeyId, targetTier }`.
4. Frontend opens Razorpay subscription checkout.
5. Until payment succeeds, local row stays **FOUNDERS_BETA / TRIALING** (only `razorpaySubscriptionId` may update).
6. Webhook (`subscription.authenticated` / `charged` / `activated`) sets **tier** to the paid plan, **status ACTIVE**, and billing period dates.

**What should happen as trial approaches day 30 (Founder's renewal path)**

1. ~5 days before trial end: notify the brand to add a payment method (scheduled job — **not implemented**).
2. If they used **Connect Billing**: at trial end Razorpay charges the deferred Founder's Beta plan (`start_at`).
3. Webhook moves status **TRIALING → ACTIVE** on Founder's Beta and starts the paid billing period.

**Local-only trial (bootstrap path)**

- Trial dates live in our database; no Razorpay id until Connect Billing or a paid-tier Subscribe checkout.

---

## Scenario C — Trial ends / first successful charge (rollover to paid)

**Trigger (intended)**

- Razorpay webhook: `subscription.authenticated` or `subscription.charged`
- Or: `subscription.activated`

**What should happen on the server**

1. Subscription **status** → **ACTIVE**.
2. **currentPeriodStart** / **currentPeriodEnd** updated from Razorpay billing period.
3. Legacy `brand_profiles.subscription_status` synced to **ACTIVE**.
4. **Cyclic feature counters reset to 0** for:
   - Monthly deep scans
   - Managed outreach
   - AI chats
5. **resetAt** on those rows set to the new period end.

**What the brand should see**

- Status badge moves from trialing to active.
- **Next renewal** shows the next billing date (period end).
- Invoice history would list the charge (**UI shows — until invoice API exists**).

This is the **billing rollover**: each successful charge starts a new monthly entitlement window for cyclic limits. Non-cyclic limits (e.g. max products, max rivals) are **not** auto-reset on charge unless product adds that rule.

---

## Scenario D — Active paid subscription (monthly renewal)

**Steady state**

- Brand is **ACTIVE** on Growth Starter, Professional, or Founder's Beta (grandfathered).
- Each month Razorpay charges the plan.
- Each `subscription.charged` webhook resets cyclic counters (same as Scenario C).

**What you see in Settings**

- **Current Plan** summary with tier, active status, currency, next renewal.
- **Workspace Tiers** with current plan highlighted; upgrade buttons on other tiers.
- Invoice table empty (**—**) until billing history API exists.

**If payment fails (product intent)**

- Status should become **PAST_DUE**.
- UI shows past-due banner and read-only messaging.
- Brand has ~7 days to fix payment before harder lockout.

**Today:** Webhooks `subscription.pending`, `payment.failed`, and `invoice.payment_failed` set **PAST_DUE**. Successful `subscription.charged` clears it back to **ACTIVE**. Global read-only enforcement outside Settings is still partial — see `gaps-and-missing-setup.md`.

---

## Scenario E — Upgrade or downgrade tier

**What you do**

- Open **Workspace Tiers** in Settings.
- Click **Subscribe** (during Founder's trial) or **Change plan** (when already ACTIVE) on Growth Starter or Professional.

**What should happen**

**From Founder's trial (TRIALING, no payment yet)**

1. `POST /api/v1/pricing/tier/change` cancels any deferred Founder's Razorpay sub (if present), creates an **immediate** Razorpay subscription on the target plan, and returns `{ subscription, checkout }`.
2. Frontend opens Razorpay **subscription checkout** (`subscription_id` + key).
3. Until checkout completes, local row stays **FOUNDERS_BETA / TRIALING** (only `razorpaySubscriptionId` updates).
4. On `subscription.authenticated` / `subscription.charged`, webhook sets **tier** from subscription notes (`target_tier`) or plan id, **status ACTIVE**, and billing period dates.
5. Monthly auto-billing continues on Razorpay.

**From ACTIVE paid subscription**

1. Backend sends Razorpay **PATCH** on the subscription: new `plan_id`, `schedule_change_at: now`.
2. Razorpay pro-rates: charges or credits the difference for the remainder of the cycle.
3. Local row updates **tier** and **razorpayPlanId** immediately after API success (`checkout: null`).
4. Webhook `subscription.updated` may also refresh plan id.

**Downgrade (product intent)**

- Same API path with a lower tier.
- If the brand exceeds new caps (e.g. 20 products → 5), product expects **out-of-bounds assets to be locked** until they comply. That enforcement is **not implemented** in v2 yet.

**Constraints today**

- Only **GROWTH_STARTER** and **PROFESSIONAL** can be selected via API.
- **Enterprise** is "Contact Sales" in UI (no self-serve API).
- Founder's preview does **not** require Connect Billing before upgrading to a paid tier.

---

## Scenario F — Grandfathering (Founder's Beta hidden for new users)

**New signup / no subscription**

- Public catalog shows: Growth Starter, Professional, Enterprise only.
- Founder's Beta is **not** listed.

**Existing Founder's Beta subscriber**

- Catalog also includes **Founder's Beta** so they keep their rate.
- Settings highlights their current grandfathered tier.

**How it works**

- `PlanCatalogService` filters on `isPubliclyAvailable` plus "show hidden tier only if user already occupies it".
- Frontend loads `/api/v1/pricing/plans` (authenticated), not a hardcoded list.

---

## Scenario G — Cancel subscription

**Immediate cancel**

1. Brand requests cancel (API: `cancel_at_cycle_end: false`).
2. If Razorpay subscription exists, cancel API is called.
3. Local status → **CANCELED** (when not waiting for cycle end).
4. Legacy profile `subscription_status` → **CANCELED**.

**Cancel at end of billing period**

1. `cancel_at_cycle_end: true` → Razorpay marks cancel at period end.
2. Local status may stay **ACTIVE** until Razorpay fires `subscription.cancelled`.
3. On webhook: status **CANCELED**.

**What the brand should experience after cancel**

- **Entitlement checks fail** for new actions (CANCELED / HALTED blocked).
- Settings shows **frozen** overlay (HALTED/CANCELED): reactivate CTA, muted plan details.
- Existing Brand DNA / data remains readable per product; **creation and automation paths** should stop (enforcement outside Settings is **partial** — see gaps).

**What is not automatic today**

- No prorated refund UI.
- No email confirmation flow.
- **Reactivate** calls `POST /api/v1/pricing/reactivate`: resumes halted Razorpay subs, creates a new sub after cancel, or opens pending invoice links for past-due. Tier picker is revealed on the billing dashboard per Pipeline 3 in `product-docs/Razorpay-setup.md`.

---

## Scenario H — Halted subscription

**Trigger**

- Razorpay `subscription.halted` (e.g. repeated payment failures, mandate issues).

**What happens**

- Status → **HALTED**.
- Same frozen pattern as canceled in Settings UI.
- Entitlement service rejects usage increments.

---

## Scenario I — Feature limits and counters

**Counter-based features (examples)**

| Feature key | Resets monthly on charge? | Example Founder's limit |
| --- | --- | --- |
| Deep scans | Yes | 1 / month |
| Managed outreach | Yes | 100 / month |
| AI chats | Yes | 50 / month |
| Products / collections / locations / rivals | No (cap until tier change) | 5 / 3 / 3 / 3 |

**When a brand uses a gated action**

1. `EntitlementService` loads subscription + usage rows.
2. If **CANCELED** or **HALTED** → block.
3. If **ENTERPRISE** → allow (no numeric cap).
4. If cyclic key and `resetAt` passed → reset count to 0 first.
5. If `currentUsage + increment > limit` → block with clear error.
6. Else increment counter.

**Where this is wired today**

- Backend service exists and is exported.
- **AI assistant**, outreach, deep scan, and product create paths are **not** all calling it yet.

---

## Scenario J — Geo and currency

**At trial bootstrap or Razorpay trial**

- Brand country **IN** → INR plans and INR compliance note (e RBI e-mandate).
- **US** → USD.
- **Other** → USD with cross-border FX warning in geo context API.

**Settings display**

- Shows **Tracking Ledger Currency** from subscription currency.
- Escrow and subscription currency should align for India brands (INR); USD vault for USD brands.

---

## Scenario K — Connection to escrow (fees and caps)

Pricing tier controls:

- **Collaboration fee %** on escrow locks (7% / 6% / 5% / 2%).
- **Aggregate escrow cap** per lock (e.g. ₹5,00,000 on Founder's Beta).

**Expected loop**

1. Brand starts collaboration funding.
2. Escrow interlock reads active subscription tier.
3. Take rate and cap applied before lock.

**Today:** `BrandEscrowModule` imports `PricingModule`; lock and `calculate-breakdown` use tier take rates and aggregate caps from `EntitlementService`. Escrow lock requires **ACTIVE** or **TRIALING** subscription.

---

## Scenario L — Launching a new public plan (operator playbook)

When product adds a tier (e.g. a new Growth SKU):

1. Create INR + USD plans in Razorpay dashboard.
2. Append enum value in Postgres if new tier name (`ALTER TYPE ... ADD VALUE`).
3. Add entries to `PLAN_MAPPINGS`, `FEATURE_LIMITS`, `ESCROW_TAKE_RATES`, and `PlanCatalogService.MASTER_CATALOG`.
4. Deploy backend; run migration on RDS.
5. Frontend catalog picks it up from `/api/v1/pricing/plans` (no hardcoded tier list in Settings).

To **retire** a plan for new users but keep old users: set `isPubliclyAvailable: false` in the catalog map (grandfathering pattern).

---

## Summary flow (bird's-eye)

```text
Sign up / open Settings → Billing
    → (No sub) Start 30-day local trial → TRIALING on Founder's Beta (free, no card)
    → Path A: Subscribe to Growth/Pro during trial → checkout → ACTIVE on paid tier
    → Path B: (Optional) Connect Billing → deferred Founder's sub → charge at trial end → ACTIVE on Founder's
    → Each month: subscription.charged → rollover + cyclic counter reset
    → ACTIVE customer changes plan → Razorpay PATCH pro-rata + new limits
    → Cancel / halt → CANCELED or HALTED → frozen UI, entitlements blocked
```

---

## Related docs

- Engineering index: [README.md](./README.md)
- Local testing (UI, API, DB, Razorpay): [testing-guide.md](./testing-guide.md)
- Implemented vs pending: [gaps-and-missing-setup.md](./gaps-and-missing-setup.md)
- Escrow (separate): `docs/escrow/expected-behaviour.md`
