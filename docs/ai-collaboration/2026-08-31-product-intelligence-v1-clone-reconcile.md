# Product Intelligence V1 clone reconcile (backend)

Date: 2026-08-31
Branch: `feature/brand-centre-v2-integration` (from origin `development`)
Frozen source: clone `development` @ `17214722dc20abf23c8dce935a58050a017f6639`

## Source of truth

- Executable Product Intelligence implementation: frozen clone SHA above
- Product/architecture authority: `dummy_tcs` main @ `677a6333d143d02a715274ee9bed42ade96808b3`
- Handoff: `docs/brand-centre/Creator_Shop_Product_Intelligence_V1_Developer_Handoff (1).docx`
- Continuation of Brand Centre v1 already on origin `development` (PR #21; handoff SHA `e066265`)
- Do not merge clone `development` wholesale (clone lacks origin collaboration migrations)

## Domain separations to preserve

- Canonical `GET /api/v1/brand-centre/offerings` ≠ legacy `GET /api/v1/brand-centre/dna/offerings`
- Commercial DE Evidence ≠ canonical price
- `commercial_context` ≠ canonical price
- Product talking points ≠ Campaign copy
- Product candidate ≠ current
- Processor failure ≠ Object FAILED readiness
- Offering `ACTIVE` ≠ Campaign eligibility
- Unresolved canonical Offerings are undiscoverable, not deleted
- No migration 53

## Pull method

Path checkout from the frozen SHA, then port PI schema onto origin `schema.prisma`. Apply clone migrations 50–52 with `db:migrate:deploy` (no shadow DB).
