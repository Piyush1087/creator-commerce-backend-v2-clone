# Brand Centre Brand consumer implementation

Starting backend: `ab798c563e8ee3bfb152941d076ded6553cf6944`.
Branch: `phase-g/brand-centre-brand-consumer-integration`.
Canonical authority: `dummy_tcs@a6bed1f28564c002f7d76931de0b4dd960ea5ae1`.
Accepted FE read/state authority: `62f88e3722226b23b20f017a9b69a63d2ca6db99`.
This is backend review work, not a development merge or frontend implementation.

## Consumer API

`GET /api/v1/brand-centre/brand` uses the existing JWT and throttling guards and
Brand Centre organization/role ownership resolver. It accepts no Brand selector.
An arbitrary `brandId` query parameter cannot redirect the read. Existing session
housekeeping is retained; this route performs no semantic writes or acquisition.

Response:

```text
brandId, workspaceReadiness, runtimeActivity
identity: brandName, website, industry, category, primaryGeography, currency, socialHandles
details: canonical industry/category/geography/currency anchors
visualIdentity:
  canonical: primaryLogo, secondaryMarks, palette, headingFont, bodyFont, typography, referenceImages
  style: current visual_style_profile envelope
brandIdentity:
  description, positioning, valueProposition, values, personality, differentiation, communication
audience: state, personas (ACTIVE only)
locations: durable locationId, canonical fields/lifecycle/authority, observation metadata
serviceability: state (serviceability_basis traceability omitted)
```

Each field has `semanticId`, discriminated `current`, readiness, resultReadiness,
freshness, authority presentation and explicit editability. Intelligence envelopes
also contain bounded candidate notices, mixedGeneration and `componentMeta` keyed
by stable typed semantic paths. Metadata contains no generation IDs, Evidence refs,
raw candidates, provider identities or execution diagnostics. Frozen semantic
payload keys/semantic IDs remain unchanged for the frontend adapter to map.
`componentMeta` preserves independently authoritative/fresh fields and items; it is
not a second current-state store or a write authorization.

Current kinds: VALUE, EXPLICIT_NULL, INTENTIONALLY_ABSENT, NO_CURRENT,
NOT_EVALUATED, NOT_OWNED. Missing is not replaced with legacy DNA/Preview. Empty
known collections remain VALUE([]). Readiness remains READY/PARTIAL/NOT_READY;
failed refreshes never become resultReadiness=FAILED and do not erase current.
Runtime hints are NONE/LEARNING/REFRESHING/TEMPORARILY_UNAVAILABLE, separate from
permanent CURRENT/STALE/UNKNOWN freshness. Location observation freshness retains
POSSIBLY_STALE without redefining canonical lifecycle.

Canonical collections expose UUIDs and per-item authority/revision/lifecycle.
No canonical aggregate means NO_CURRENT, even if legacy scanned colors/fonts/logo
exist. Approved canonical visual state and derived style remain separate. Likewise,
Locations never substitute for or derive from serviceability; serviceability never
substitutes audience geography. Inactive/superseded Persona content is omitted.

## Current-read registration reconciliation

The historical audit's six gaps were values, personality, differentiation, audience,
visual style and serviceability. At the required backend baseline, accepted
brand_character already registers values and personality. Those two are preserved;
four frozen read-only scopes complete all ten Brand workspace Objects using the
existing `IntelligenceCurrentContractScopeService` and projection service.

`scripts/generate-current-read-contracts.mjs` derives those four scopes from exact
FROZEN output contracts at a6bed1f. It records artifact SHA-256 hashes and exposes
no runtime arbitrary-file loader. It does not authorize writes in the bundle
ownership registry, register a processor, or enable execution.

```powershell
node scripts/generate-current-read-contracts.mjs --source <authority-checkout> --verify
npm run intelligence:contracts:verify -- --source <clean-character-authority-checkout> --commit 56b52c1106feff2a92f23a7c49674fd116bf8c63
```

All three real processor pins and execution states are unchanged:

| Processor | Architecture pin | Bundled / registered / execution |
| --- | --- | --- |
| brand_communication | 017dbceac494f0861ec9a6bea7af3129b70fa5cb | YES / YES / YES |
| brand_meaning | 2e13fa40235094d127f72b38f43c510232e38be4 | YES / YES / YES |
| brand_character | 56b52c1106feff2a92f23a7c49674fd116bf8c63 | YES / YES / YES |

## Validation and boundaries

Set `BRAND_CENTRE_DATABASE_TEST=true` and DATABASE_URL to a disposable migrated
PostgreSQL database for the canonical-state, consumer HTTP/isolation and deep-scan
tests. Deep-scan tests use a fixture provider, not live model calls. Existing
PostgreSQL flags for BI execution/projection, communication/meaning/character,
Gatekeeper and DE B–F must also be enabled for the complete regression matrix.
The standalone W1.0A SQL constraint suite remains part of validation.

Coverage includes durable ID/CAS races, canonical-primary protection, explicit
legacy actions, scan-only no-approval, font reorder, exact/ambiguous Location
matching, explicit-ID precedence, protected rows, stale omission, Offering refs,
all ten read scopes, protected current/candidates, explicit null/partial/missing,
failed-refresh retention, active Personas, separate derived state and real JWT
authorization/isolation.

Unresolved Product permissions are isolated: no new alternate-mark/reference-image
CRUD routes, general visual-item editing API, Location lifecycle/confirmation API,
Intelligence edits or candidate accept/reject/detail API is introduced. Consumer
editability is READ_ONLY for application fields and POLICY_PENDING for Intelligence
and Location fields. Existing authorized logo/identity actions continue separately.
Legacy onboarding upload/profile/identity-confirmation routes currently have only
ThrottlerGuard and caller-supplied profile/lead IDs. They are not a proven Brand
approval authority and remain compatibility-only. The new database mirror guard
prevents them from displacing an approved canonical logo. Product/security ownership
authorization is required before using those paths for canonical approval; no such
workflow is invented here. These deferred write policies do not block canonical reads.

No new provider/model binding, processor execution behavior, shared runtime
primitive, frozen semantic amendment, DE write path or frontend change is included.

## Validation record — 2026-08-26

- Full matrix: 582 tests passed in 90 files, zero failures/skips, with every database
  suite enabled. The initial default-timeout run hit existing 5s test/10s hook
  limits; the complete rerun used one worker and 60s test/hook limits. No assertion
  or production timeout was changed.
- Final migration hardening uses fixed-width exact postal fingerprints and matching
  whitespace normalization. After that change, all 48 migrations reset/reapplied
  again and all 27 affected feature tests passed again (15 canonical state, 5
  consumer HTTP/database, 2 deep-scan database, 5 architecture).
- Separate pre-migration compatibility database: all 47 historical migrations,
  duplicate whitespace-varied legacy Locations, a 20KB legacy address, and an
  Offering relationship; final migration preserved every UUID/relationship and
  legacy visual JSON, flagged the duplicate alias, and created zero visual approvals.
- Prisma generate/validate, Nest build, scoped ESLint, diff check, pinned existing
  bundle verification and generated read-scope verification passed.
- Built-dist BrandCentre module dependency injection and startup verification
  passed; exactly the three accepted processors remain executable.
- W1.0A SQL constraint suite passed again after the final reset. No production
  database or real provider was used. Development remains at the starting SHA.

## Exact change inventory

```text
docs/ai-collaboration/brand-centre-brand-consumer.md
docs/database/brand-centre-canonical-state.md
prisma/schema.prisma
prisma/migrations/20260826140000_brand_centre_canonical_state/migration.sql
scripts/generate-current-read-contracts.mjs
src/features/brand-canonical-state/brand-canonical-state.module.ts
src/features/brand-canonical-state/brand-canonical-state.postgres.test.ts
src/features/brand-canonical-state/brand-location.service.ts
src/features/brand-canonical-state/brand-visual-state.service.ts
src/features/brand-centre/brand-centre.module.ts
src/features/brand-centre/consumer/brand-consumer.architecture.test.ts
src/features/brand-centre/consumer/brand-consumer.controller.ts
src/features/brand-centre/consumer/brand-consumer.mapper.ts
src/features/brand-centre/consumer/brand-consumer.postgres.test.ts
src/features/brand-centre/consumer/brand-consumer.service.ts
src/features/brand-centre/consumer/brand-consumer.types.ts
src/features/brand-centre/services/brand-centre-dna.service.ts
src/features/brand-centre/workers/deep-scan-canonical-boundary.postgres.test.ts
src/features/brand-centre/workers/deep-scan.worker.ts
src/features/brand-intelligence/projection/current-read-contracts.generated.ts
src/features/brand-intelligence/projection/intelligence-current-contract-scope.service.ts
src/features/brand-onboarding/brand-onboarding.module.ts
src/features/brand-onboarding/surface-scan/http-brand-surface-scan.runner.ts
```

Legacy onboarding profile/confirmation files remain byte-for-byte unchanged from
the baseline. No generated BI processor bundle, DE implementation, historical
migration, frontend or frozen semantic authority file changed.
