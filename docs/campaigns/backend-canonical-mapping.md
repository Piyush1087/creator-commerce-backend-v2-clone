# Campaign backend → canonical mapping

**Status:** FROZEN for Phase 1–3 local implementation  
**Authority:** `docs/dummy_tcs` Campaign handoffs + contracts  
**Repos:** local `creator-commerce-backend-v2` / `creator-commerce-frontend-v2` (deploy to remote later; out of scope here)

## Lifecycle

| Legacy (pre-migrate) | Canonical |
|---|---|
| `DRAFT` | `DRAFT` |
| `ACTIVE` | Migrated to `LIVE` (historical rows). New flow: `PUBLISHED` then `LIVE` when execution-ready |
| `PAUSED` | `PAUSED` |
| `COMPLETED` | `COMPLETED` |
| `ARCHIVED` | `ARCHIVED` |

Canonical transitions:

- `DRAFT` → **Publish** → `PUBLISHED`
- `PUBLISHED` → **Go live** (execution-ready) → `LIVE`
- `LIVE` ↔ `PAUSED`
- `LIVE`/`PAUSED` → `COMPLETED` → `ARCHIVED`

Persistence: Prisma `UceCampaignStatus` is schema-migrated (no FE disguise of `ACTIVE` as `LIVE`). Apply with `db:migrate:deploy` + `prisma:generate` (no shadow DB / `migrate:dev`).

## Visibility / compensation adapters

Product vocabulary stays canonical; persistence enums retain historical names via explicit adapters in shared Zod:

- Visibility: `PUBLIC|ELIGIBLE_CREATORS_ONLY|INVITE_ONLY` ↔ `EVERYONE|ELIGIBLE_ONLY|INVITED_ONLY`
- Compensation: `FIXED|NEGOTIABLE` ↔ `FIXED_FEE|NEGOTIABLE`
- Campaign currency: derived from Brand country (`IN` → `INR`, else `USD`); not Brand free-input
- KPI IDs: resolved from canonical KPI framework; not Brand-authored Campaign fields

## Campaign Page read model

Legacy `GET /api/v1/brand-uce/campaigns/:id` shell (`zone_1_*`, `activation_checklist`) is **not** the canonical View DTO.

Canonical read path (Phase 2/3): Campaign query service returns hydration outcome, `executionReady`, capability presentations (`ENABLED|DISABLED|HIDDEN`), workspace visibility, products/briefs summary, share channels, copilot/performance projections.

## Applicants / Collaboration

Canonical persistence: `UceCampaignCreator` + `UceApplication` + `UceApplicationSnapshot`.

- Applicants workspace reads Applications (not Collaboration rows as truth).
- Approve/Reject commands take `applicationId`; sibling PENDING apps → `SUPERSEDED`.
- Collaboration provision remains an explicit downstream handoff after Application approval (legacy Collaboration rows may be synced into Applications for backfill).

## Share / Outreach

- Share: `UceCampaignShare` + `UceCampaignShareTrackingEvent` persist on execute; idempotent by `requestId`.
- Outreach: channel resolution/quota/idempotency are service-owned; FE does not choose Email vs Priority DM as truth.

## Reporting

Legacy SaaS reporting dashboard remains temporary data source for bounded “last-known/accepted” projections only. Campaign Reporting architecture is Campaign-owned summary + deferred Intelligence — not the old tab runtime.

## Staging

`docs/dummy_tcs/frontend/staging/**` is reference-only. Never migrate shell, scenario fixtures, or command harness into frontend-v2.
