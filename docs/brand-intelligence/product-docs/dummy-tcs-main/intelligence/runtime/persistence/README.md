# Intelligence → PostgreSQL Persistence

Status: WORKING v0.1.

The persistence layer converts **validated Intelligence outputs** into writes against the application's canonical PostgreSQL Brand model. It does not create a second database copy of Identity values.

```text
LLM / deterministic processor
        ↓
authoritative validation
        ↓
validated Intelligence output
        ↓
Identity persistence mapping
        ↓
canonical BrandProfile fields
        ↓
PostgreSQL
```

## Files

- `identity_mapping.yaml` — object-by-object canonical backend mapping and required schema reconciliation/additions.
- `adapter.ts` — provider/ORM-neutral persistence adapter boundary.

## Critical rule

`IntelligenceObject` is a governance/production definition. It does **not** imply an `IntelligenceObjectValue` row when the application already has a canonical field for that value.

Example:

```text
instagram_handle
  Intelligence Object definition
          ↓
  BrandProfile.igHandle
```

The frontend continues reading the canonical Brand field.

## Safe migration approach

The frozen Identity Object registry contains several mappings marked `existing_field_to_verify`, `candidate_to_reconcile`, or `new_field_required`. We must not guess their actual deployed Prisma/PostgreSQL representation.

Therefore mappings have four states:

- `EXISTING` — identified existing field.
- `VERIFY` — likely existing but exact deployed field/type must be checked.
- `RECONCILE` — field exists but semantics/enum compatibility needs an explicit migration decision.
- `ADD` — new canonical field/structure required.

The adapter refuses canonical writes for unresolved mappings. This lets `identity_test` run safely with `persist_results=false` while extraction/runtime is being validated.

## New Identity structures proposed for MVP

Where absent from the deployed schema, Identity requires canonical storage for tagline, industry niche, business geography, markets served, primary language, website currency, Facebook handle and LinkedIn handle.

`businessGeography` and `marketsServed` are proposed as JSONB for MVP because their structures are genuinely richer than simple scalar fields and should not overload existing physical `Location` records. This can be normalized later if query/index requirements justify it.

## Transaction behavior

One validated processor output should write atomically to its canonical Brand entity. Parallel processors can persist independently after validation unless an Execution Profile explicitly requires a cross-processor atomic commit.

A database write failure becomes `FAILED_PERSISTENCE`; it must not be reported as processor success.

## Manual-value protection

Refresh executions receive the set of protected manually controlled Intelligence Objects. The persistence adapter skips those objects rather than allowing automated refresh to overwrite them. Onboarding/admin flows can use their own authorized lifecycle policy.

## Next implementation step

Before enabling `persist_results=true`, compare `identity_mapping.yaml` against the actual deployed backend Prisma/PostgreSQL schema and produce the minimal schema patch. That patch should preserve existing field names/enums wherever possible and add only the Identity storage that is genuinely missing.
