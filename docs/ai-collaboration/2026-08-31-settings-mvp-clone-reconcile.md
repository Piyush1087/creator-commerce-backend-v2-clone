# Settings MVP clone reconcile (backend)

Date: 2026-08-31
Branch: `feature/settings-mvp-v2-integration` (from origin `development` @ PI merge PR #22)
Frozen source: clone `program/brand-settings-mvp` @ `517531682f6286d5ee45bd48ec4e145e96d583a7`

## Source of truth

- Executable Settings MVP implementation: frozen clone SHA above
- Handoff: `docs/settings/product-docs/v2-handoff/Creator_Shop_Settings_MVP_Developer_Handoff.docx`
- Base on origin `development` (Brand Centre v1 + Product Intelligence v1 already merged)
- Do **not** merge clone `program/brand-settings-mvp` wholesale (clone lacks origin collaboration migration history)

## Integration scope (code port)

- `brand-settings`, `creator-settings`, hardened `auth`, `notifications`, `pricing`, `brand-escrow`
- Mail/Postmark module wiring; bounded `.env.example` + `sst.config.ts`
- Settings intake docs under `docs/ai-collaboration/2026-08-26-bs*.md`

## Preserve on origin (do not overwrite from clone)

- Origin collaboration migrations and modules
- Gatekeeper / brand-preview / data-extraction provider stack as reconciled on origin
- `AGENTS.md`, `BRANCHING.md`, origin `docs/ai-collaboration` collab reconcile notes
- Product Intelligence v1 slice already on `development`

## Deferred per handoff (fail-closed OK)

- Live Meta, Postmark delivery certification, Razorpay production enablement
- BS-04 Brand Return live adapter, BS-09 Route payout live adapter
- Production deployment runbook §8 Phases 4–6 and evidence register §11

## Database

- Port Settings schema deltas onto origin `prisma/schema.prisma`
- Add Settings migrations **after** PI migrations; renumber clone timestamps that collide with `20260828120000_*`
- Apply with `npm run db:migrate:deploy` only (no shadow DB, no `migrate dev`)

## Pull method

Path checkout from frozen SHA for Settings-scoped trees, then manual schema/migration reconcile on origin base.
