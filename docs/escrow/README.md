# Brand escrow — engineering notes

## Source of truth (read-only)

Product requirements live in **`docs/escrow/product-docs/`**.  
That folder is owned by the product team. **Do not edit it** when implementing backend or frontend work.

Use this directory (`docs/escrow/`) for engineering intake, schema mapping, API notes, and deployment runbooks.

## Human-readable docs (this folder)

| Doc | Audience |
| --- | --- |
| [expected-behaviour.md](./expected-behaviour.md) | Product, QA, stakeholders — what users should see and do |
| [testing-guide.md](./testing-guide.md) | QA and developers — Razorpay test mode, webhooks, checklists |
| [gaps-and-missing-setup.md](./gaps-and-missing-setup.md) | What is not wired yet or needs infra setup |

## Backend module

- Feature path: `src/features/brand-escrow/`
- Registered in `src/app.module.ts` as `BrandEscrowModule`

## Schema mapping (product → v2)

| Product doc concept | v2 implementation |
| --- | --- |
| `brands.brand_id` | `brand_profiles.id` (`BrandEscrowVault.brandProfileId`, column `brand_id`) |
| `collaborations.id` | `collaborations.id` |
| `creator_settlement_profiles.creator_id` | `creator_profiles.id` (`CreatorSettlementProfile.creatorProfileId`) |
| Workflow stages (NEGOTIATION, LOGISTICS, …) | `UceMilestoneStage` on `collaborations.current_stage` |
| `collaboration_commercials.escrow_vault_id` | Set to `brand_escrow_vaults.vault_id` on Stage 2 lock |

Migration: `prisma/migrations/20260608120000_brand_escrow_module/`

## Local database

```bash
npm run prisma:generate
npm run db:migrate:deploy
```

Prefer `db:migrate:deploy` over `db:migrate:dev` when shadow DB replay fails.

## API surface (brand JWT unless noted)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/v1/escrow/initialize` | Razorpay virtual account |
| GET | `/api/v1/escrow/vault` | Balances + VBA |
| GET | `/api/v1/escrow/ledger` | Ledger entries |
| POST | `/api/v1/escrow/topup-intent` | Card top-up order |
| POST | `/api/v1/escrow/calculate-breakdown` | Fee / TDS preview |
| POST | `/api/v1/escrow-engine/lock-collaboration-funds` | Stage 2 lock |
| POST | `/api/v1/escrow-engine/disburse-tranche-payout` | 30% / 70% release |
| POST | `/api/v1/escrow-interlock/transition-stage` | Stage guards |
| POST | `/api/v1/escrow-interlock/trigger-rule-refund` | Cancellation refunds |
| POST | `/api/v1/hardened-escrow/lock-funds` | Requires `x-idempotency-key` header |
| POST | `/api/v1/webhooks/escrow` | Razorpay webhooks (no JWT) |

Brand scope is resolved from the authenticated user via `BrandCentreAuthService`, not from a client-supplied brand id.

## Environment

```env
RAZORPAY_API_KEY_ID=
RAZORPAY_API_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

Optional: `EXTERNAL_API_TIMEOUT_MS` (default `10000`).

Webhook dashboard setup: use [testing-guide.md](./testing-guide.md) §2.3 (matches live Razorpay event groups). Product reference: `product-docs/razorpay-setup.md` (read-only).
