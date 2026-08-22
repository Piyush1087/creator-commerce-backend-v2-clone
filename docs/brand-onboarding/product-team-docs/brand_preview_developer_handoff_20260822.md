# Brand Preview — Developer Production Handoff

**Date:** 2026-08-22  
**Status:** READY FOR DEVELOPER PRODUCTION RECONCILIATION  
**Scope:** Brand onboarding — Gatekeeper handoff → Fast Brand Analysis → Brand Preview → Verify & claim  
**AI delivery status:** COMPLETE  
**Production merge/deployment:** NOT PERFORMED

---

## 1. Purpose

This handoff gives the developer the exact accepted clone baselines, runtime behavior, migration, environment requirements, authority references, validation evidence and production integration order for Brand Preview.

The implementation has already passed cross-system runtime acceptance in the clone repositories. The developer is **not** being asked to redesign or reinterpret the feature.

The developer-owned task is:

```text
accepted frontend/backend clone implementations
→ reconcile into actual production repositories
→ apply production database migration
→ configure production environment/secrets
→ deploy backend
→ deploy frontend
→ perform production smoke validation
```

If a production-repository conflict appears, treat it as an integration issue. Do not revive legacy Surface / Brand DNA onboarding semantics to resolve it.

---

## 2. Final accepted clone SHAs

### Frontend clone

Repository:

`Piyush1087/creator-commerce-frontend-v2-clone`

Final integrated clone branch:

`development`

Final accepted SHA:

`cbef201c571c6493c0a83ca4a6be12963faa959d`

Previous Gatekeeper baseline:

`79fceb933f0076a4b98ce9020d9a9815436a3c54`

Integration topology:

- source-only commits before integration: 35
- development-only commits before integration: 0
- merge base: `79fceb933f0076a4b98ce9020d9a9815436a3c54`
- integration method: non-force fast-forward
- candidate vs final `development` diff: empty

### Backend clone

Repository:

`Piyush1087/creator-commerce-backend-v2-clone`

Final integrated clone branch:

`development`

Final accepted SHA:

`89d7dcc7e00c12b499850e2ff1c74364c4a83c19`

Previous Gatekeeper baseline:

`ae901a5537b19be6d06301fb0c12ac5e44c21018`

Integration topology:

- source-only commits before integration: 2
- development-only commits before integration: 0
- merge base: `ae901a5537b19be6d06301fb0c12ac5e44c21018`
- integration method: non-force fast-forward
- candidate vs final `development` diff: empty

These clone SHAs are the accepted implementation authority. They are not instructions to force production branches to those SHAs.

---

## 3. Product behavior delivered

The accepted runtime now supports:

```text
Landing / existing Gatekeeper entry
→ Gatekeeper admission
→ supported Industry confirmation
→ Fast Brand Analysis
→ Brand Preview
→ Verify & claim this brand
→ existing work-email verification flow
```

Brand Preview is intentionally non-editable and contains five semantic sections:

1. the Brand recognized/found;
2. how Creator Shop understands the Brand;
3. who the Brand needs to influence;
4. where creators can make the difference;
5. creator archetypes Creator Shop would start with.

The onboarding does **not** reintroduce Core Identity review, Brand DNA review, Product Catalogue review, Competitor review, Budget, Pricing, Campaign configuration or confidence percentages.

---

## 4. Backend changes — implementation summary

The backend adds a bounded Brand Preview runtime after Gatekeeper admission + supported Industry confirmation.

Major additions:

- provider-neutral Brand Preview website Evidence acquisition;
- bounded direct-site acquisition with selective Zyte fallback;
- one bounded public-web enrichment path when IE policy permits;
- Brand Preview synthesis runtime using frozen IE artifacts;
- deterministic semantic validation/readiness;
- canonical creator-archetype validation;
- durable `BrandPreviewRun` persistence;
- concurrency-safe run/retry handling;
- API-safe Preview projection;
- reuse of the existing Brand verification flow.

Legacy Stage 1B / Surface / Brand DNA orchestration is not the canonical runtime for this journey.

### Backend files changed from Gatekeeper baseline

The authoritative change range is:

`ae901a5537b19be6d06301fb0c12ac5e44c21018..89d7dcc7e00c12b499850e2ff1c74364c4a83c19`

Important changed areas include:

```text
prisma/migrations/20260822120000_brand_preview_runtime/migration.sql
prisma/schema.prisma
scripts/copy-prompt-assets.mjs

src/features/brand-onboarding/brand-onboarding.controller.ts
src/features/brand-onboarding/brand-onboarding.module.ts
src/features/brand-onboarding/gatekeeper/gatekeeper-industry-confirmation.service.ts
src/features/brand-onboarding/gatekeeper/gatekeeper-v1.types.ts

src/features/brand-onboarding/brand-preview/
src/features/brand-onboarding/brand-preview/data-extraction/
src/features/brand-onboarding/brand-preview/runtime/

src/features/data-extraction/data-extraction.module.ts
src/features/data-extraction/providers/gemini-gatekeeper.provider.ts
src/features/data-extraction/providers/gemini-structured.provider.ts
src/features/data-extraction/providers/openai-structured.provider.ts
src/features/data-extraction/services/structured-evidence-execution.service.ts

src/intelligence/runtime/models/model-registry.resolver.ts
src/intelligence/runtime/validation/brand-preview.validation.ts
src/intelligence/runtime/validation/brand-preview.validation.test.ts
```

Use the Git range above as the exact production reconciliation source rather than relying only on this summary.

---

## 5. Database migration

Migration:

`20260822120000_brand_preview_runtime`

File:

`prisma/migrations/20260822120000_brand_preview_runtime/migration.sql`

It adds durable Brand Preview run state, including:

- one run per `DiscoveryLead`;
- stable run ID;
- runtime state;
- completeness;
- truthful phase;
- optional BrandProfile mapping;
- Evidence/output snapshots;
- retry/enrichment state;
- lease/concurrency state;
- structured error metadata;
- timestamps and indexes.

No permanent Brand columns were added for Preview descriptor, Preview audiences, Preview opportunities or Preview archetypes.

### Important migration correction already included

The final accepted migration uses PostgreSQL `TEXT` for:

- `brand_preview_run_id`;
- `discovery_lead_id`;
- `brand_profile_id`.

Foreign keys correctly reference:

- `discovery_leads(id)`;
- `brand_profiles(id)`.

Do not reintroduce UUID assumptions for these existing String/Text identifiers.

### Validation evidence

On a fresh PostgreSQL 16.14 database:

- all 45 migrations applied from zero;
- Brand Preview migration applied successfully;
- schema constraints passed;
- unique run per DiscoveryLead passed;
- existing Gatekeeper/BrandProfile data remained intact.

---

## 6. Backend API surface

### Industry confirmation

`POST /api/v1/discovery/:leadId/confirm-industry`

Accepted behavior:

- confirmed supported Industry starts or resumes exactly one Brand Preview run;
- unsupported Industry never starts Brand Preview;
- existing Gatekeeper compatibility remains intact.

### Brand Preview state

`GET /api/v1/discovery/:leadId/brand-preview`

Canonical public states:

```text
ANALYSIS_ACTIVE
PREVIEW_READY
PREVIEW_FAILED_RECOVERABLE
PREVIEW_NOT_READY
```

The response may also include:

- truthful normalized phase;
- `NORMAL | PARTIAL` completeness when ready;
- retry capability;
- Brand Preview payload;
- `verificationContext.brandProfileId`.

The public response must not expose provider/model names, raw Evidence, private reasoning or internal confidence fields.

### Retry

`POST /api/v1/discovery/:leadId/brand-preview/retry`

Accepted behavior:

- available only for recoverable runtime failure;
- duplicate/concurrent retries do not create duplicate runs;
- attempt increments on authorized retry.

### Verification

Reused unchanged:

`POST /api/v1/brand/profiles/:brandProfileId/verification/send`

The Brand Preview frontend uses the stable returned `verificationContext.brandProfileId`.

Do not create a second Brand verification-start flow.

---

## 7. Frontend changes — implementation summary

The frontend now maps the Brand Preview runtime into the accepted UX states and Stitch-reconciled screens.

Major additions/reconciliation:

- Fast Brand Analysis state;
- truthful Understanding Thread phase mapping;
- slow-analysis presentation;
- recovery / Trust Boundary presentation;
- Brand Preview NORMAL and PARTIAL layouts;
- runtime polling/resume;
- retry behavior;
- verification transition;
- mobile 390 behavior;
- accessibility/live-region/focus behavior;
- exact backend response normalization.

### Frontend files changed from Gatekeeper baseline

The authoritative change range is:

`79fceb933f0076a4b98ce9020d9a9815436a3c54..cbef201c571c6493c0a83ca4a6be12963faa959d`

Files in that range:

```text
src/features/brand-onboarding/api/brand-preview-client.test.ts
src/features/brand-onboarding/api/brand-preview-client.ts
src/features/brand-onboarding/brand-preview.css
src/features/brand-onboarding/components/analysis-recovery-view.tsx
src/features/brand-onboarding/components/brand-preview-journey-view.tsx
src/features/brand-onboarding/components/brand-preview-runtime-integration.test.ts
src/features/brand-onboarding/components/brand-preview-view.tsx
src/features/brand-onboarding/components/fast-brand-analysis-view.tsx
src/features/brand-onboarding/contracts/brand-preview.contracts.ts
src/features/brand-onboarding/mappers/map-brand-preview-state.test.ts
src/features/brand-onboarding/mappers/map-brand-preview-state.ts
src/features/brand-onboarding/schemas/brand-preview-runtime-schema.test.ts
src/features/brand-onboarding/schemas/brand-preview-runtime-schema.ts
src/features/brand-onboarding/session/onboarding-session.ts
src/layouts/brand-onboarding-shell/BrandOnboardingShell.tsx
src/layouts/brand-onboarding-shell/brand-onboarding-shell.css
src/pages/brand/onboarding/brand-onboarding-scan-page.tsx
src/routes/brand-onboarding-app.tsx
```

### Critical backend → frontend runtime mapping

The backend public projection uses:

```text
audience_groups
creator_marketing_opportunities
creator_archetype_recommendations
brand_descriptor
brand_understanding_narrative
retryAllowed
verificationContext.brandProfileId
```

The frontend adapter intentionally normalizes these into its view model:

```text
audience_groups
→ audiences

creator_marketing_opportunities
→ opportunities

creator_archetype_recommendations
→ creatorStartingPoint.archetypes

brand_descriptor
→ identity.brandDescriptor

brand_understanding_narrative
→ understanding.narrative

retryAllowed
→ canRetry

verificationContext.brandProfileId
→ frontend stable brandProfileId
```

Do not remove this adapter or rename backend fields to match frontend terminology without a separately approved contract change.

Contract-invalid successful responses enter the existing recoverable presentation instead of silently polling forever.

---

## 8. Canonical frontend states

Frontend semantic states:

```text
FAST_ANALYSIS_ENTERING
FAST_ANALYSIS_ACTIVE
FAST_ANALYSIS_SLOW
PREVIEW_READY
ANALYSIS_RECOVERABLE_FAILURE
PREVIEW_NOT_READY
STARTING_BRAND_VERIFICATION
```

Backend normalized phases, only when truthfully observable:

```text
UNDERSTANDING_BRAND
LEARNING_AUDIENCE
FINDING_CREATOR_OPPORTUNITIES
PREPARING_PREVIEW
```

If no truthful phase is supplied, frontend uses the generic Brand Preview analysis treatment. Do not create timer-generated fake runtime phases.

A valid `PREVIEW_READY / PARTIAL` may be exactly:

```text
1 Audience
1 creator opportunity
1 creator archetype
```

Missing logo and/or descriptor is non-blocking. Do not add filler cards.

---

## 9. Environment / provider requirements

Required backend environment:

```text
DATABASE_URL
GEMINI_API_KEY
OPENAI_API_KEY
```

Optional/selective fallback:

```text
ZYTE_API_KEY
```

Also required:

- outbound access to Brand websites;
- outbound access to configured model providers;
- whatever existing environment variables the current production Gatekeeper/verification deployment already requires.

Do not commit `.env` files or secret values.

### Provider ownership

The feature code must not hardcode model/provider fallback decisions. The accepted implementation resolves model policy through the shared Intelligence model registry/execution profile.

---

## 10. Canonical architecture / Product references

Repository:

`Piyush1087/dummy_tcs`

Important authority:

```text
intelligence/product_authority/brand_onboarding_v1_product_authority.md
frontend/brand-onboarding/brand_preview_ux_copy_contract.md
frontend/brand-onboarding/brand_preview_frontend_state_contract.yaml
frontend/brand-onboarding/brand_preview_screen_interaction_contract.md
frontend/brand-onboarding/design/brand_preview_visual_direction_brief.md
frontend/brand-onboarding/design/brand_preview_stitch_family_visual_brief.md
data_extraction/brand_preview_fast_evidence_acquisition_design.md
intelligence/engines/brand_intelligence/brand_preview_minimum_output_contract.yaml
intelligence/engines/brand_intelligence/processors/brand_preview_synthesis/processor.yaml
intelligence/engines/brand_intelligence/processors/brand_preview_synthesis/reasoning.yaml
intelligence/engines/brand_intelligence/processors/brand_preview_synthesis/output_contract.yaml
intelligence/engines/brand_intelligence/brand_preview_archetype_reasoning.yaml
intelligence/execution_profiles/brand_preview_fast.yaml
campaign/canonical/creator_archetypes.yaml
```

Relevant frozen commits:

```text
Brand onboarding Product Authority:
02715caaa48f46ce4c35dd5503f3700534ad7e85

Brand Preview FE/copy authority:
801ac7c6680fb3ecbc05dc4db064e9406b73b128

Brand Preview DE authority:
2c575911d83d47e59c0b714b3e2154402c1ad879

Brand Preview IE runtime authority:
24fa837d287315ac0f68554f741157b68773e529

Brand Preview visual direction:
d5e643561ffcc2f3e561db5c7ec3615ccd724c0c

Brand Preview Stitch family visual brief:
7e0e84693b91ca7292fb9f284adb3fa6a46882f1
```

---

## 11. Stitch visual authority

Canonical Stitch package:

Repository:

`Piyush1087/dummy_tcs`

Branch:

`docs/stitch-design-library`

Commit:

`355667b808457495c444d08b1d179d4f8a87d35b`

Accepted references:

```text
BP-ST-D01 / M01 — Fast Brand Analysis
BP-ST-D02 / M02 — Analysis Recovery
BP-ST-D03 / M03 — Brand Preview
```

All accepted PNG/HTML pairs were verified consistent.

Known caveat:

- M02 exported PNG is viewport-cropped;
- canonical HTML/native Stitch render is the stronger authority;
- do not use the cropped PNG alone to judge production fidelity.

Production integration does not require rerunning Stitch.

---

## 12. Final runtime acceptance evidence

Final accepted runtime candidates:

```text
Backend:  89d7dcc7e00c12b499850e2ff1c74364c4a83c19
Frontend: cbef201c571c6493c0a83ca4a6be12963faa959d
```

Validation environment:

```text
PostgreSQL 16.14
Node v24.19.0
npm 11.17.0
Prisma 6.19.3
controlled test-provider execution
verification OTP stubbed
```

Passed runtime scenarios:

- supported Gatekeeper handoff;
- `PREVIEW_READY / NORMAL` with real runtime response;
- `PREVIEW_READY / PARTIAL` exact 1/1/1 density;
- recoverable runtime failure + retry;
- `PREVIEW_NOT_READY` with bounded enrichment and no fabricated Preview;
- refresh/resume continuity;
- one-run-per-DiscoveryLead uniqueness;
- stable `brandProfileId` verification handoff;
- Gatekeeper regression;
- truthful analysis-phase mapping + generic fallback;
- public-field leakage check;
- desktop 1440;
- mobile 390x844;
- horizontal overflow;
- five semantic sections;
- verification CTA;
- accessibility smoke;
- M02 authority handling.

Test evidence:

### Backend

```text
focused Brand Preview: 33/33 PASS
Gatekeeper regression: 52/52 PASS
full suite: 177/177 PASS
Prisma validate: PASS
Prisma client generation: PASS
build: PASS
candidate-changed-file lint: PASS
```

A non-authoritative whole-repository lint still reports pre-existing formatting violations outside the candidate diff. Do not treat those unrelated baseline issues as Brand Preview regressions.

### Frontend

```text
focused adapter/Preview: 16/16 PASS
full suite: 219/219 PASS
typecheck: PASS
build: PASS
changed-file lint: PASS
```

Final runtime acceptance:

`PASS`

Frozen-authority deviations:

`NONE`

---

## 13. Recommended production reconciliation procedure

The production repositories may have advanced beyond the clone baselines. Do not assume a raw branch pointer move is safe.

Recommended order:

```text
1. Fetch/update actual production backend repository.
2. Record current production backend SHA.
3. Compare production backend with clone accepted range.
4. Reconcile Brand Preview backend changes while preserving newer unrelated production work.
5. Run backend tests/build/Prisma validation.
6. Fetch/update actual production frontend repository.
7. Record current production frontend SHA.
8. Compare production frontend with clone accepted range.
9. Reconcile Brand Preview frontend changes while preserving newer unrelated production work.
10. Run frontend tests/typecheck/build.
11. Review production environment variables/secrets.
12. Take/verify an appropriate production DB backup/snapshot per normal deployment policy.
13. Apply database migration before starting code paths that require `BrandPreviewRun`.
14. Deploy backend.
15. Backend health + Brand Preview API smoke.
16. Deploy frontend.
17. Run live end-to-end Brand onboarding smoke.
```

If production repository differences create a semantic conflict, escalate rather than solving by changing the accepted Product/IE/DE/FE contract.

---

## 14. Deployment / migration ordering

Minimum safe ordering:

```text
production DB backup/checkpoint
→ database migration
→ backend deploy
→ backend health/API smoke
→ frontend deploy
→ end-to-end onboarding smoke
```

The migration should be applied before the deployed backend begins executing the Brand Preview runtime against that database.

Do not run the migration against an unintended AWS/RDS database. Verify target environment and `DATABASE_URL` before `prisma migrate deploy`.

---

## 15. Production smoke checklist

After deployment, verify with controlled QA brands/sites:

- Gatekeeper still admits a supported Brand;
- supported Industry confirmation starts Brand Preview;
- Fast Brand Analysis appears;
- analysis progresses without legacy Surface/Brand-DNA review screens;
- a normal Preview can render;
- a partial Preview can render without filler;
- refresh/re-entry resumes the same run;
- retry works for a recoverable test case if safely reproducible;
- verification CTA uses the stable BrandProfile;
- verification-start request succeeds;
- unsupported Industry does not start Brand Preview;
- no provider/model/confidence/raw-Evidence data appears in the browser/network public payload;
- desktop and mobile layout remain usable.

Do not intentionally induce destructive provider/database failure in production merely to reproduce every QA failure path. Use non-production evidence for those already accepted cases.

---

## 16. Rollback considerations

Before deployment, follow the existing production rollback process for both services.

Important points:

- record pre-deploy frontend/backend production SHAs;
- retain the database backup/checkpoint made before migration;
- do not casually roll back the database schema while code/data may already have written `BrandPreviewRun` rows;
- if application rollback is required after migration, assess schema compatibility before reverting DB state;
- preserve existing Gatekeeper and Brand verification data.

A migration rollback should be treated as a database operation requiring explicit review, not as an automatic consequence of reverting application code.

---

## 17. Legacy paths that must not regain authority

The following may remain in the repository for compatibility/reference, but they are not the canonical post-Gatekeeper Brand Preview journey:

```text
McpPlannerService
Stage1bCoordinatorService
BrandDnaEngineService
BrandDnaSnapshotSchema
SurfaceScanProgressStore
legacy Surface progression
legacy Brand DNA onboarding review
```

Do not route new admitted/confirmed Brand Preview users back through those paths unless a separately approved compatibility rule explicitly requires it.

---

## 18. Developer completion return

After production reconciliation/deployment, return a short deployment record containing:

```text
BRAND_PREVIEW_PRODUCTION_DEPLOYMENT_RESULT

backend:
  production_repository:
  pre_merge_sha:
  final_sha:
  reconciliation_method:
  tests/build:

frontend:
  production_repository:
  pre_merge_sha:
  final_sha:
  reconciliation_method:
  tests/build:

database:
  target_environment:
  backup/checkpoint:
  migration_20260822120000_brand_preview_runtime:

environment:
  required_secret_names_present:
  provider_connectivity:

deployment:
  backend:
  frontend:

smoke:
  gatekeeper_supported:
  brand_preview:
  verification_start:
  mobile:

issues_or_deviations:
  - ...

status:
  PASS | FAIL
```

Do not include secret values in this record.

---

## 19. AI-worker stop boundary

For Brand Preview, AI implementation work is complete at:

```text
frontend clone development
= cbef201c571c6493c0a83ca4a6be12963faa959d

backend clone development
= 89d7dcc7e00c12b499850e2ff1c74364c4a83c19

final runtime acceptance
= PASS
```

From this point, production repository reconciliation, AWS/RDS configuration, migration execution, deployment and production smoke testing are developer-owned.

**Do not ask an AI worker to merge or deploy to actual production unless Product explicitly changes this boundary.**
