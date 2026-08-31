# Product Intelligence V1 P2B-1 — DE Exact Offering Scope

**Status:** READY_FOR_SYSTEMS_REVIEW

**Systems gate:** Mandatory. This branch stops after P2B-1 and does not advance Product Intelligence execution.

## Authority and checkpoint pins

| Authority                                      | Pin                                                       |
| ---------------------------------------------- | --------------------------------------------------------- |
| Product Authority, `Piyush1087/dummy_tcs/main` | `811d63a4f81255d9082f765b7569c8b60fcae28e`                |
| Frozen Product Intelligence contracts          | `bbb0be3345c36e9cc7c4f06ca68fb491b742b83f`                |
| Accepted Product backend parent                | `ce46eacdc33d8d48cee96d0682d0fa30d7842a0c`                |
| Canonical development base                     | `e066265d720b8f76516acb5063b9843faac5a85e`                |
| DE implementation branch                       | `phase-g/product-intelligence-v1-de-exact-offering-scope` |

The branch was created directly from the accepted Product backend parent. The target branch did not exist remotely when execution began.

## Scope model

The implementation keeps four scopes distinct:

- Brand scope remains `brandId` and is validated at every persistence boundary.
- Capability scope remains one of the existing nine durable capability IDs.
- Canonical Offering scope is an explicit application-supplied `canonicalOfferingRef`; DE validates and carries it but never creates, guesses, fuzzy-matches, or mutates it.
- Resource scope is the explicit bounded list of owned-site resource URLs, followed by the exact returned capture refs used during normalization.

No Product processor, canonical Offering state mutation, price/commercial capability, provider, capability ID, schema field, or migration was added.

## Resource reconciliation

Acquisition accepts this optional explicit selector:

```ts
exactOfferingScope: {
  canonicalOfferingRef: string;
  resourceUrls: readonly string[];
}
```

The selector is bounded to eight unique same-owned-site URLs. The Offering must exist under the request Brand. Unknown and other-Brand refs fail with the same non-disclosing persistence invariant. Only supplied URLs are materialized as exact reconciled resource views. Their stable resource key combines the canonical owned URL with the supplied canonical Offering ref, allowing a broad resource and an exact reconciled view of the same URL to coexist without rewriting historical resource classification.

Acquisition returns exact resource/capture pairs:

```ts
exactOfferingResources: readonly {
  canonicalOfferingRef: string;
  resourceRef: ResourceRef;
  captureRef: CaptureRef;
}[]
```

Normalization requires the caller to pass only that exact capture subset:

```ts
exactOfferingScope: {
  canonicalOfferingRef: string;
  captureRefs: readonly string[];
}
```

Normalization revalidates Offering ownership, execution membership, capture ownership, and `OFFERING_DETAIL` role before emitting any exact ref. A sibling or broad capture in the same execution is not stamped.

## Page-role behavior

`OFFERING_DETAIL` is now assigned only when an application reconciliation is supplied. URL shape alone still produces the pre-existing broad roles. This one bounded mechanism covers:

- D2C exact product pages;
- SaaS/AI exact product or plan pages;
- Healthcare exact treatment or service pages; and
- Offline exact service or experience pages.

Collection, category, portfolio, service-overview, solutions-overview, and pricing/plans surfaces remain broad without exact reconciliation. No catalogue crawler or provider path was added.

## Normalizer behavior

For `owned_website.offering_context`, an explicitly reconciled capture emits `generalization_scope: SINGLE_OFFERING` and the matching `canonical_offering_ref`. Broad observations retain `MULTIPLE_OFFERINGS` or Brand-level semantics and a null ref. Existing capture, Resource, CapabilityExecution, Evidence, freshness, content, and support/conflict lineage remains immutable.

For `explicit_factual_proof_or_claim_evidence`, an exact resource may carry the supplied ref in both `factual_referent_ref` and the one-item `offering_refs`. Proof strength, proof class, claim sensitivity, authorship, locator, verification status, and conflict behavior are unchanged. Acquired claims remain `NOT_EXTERNALLY_VERIFIED`; no acquired copy becomes `VERIFIED_BUSINESS_FACT`.

For `derived_communication_constraint_evidence`, only an `OFFERING_SPECIFIC` exact resource carries `canonical_offering_ref`. Brand-level constraints remain Brand-level and are not forced into each Offering. DE still produces no creator talking points.

The common exact-ref plumbing was also applied, without a separate architecture, to optional `owned_website.serviceability_evidence` and `owned_website.location_evidence`. Their exact items may carry `offering_ref`, but serviceability does not become canonical availability and Location Evidence does not become `OFFERING_AVAILABLE_AT_LOCATION`.

## Product Evidence reader

The existing Intelligence Evidence request has an optional explicit selector:

```ts
exactOfferingScope: {
  canonicalOfferingRef: string;
}
```

Brand Intelligence callers omit it and keep the existing latest-completed Brand/capability behavior. Scope is never inferred from processor ID.

When the selector is present, the query validates same-Brand Offering ownership and searches all completed executions for each requested Product-relevant capability. It does not select the latest Brand execution and then filter. Capability-specific admission requires the matching canonical ref, `OFFERING_DETAIL`, and exact scope semantics:

- offering context: `SINGLE_OFFERING` plus matching `canonical_offering_ref`;
- proof: `OFFERING_SPECIFIC`, matching `factual_referent_ref`, and exactly one matching `offering_refs` entry;
- constraints: `OFFERING_SPECIFIC` plus matching `canonical_offering_ref`;
- serviceability/location: `OFFERING_SPECIFIC` plus matching `offering_ref`.

Null refs, broad/multiple scope, unknown scope, mismatched refs, and sibling Offering items are excluded. If no item qualifies, the capability fails closed as not requested for exact Product use.

The read result preserves every qualifying immutable Evidence ref and attaches all qualifying `capabilityExecutionRefs` at capability and Evidence level. Freshness, acquisition quality, Resource/Capture refs, normalized content refs, parent refs, support, and conflict-group projection are preserved. DE does not select semantic truth across executions.

## First-slice fixture

`exact-offering-scope.postgres.test.ts` creates a real Brand X and canonical Offerings Y/Z, then runs:

1. exact Offering Y acquisition and normalization;
2. a forced recapture producing a second immutable Y Evidence item;
3. a newer exact sibling Z execution;
4. a newer broad execution; and
5. an exact Product read for Y.

The read receives only Y `owned_website.offering_context` Evidence with the canonical ref, non-empty observed context, two Evidence refs, both CapabilityExecution refs, current freshness, and complete Resource/Capture lineage. It receives neither Z nor broad Evidence. No real Product processor is registered or executed.

The same PostgreSQL fixture rejects a Brand A request carrying Brand B's Offering ref at acquisition, normalization, and read boundaries without provider acquisition for the rejected command.

## Files changed

- `src/features/data-extraction/evidence/ports/evidence-runtime.ports.ts`
- `src/features/data-extraction/evidence/ports/evidence-repositories.ts`
- `src/features/data-extraction/evidence/domain/evidence-records.ts`
- `src/features/data-extraction/evidence/persistence/prisma-evidence-repositories.ts`
- `src/features/data-extraction/evidence/acquisition/owned-website-wave1-acquisition.service.ts`
- `src/features/data-extraction/evidence/normalization/owned-website-wave1-normalizers.ts`
- `src/features/data-extraction/evidence/normalization/owned-website-wave1-normalization.service.ts`
- `src/features/data-extraction/evidence/normalization/wave2/wave2-evidence-contracts.ts`
- `src/features/data-extraction/evidence/normalization/wave2/proof-evidence.normalizer.ts`
- `src/features/data-extraction/evidence/normalization/wave2/serviceability-evidence.normalizer.ts`
- `src/features/data-extraction/evidence/normalization/wave2/location-evidence.normalizer.ts`
- `src/features/data-extraction/evidence/query/data-extraction-evidence-query.service.ts`
- `src/features/data-extraction/evidence/intelligence/data-extraction-intelligence-evidence.adapter.ts`
- `src/features/brand-intelligence/input/evidence/intelligence-evidence.port.ts`
- `src/features/data-extraction/evidence/exact-offering-scope.test.ts`
- `src/features/data-extraction/evidence/exact-offering-scope.postgres.test.ts`
- `docs/ai-collaboration/product-intelligence-v1-p2b1-de-exact-offering-scope.md`

## Verification

- Migration count: 51 before, 51 after; zero migrations created.
- Durable capability count: 9 before, 9 after; zero capability IDs added.
- Prisma schema: unchanged; `prisma generate` passed.
- Nest build: passed.
- Scoped lint: passed.
- DE unit/architecture regressions: 142 passed after the proof-specific exact-reader assertion was added.
- Serialized DE PostgreSQL regressions: 75 passed, one intentional skip. Two pre-existing Wave-2 tests required a command-level 20-second timeout on the disposable database; no implementation change was needed.
- Seven Brand Intelligence processor unit regressions: 185 passed.
- Seven Brand Intelligence processor PostgreSQL vertical slices: 108 passed.
- Brand Centre unit/architecture regressions: 14 passed; database-only files skipped in that pass.
- Brand Centre and canonical Offering PostgreSQL regressions: 23 passed, one intentional skip.
- First-slice exact Offering unit tests: 11 passed.
- First-slice exact Offering PostgreSQL fixture: 2 passed.
- Git diff check: recorded at final checkpoint.

One bounded correction was made: the new multi-execution PostgreSQL fixture timeout was raised from the repository default 5 seconds to 20 seconds after the unchanged scenario completed just beyond the default.

## Remaining gap and residual risks

Commercial/price Evidence remains a separate unimplemented gap. No commercial capability or migration 52 exists on this branch.

Exact identity correctness depends on the application supplying the right canonical Offering and exact resources; DE deliberately does not guess. The exact read currently scans completed capability executions and filters bounded JSON payloads in the application layer because no schema migration or JSON index was authorized. This is safe and bounded for V1 but may need a reviewed persistence optimization at larger history volumes. Brand-level constraint applicability to an individual Offering remains a later explicit Product/application decision; P2B-1 admits only exact `OFFERING_SPECIFIC` constraint Evidence.

## Gate

P2B-1 stops here for Systems Architect review. Product Intelligence processors, the Product execution ledger, P3, commercial Evidence, and canonical application state remain untouched.
