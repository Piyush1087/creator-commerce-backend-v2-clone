# Brand pricing & subscriptions — engineering notes

## Source of truth (read-only)

Product requirements live in **`docs/pricing/product-docs/`**.  
That folder is owned by the product team. **Do not edit it** when implementing backend or frontend work.

Use this directory (`docs/pricing/`) for engineering intake, behaviour notes, API mapping, and deployment runbooks.

## Human-readable docs (this folder)

| Doc | Audience |
| --- | --- |
| [expected-behaviour.md](./expected-behaviour.md) | Product, QA, stakeholders — trials, rollover, cancel, grandfathering, entitlements |
| [testing-guide.md](./testing-guide.md) | Local QA — UI, API, DB edits, Razorpay + ngrok, scenario playbook |
| [gaps-and-missing-setup.md](./gaps-and-missing-setup.md) | What is implemented vs pending, Razorpay setup, test checklist |

## Backend module

- Feature path: `src/features/pricing/`
- Registered in `src/app.module.ts` as `PricingModule`

## Frontend module (v2)

- Feature path: `creator-commerce-frontend-v2/src/features/pricing/`
- Settings entry: `Settings → Billing` → **Billing overview** (`settings-billing-sections.tsx` → `PricingBillingPanel`)
- Escrow UI is separate: `Settings → Secure escrow`

## Schema mapping (product → v2)

| Product doc concept | v2 implementation |
| --- | --- |
| `brands.brand_id` | `brand_profiles.id` (`BrandSubscription.brandProfileId`, column `brand_id`) |
| `brand_subscriptions` | `BrandSubscription` model |
| `feature_usages` | `FeatureUsage` model |
| Legacy onboarding plan fields | `brand_profiles.plan_type`, `subscription_status`, `trial_ends_at` (synced on write) |

Migrations:

- `prisma/migrations/20260608140000_pricing_module/`
- `prisma/migrations/20260608160000_pricing_billing_invoices/` — webhook audit cache (`brand_billing_invoices`)

## Local database

```bash
npm run prisma:generate
npm run db:migrate:deploy
```

Prefer `db:migrate:deploy` over `db:migrate:dev` when shadow DB replay fails.

## API surface (brand JWT unless noted)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/pricing/plans` | Grandfathered catalog for logged-in brand |
| GET | `/api/v1/pricing/plans/public` | Public catalog (no JWT) |
| GET | `/api/v1/pricing/subscription` | Current subscription row |
| GET | `/api/v1/pricing/usage` | Limits + usage snapshot |
| GET | `/api/v1/pricing/geo-context` | Zone + currency |
| POST | `/api/v1/pricing/trial/bootstrap` | Local 30-day Founder's trial (no card, no Razorpay id) |
| POST | `/api/v1/pricing/trial/razorpay` | Optional deferred Founder's renewal at trial end (`start_at`) |
| POST | `/api/v1/pricing/tier/change` | Upgrade/downgrade (Growth / Pro). From **TRIALING**: returns `checkout` for Razorpay subscription UI; from **ACTIVE**: PATCH pro-rata, `checkout: null` |
| POST | `/api/v1/pricing/cancel` | Cancel subscription |
| POST | `/api/v1/pricing/reactivate` | Billing recovery (resume / new sub / past-due payment links) |
| GET | `/api/v1/pricing/invoices` | Invoice list (live Razorpay; no local sync job) |
| GET | `/api/v1/pricing/invoices/:razorpayInvoiceId` | Invoice detail (live Razorpay) |
| GET | `/api/v1/pricing/invoices/:razorpayInvoiceId/view` | 302 redirect to Razorpay `short_url` |
| POST | `/api/v1/webhooks/subscription` | Razorpay `subscription.*`, `payment.failed`, `invoice.paid`, `invoice.payment_failed` (no JWT) |

Brand scope is resolved from the authenticated user via `BrandCentreAuthService`, not from a client-supplied brand id.

## Trial vs paid upgrade (product rule)

| Path | Payment | Razorpay |
| --- | --- | --- |
| **Founder's 30-day preview** | Free — full platform access | None until optional Connect Billing or paid-tier upgrade |
| **Stay on Founder's after trial** | Charge at trial end | `trial/razorpay` — deferred sub (`start_at` +30 days) |
| **Growth Starter / Professional** | Immediate + monthly auto-bill | `tier/change` → subscription checkout (`subscription_id`) |

Onboarding (`pricing-view.tsx`) calls `trial/bootstrap` after registration. Paid-tier buttons in Settings open Razorpay subscription checkout via `src/features/pricing/utils/razorpay-subscription-checkout.ts`.

## Constants

`src/features/pricing/constants/subscription.constants.ts`

- `PLAN_MAPPINGS` — Razorpay plan id per tier × currency (optional env overrides)
- `RAZORPAY_PLAN_DEFINITIONS` — auto-provisioned via API when plans are missing
- `FEATURE_LIMITS` — per-tier caps including `ESCROW_AGGREGATE_CAP`
- `ESCROW_TAKE_RATES` — collaboration fee % by tier
- `CYCLIC_FEATURE_KEYS` — reset on `subscription.charged`

## Environment

**Backend**

```env
RAZORPAY_API_KEY_ID=
RAZORPAY_API_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

**Frontend (v2)**

```env
VITE_RAZORPAY_KEY_ID=   # same Key Id as backend (public)
```

Optional: `EXTERNAL_API_TIMEOUT_MS` (default `10000`). Optional plan overrides: `RAZORPAY_PLAN_<TIER>_<CURRENCY>=plan_xxx`.

Razorpay dashboard setup: `product-docs/Razorpay-setup.md` (read-only). Local dev: plans auto-create on first `trial/razorpay` or `tier/change`.

## Escrow interlock

`BrandEscrowModule` imports `PricingModule`. Lock and `calculate-breakdown` use tier take rates and aggregate caps from `EntitlementService`. See `product-docs/Pricing-escrow-connection.md` and [gaps-and-missing-setup.md](./gaps-and-missing-setup.md).
