# Product Intelligence V1 — P1A Canonical State and Runtime Design

**Status:** CHECKPOINT_READY_FOR_SYSTEMS_REVIEW  
**Authority:** PRODUCT / P1A_ONLY  
**Implementation authorized:** NO  
**Migration authorized or executed:** NO

## 1. Authority pins

| Authority | Verified ref |
|---|---|
| Product Authority | `Piyush1087/dummy_tcs` `main@811d63a4f81255d9082f765b7569c8b60fcae28e` |
| Accepted Product Intelligence contracts | `Piyush1087/dummy_tcs` `agent/product-intelligence-v1-contracts@3fc2b421826c75e98c834d0b8ea8467ff8eb7b63` |
| Backend canonical base | `development@e066265d720b8f76516acb5063b9843faac5a85e` |
| Backend execution branch start | `phase-g/product-intelligence-v1@98eec930ca2f03dd1347f3ee79890083642f2278` |

The accepted topology remains three Offering-scoped Objects, three processors, and the ten PD-07 output families. This design does not revise P0.

## 2. P0 accepted checkpoint

The accepted previous Product Intelligence execution checkpoint is `98eec930ca2f03dd1347f3ee79890083642f2278`. P1A starts from that exact commit. The execution ledger records it as `previous_accepted_checkpoint_sha` and as the pending P1A checkpoint parent; it does not self-record this phase's commit.

## 3. Actual backend baseline

The audit covered `prisma/schema.prisma`, the current Offering, onboarding, Brand Centre, Campaign, Intelligence execution/persistence/projection code, and all migrations that introduced Offering, canonical Campaign assets, canonical Location/visual state, Intelligence W1, and DE W1/W2. Migration count is 49.

Material baseline files include:

- `src/features/brand-centre/services/brand-centre-dna.service.ts` and `dto/brand-centre-dna.dto.ts`;
- `src/features/brand-centre/utils/apply-prompt1-inventory.util.ts` and `workers/deep-scan.worker.ts`;
- `src/features/brand-onboarding/brand-offerings.service.ts`, `brand-profile.service.ts`, and `surface-scan/http-brand-surface-scan.runner.ts`;
- `src/features/brand-uce/services/brand-uce-campaign-asset.service.ts`, `campaign-query.service.ts`, and `brand-uce-product.service.ts`;
- `src/features/brand-intelligence/execution/**`, `persistence/**`, `projection/**`, `transitions/**`, and `semantic-path/component-path.types.ts`;
- migrations `20260514180100_brand_profiles_and_lifecycle`, `20260527140000_brand_centre_tab1_tab3`, `20260815000100_add_canonical_campaign_assets`, `20260825120000_brand_intelligence_w1_0a_persistence`, `20260825181500_add_data_extraction_wave1_evidence_persistence`, `20260826140000_brand_centre_canonical_state`, and `20260826180000_data_extraction_wave2_supported_capabilities`.

The canonical Location/visual migration supplies the pattern to reuse: durable same-Brand IDs, composite keys, explicit authority/origin/provenance/revision, a separate current selection pointer, conservative legacy metadata, and guards against displacing approved state. It does not itself provide Offering semantics.

## 4. Current Offering schema audit

`Offering` currently has `id`, `brandProfileId`, legacy `OfferingType`, name/description/image/URL/category fields, a partial price shape, `locationIds`, three booleans, two text arrays, timestamps, and Campaign asset references. It lacks a `(brandProfileId, id)` unique key and therefore cannot be the target of same-Brand composite foreign keys.

`OfferingType` is `PRODUCT | MODULE | TREATMENT | EXPERIENCE | SERVICE | COLLECTION`; it mixes canonical kind and industry subtype. Runtime primary/collection grouping, public Brand projection, onboarding sync, and Campaign selection read it directly.

Runtime behavior is materially legacy:

- Brand Centre lists only `isActive=true`; deletion/deactivation sets `isActive=false`.
- onboarding synchronization deactivates omitted rows and sets the row-wide `isUserEdited=true`;
- surface scan updates a URL match only when `isUserEdited=false`, parses `startingPriceLabel` into `priceAmount`, and does not establish authoritative price semantics;
- deep scan URL-matches rows, overwrites several fields, sets `isDeepScanned=true`, and can create `BrandOffer` records;
- image upload writes `imageUrl` and the row-wide edit flag;
- `UceCampaignAsset` selects an active Offering by exact same-Brand application query but has only an ID foreign key at database level;
- legacy `UceCampaignProduct` is Campaign-owned snapshot/payload state and is not a canonical Offering.

## 5. Canonical Offering delta

The smallest truthful reconciliation is additive. Legacy fields remain until compatibility readers/writers have moved.

| Proposed element | Classification | Exact representation and rationale |
|---|---|---|
| same-Brand key | ADDITIVE_RELATION_REQUIRED | Add `Offering @@unique([brandProfileId,id])` as the supporting constraint required by every exact same-Brand relation. |
| `OfferingKind` | ADDITIVE_COLUMN_REQUIRED + BACKFILL_REQUIRED | New enum `PRODUCT, SERVICE, EXPERIENCE, BUNDLE`; nullable `canonicalKind` during reconciliation, required for new canonical writes. Do not repurpose `OfferingType`. |
| industry-aware subtype | ADDITIVE_COLUMN_REQUIRED + BACKFILL_REQUIRED | Nullable bounded string `canonicalSubtype`; vocabulary is validated by Brand industry routing, not a global enum. |
| lifecycle | ADDITIVE_COLUMN_REQUIRED + BACKFILL_REQUIRED | New enum `DRAFT_INCOMPLETE, ACTIVE, PAUSED_INACTIVE`; nullable `canonicalLifecycle` only for unresolved legacy rows, required on new canonical writes. Null is migration state, not a fourth Product lifecycle. |
| scalar authority | ADDITIVE_MODEL_REQUIRED | `OfferingFieldState` keyed by Brand + Offering + semantic field path, with authority, origin, provenance, revision, protection state. One row per material scalar field, not one authority column per field. |
| selling/do-not-say items | ADDITIVE_MODEL_REQUIRED + COMPATIBILITY_PROJECTION_REQUIRED | `OfferingGuidanceItem` with durable item ID, kind, text, order, lifecycle and the shared authority metadata. Legacy arrays become projections. |
| price | ADDITIVE_MODEL_REQUIRED + COMPATIBILITY_PROJECTION_REQUIRED | Append-only `OfferingPriceRevision` plus one `OfferingPriceState` current pointer; details in section 9. |
| media | ADDITIVE_MODEL_REQUIRED + COMPATIBILITY_PROJECTION_REQUIRED | `OfferingMediaState` and `OfferingMediaAsset`; details in section 10. |
| BUNDLE/Product | ADDITIVE_RELATION_REQUIRED | Explicit `OfferingBundleMember`; details in section 11. |
| availability at Location | ADDITIVE_RELATION_REQUIRED | Explicit `OfferingLocationAvailability`; details in section 12. |
| Offer applicability | REUSE_CURRENT_SCHEMA + ADDITIVE_RELATION_REQUIRED | Keep `BrandOffer`; add exact same-Brand M:N applicability relation. The section 13 decision is `REUSE_WITH_ADDITIVE_EXTENSION`. |
| variants/SKUs, nested bundles, DAM/video, catalogue graph | DEFERRED_FROM_V1 | Product Authority explicitly excludes these. |
| Product Intelligence processors and P2 price DE capability | DEFERRED_FROM_FIRST_VERTICAL_SLICE | This phase prepares state/runtime only and does not authorize either implementation. |

## 6. Legacy compatibility table

| Legacy field | Current runtime meaning | Canonical meaning | Deterministic / ambiguous | Read compatibility | Write compatibility | Backfill | Retirement |
|---|---|---|---|---|---|---|---|
| `id` | durable row/Campaign reference | canonical Offering ID | deterministic | retain | immutable | none | retain |
| `brandProfileId` | tenant ownership | canonical Brand ownership | deterministic | retain | immutable | add composite unique | retain |
| `type` / `OfferingType` | mixed primary/collection and vertical label | kind plus subtype | partly deterministic; `MODULE` ambiguous | project from canonical values when available, otherwise legacy | dual-write only for reversible mappings | PRODUCT/SERVICE/EXPERIENCE/COLLECTION safe; TREATMENT -> SERVICE + subtype TREATMENT; MODULE unresolved | compatibility only after all consumers move |
| `isActive` | visibility/selectability boolean | not enough to distinguish three lifecycle states | true maps ACTIVE; false ambiguous | canonical lifecycle first; unresolved false remains hidden | canonical lifecycle drives mirror (`ACTIVE=true`, other canonical states=false) | true only | compatibility projection; no direct authority |
| `isUserEdited` | whole-row scan overwrite guard | not field/item authority | ambiguous | never infer authority | canonical edit writes exact field/item metadata; mirror true while legacy writers exist | none | retire after writer migration |
| `imageUrl` | one display/upload image | primary media projection only | URL is preservable; approval/selection history is not | canonical primary URL first, fallback legacy | canonical primary mirrors to it; legacy write creates only legacy-unverified media candidate | preserve as legacy-unverified asset; may select as compatibility primary without claiming approval | keep until Campaign/public/onboarding readers move |
| `locationIds` | opaque retained string array; no canonical relation enforcement | exact `OFFERING_AVAILABLE_AT_LOCATION` edges | ambiguous | do not expose as canonical availability | canonical edge writer may mirror exact IDs; legacy array writes cannot create edges | none | compatibility only |
| `priceAmount` | parsed/entered decimal without price mode | member of a canonical commercial tuple | ambiguous mode/source/freshness | canonical price first, fallback legacy-labelled value only | canonical current mirror only when semantics are lossless | none automatically | compatibility only |
| `startingPriceLabel` | human/list-view label | presentation derived from canonical mode/tuple | ambiguous and unstructured | preserve legacy fallback | derive from canonical price where possible | none | compatibility only |
| `currency` | row currency, sometimes defaulted independently | inseparable price tuple currency | value is preservable, tuple authority is ambiguous | use with legacy price only as legacy tuple | canonical price writer mirrors atomically with amount/label | no canonical price backfill solely from this | compatibility only |
| `sellingPoints` | mutable text array | protected, item-level canonical guidance | values preservable; authority/item identity absent | project canonical ordered items, fallback array | canonical item transaction mirrors array | create legacy-unverified items with new durable IDs | retire array after consumers move |
| `doNotSay` | mutable text array | protected, item-level Brand guidance | values preservable; authority/item identity absent | same as selling points | same as selling points | legacy-unverified items | retire array after consumers move |
| `categoryTag` | observed collection/specialty label | possible subtype/classification input, not automatically subtype | ambiguous | legacy display only | no automatic canonical subtype write | none | compatibility or later retire |
| `url` | required same-domain customer page | canonical customer destination | value deterministic; authority not known | canonical field value remains this column with metadata | exact field-state update in same transaction | metadata `LEGACY_UNVERIFIED` | retain as canonical value column |
| `description` | editable/scan-written description | canonical Offering description | value deterministic; authority not known | retain with field metadata | exact metadata update | metadata `LEGACY_UNVERIFIED` | retain |
| `name` | required row/display name | canonical Offering name | value deterministic; authority not known | retain with field metadata | exact metadata update | metadata `LEGACY_UNVERIFIED` | retain |
| `isDeepScanned` | deep-scan process marker | not canonical Product truth | deterministic only as process history | keep operationally | existing process may maintain it until retired | none | retire outside first slice |
| `createdAt`, `updatedAt` | row audit timestamps | row audit, not field revision | deterministic | retain | retain | none | retain |

## 7. Lifecycle backfill plan

Existing state cannot distinguish `DRAFT_INCOMPLETE` from `PAUSED_INACTIVE` when `isActive=false`. Inventing either would alter historical meaning.

The safe two-step plan is:

1. Add nullable `canonicalLifecycle` with no default for existing rows.
2. Backfill `ACTIVE` only where `isActive=true`, because the current runtime exposes those rows for active use and Campaign selection.
3. Leave `isActive=false` rows null and unavailable. Resolve them by an authorized Brand/application review to either `DRAFT_INCOMPLETE` or `PAUSED_INACTIVE`.
4. Require one of the three states for every new canonical write and reject Campaign selection unless the resolved state is `ACTIVE`.
5. After the unresolved count reaches zero and compatibility consumers are migrated, make the column non-null in a later gated migration.

Null is an internal unresolved migration condition and must not be emitted as a Product lifecycle state. This avoids an architecture conflict and does not create a fourth lifecycle.

## 8. Field/item authority plan

Reuse the canonical visual/Location structural pattern, not Intelligence current-state storage and not per-field columns.

`OfferingFieldState` should contain `id`, `brandProfileId`, `offeringId`, `semanticFieldPath`, `authority`, `origin`, optional `provenance`, positive `revision`, and `protectionState`. Its unique address is `(brandProfileId, offeringId, semanticFieldPath)`, with composite FK to Offering. Paths cover at least name, description, URL, kind, subtype, and other scalar Brand-confirmed truth.

Collection items and relationship rows own the same metadata quartet directly because they already have stable IDs: `authority`, `origin`, `provenance`, `revision`, plus lifecycle/protection where applicable. `OfferingGuidanceItem` supplies stable IDs for selling-point and do-not-say items. Media, bundle membership, Location availability, and Offer applicability use their own row IDs/composite identities.

Authority vocabulary must distinguish `LEGACY_UNVERIFIED`, `OBSERVED`, `BRAND_CONFIRMED`, and `APPLICATION_CANONICAL`. Protection is derived for ordinary non-price truth: Brand-confirmed state cannot be silently overwritten; observed changes become proposed/candidate input. Price uses the controlled policy in section 9 and does not blindly inherit this rule.

## 9. Price canonical-state plan

Application state, not Product Intelligence or DE, owns price.

Add `OfferingPriceMode` (`EXACT`, `STARTING_AT`, `RANGE`, `NOT_PUBLICLY_LISTED`), `OfferingPriceState`, and immutable `OfferingPriceRevision`.

`OfferingPriceState` is one row per Offering, carries Brand + Offering composite identity, `currentRevisionId`, a positive state revision, and timestamps. `OfferingPriceRevision` carries mode, current minimum, optional current maximum, optional regular/reference minimum and maximum, ISO currency, authority, source class/reference, freshness (`CURRENT | STALE | UNKNOWN`), observation/evaluation timestamps, provenance, predecessor revision, and creation metadata.

Database checks enforce shape:

- EXACT: current minimum present, maximum absent or equal;
- STARTING_AT: minimum present, maximum absent;
- RANGE: minimum and maximum present and minimum <= maximum;
- NOT_PUBLICLY_LISTED: current amounts absent;
- reference range is internally complete and ordered when present;
- currency is stored in the same immutable revision as all amounts.

Controlled refresh creates a revision and advances the current pointer with compare-and-swap. A conflicting or ambiguous observation does not advance it. If public price disappears without authoritative `NOT_PUBLICLY_LISTED` evidence, retain the current monetary revision and mark state freshness stale/unknown through an auditable revision; never write zero/null. Brand edit and reliable same-Offering first-party refresh are separate origin/authorization paths. Legacy price fields remain a read/write projection during migration. No Product Intelligence write path is permitted.

## 10. Media plan

Use `OfferingMediaState` plus `OfferingMediaAsset`, mirroring the accepted `BrandVisualState` / `BrandVisualAsset` design.

`OfferingMediaState` is one per Offering and owns nullable `primaryMediaAssetId` and revision. `OfferingMediaAsset` stores an image URL, optional label/alt text, lifecycle, presentation order, authority/origin/provenance/revision, and same-Brand Offering identity. Composite FKs and guards require the primary pointer to reference an active image from the same Offering; an asset must be deselected before deactivation.

P1B should set the application cap to one primary plus at most six additional active gallery images. The exact cap is implementation policy, not Product Authority, and may be changed later without changing Product meaning. No video, transformations, folders, or DAM workflow is included.

`imageUrl` remains a one-way compatibility projection of the canonical primary. Existing URLs may be imported as `LEGACY_UNVERIFIED`; that preserves the display value but does not infer Brand approval.

## 11. Collection/Product relation plan

Add explicit `OfferingBundleMember` with `brandProfileId`, `bundleOfferingId`, `productOfferingId`, optional presentation order, lifecycle, authority/origin/provenance/revision, and timestamps.

Use composite FKs from both Offering IDs to `(brandProfileId,id)`, unique `(brandProfileId,bundleOfferingId,productOfferingId)`, and a not-self check. Database/application guards require the parent canonical kind `BUNDLE` and child kind `PRODUCT`. A BUNDLE cannot be a child, so nested hierarchy is impossible in V1. Relationship lifecycle is independent; neither member's Offering lifecycle is changed by adding/removing an edge.

No existing canonical relationship mechanism represents this truth; an explicit join is the smallest enforceable model.

## 12. Offering/Location relation plan

Add `OfferingLocationAvailability` with `brandProfileId`, `offeringId`, `locationId`, lifecycle, authority/origin/provenance/revision, and timestamps. Composite FKs target exact `(brandProfileId,id)` keys on both Offering and Location. Unique identity is `(brandProfileId,offeringId,locationId)`.

The only meaning is `OFFERING_AVAILABLE_AT_LOCATION`: the customer can obtain, receive, or use this Offering at that exact canonical business Location. It does not encode warehouse/delivery origin, service radius, marketing geography, or Brand serviceability.

Legacy `locationIds` is not backfilled because its historic semantics and referential quality are not proven. Canonical reads use relation rows only. A canonical writer may mirror exact active relation IDs to the array for legacy readers, but a legacy array mutation cannot create canonical edges. No fuzzy Location match is allowed.

## 13. Offer/Discount model decision

Decision: **REUSE_WITH_ADDITIVE_EXTENSION**.

`BrandOffer` is already a separate Brand-owned commercial entity and `UceCampaignAsset.kind=OFFER` references it separately, so a new canonical commercial root is unnecessary. Its free-text `applicabilityScope` cannot establish exact one-or-more Offering/BUNDLE applicability.

Add `BrandOfferOffering` with Brand, Offer, and Offering IDs, composite same-Brand FKs, unique membership, and authority/provenance/revision. Add `(brandProfileId,id)` unique to `BrandOffer`. Preserve `applicabilityScope` as compatibility/display text. Enforce at least one active applicability edge in the canonical application service before an Offer is considered canonical/selectable; do not rewrite Campaign Asset OFFER.

Promo-code optionality and richer discount arithmetic are outside the first vertical slice unless a later Product requirement demands them.

## 14. Generic Intelligence subject-scope design

Current W1 scope is Brand-only: `CreateIntelligenceExecutionCommand`, trigger idempotency, `processorLogicalKey`, latest processor lookup, semantic address, current projection, and all current/CAS queries omit an Offering instance.

Recommended representation: a normalized `IntelligenceSubject` registry plus `subjectId` on subject-root and address-bearing Intelligence rows.

`IntelligenceSubject` contains `id`, `brandId`, `subjectType` (bounded string), `subjectRef`, nullable typed `offeringId`, and timestamps. It has unique `(brandId,subjectType,subjectRef)` and `(id,brandId)`. Initial database checks admit only:

- `BRAND`: `subjectRef=brandId`, `offeringId IS NULL`;
- `OFFERING`: `subjectRef=offeringId`, `offeringId IS NOT NULL`, with composite FK `(brandId,offeringId)` to Offering.

`CREATOR` and `CAMPAIGN` are reserved registry concepts but must fail closed until a later migration adds their typed binding and check branch. This keeps execution generic without accepting dangling polymorphic references. Offering resolution occurs before execution creation in the same transaction.

Existing W1 rows receive one BRAND subject per Brand. The runtime command takes `{type,ref}`; the resolver returns the durable subject row. `processorLogicalKey` becomes versioned: existing rows remain v1; new rows use v2 material that includes Brand, subject type/ref, processor/bundle, scope, manifests, and intent. This avoids rewriting historical hashes while preventing sibling-Offering collisions.

## 15. Execution/generation scope propagation

| Model/query | Classification | Recommendation |
|---|---|---|
| `IntelligenceSubject` | MIGRATION_REQUIRED | new normalized, same-Brand typed subject registry |
| `IntelligenceExecution` | ADDITIVE_SCOPE_FIELD + ADDITIVE_INDEX_OR_UNIQUE_CHANGE | required `subjectId`; trigger unique becomes Brand + subject + idempotency key; add subject timeline index |
| `IntelligenceProcessorExecution` | ADDITIVE_SCOPE_FIELD + ADDITIVE_INDEX_OR_UNIQUE_CHANGE | copy `subjectId` from execution for composite FK, queue lineage and latest-by-subject index; add key-version field |
| `IntelligenceProcessorAttempt` | UNCHANGED | exact subject derives through required processor execution; claim/lease/retry remain globally row-ID based |
| `IntelligenceAction` | ADDITIVE_SCOPE_FIELD + ADDITIVE_INDEX_OR_UNIQUE_CHANGE | actions are an alternate generation root; request idempotency becomes Brand + subject + action type + key |
| `IntelligenceObjectGeneration` | ADDITIVE_SCOPE_FIELD + ADDITIVE_INDEX_OR_UNIQUE_CHANGE | immutable subject lineage; include subject in history, basis/supersession and producer composite constraints |
| `IntelligenceComponentGeneration` | ADDITIVE_SCOPE_FIELD + ADDITIVE_INDEX_OR_UNIQUE_CHANGE | include subject in generation address and supersession composite relations |
| `IntelligenceCurrentComponent` | ADDITIVE_SCOPE_FIELD + ADDITIVE_INDEX_OR_UNIQUE_CHANGE | subject is part of the only mutable current address |
| `IntelligenceComponentCandidate` | ADDITIVE_SCOPE_FIELD + ADDITIVE_INDEX_OR_UNIQUE_CHANGE | include subject in full address and all current/generation/action/producer composite relations |
| `IntelligenceComponentTransition` | ADDITIVE_SCOPE_FIELD + ADDITIVE_INDEX_OR_UNIQUE_CHANGE | include subject in audited address and action-path uniqueness |
| `IntelligenceEvidenceReference` | UNCHANGED | subject derives through object generation; evidence manifest remains on processor execution |
| `IntelligenceBusinessStateReference` | BUSINESS_STATE_REF_REUSE | unchanged table; use `entityType=OFFERING`, exact Offering ID and revision token for canonical lineage |
| claim/lease/heartbeat/retry | UNCHANGED | work is claimed by processor-execution ID; subject is validated at creation/persistence, not used for global queue fairness |
| execution creation/replay/hash | QUERY_FILTER_EXTENSION | resolve subject, filter replay by subject, validate every active address subject, use key v2 |
| current/CAS/candidate/projection/latest queries | QUERY_FILTER_EXTENSION | require and filter exact subject ID; never infer it from object/path |

Duplication is limited to rows that are roots or participate in composite semantic-address integrity. Attempts and reference-only lineage remain derived.

## 16. Current/candidate uniqueness analysis

Collision is proven in the current schema. `IntelligenceCurrentComponent` is unique only on `(brandId, objectSemanticId, pathSchemeVersion, componentSemanticPath)`. Offering A and Offering B therefore address the same row for `offering_factual_profile.factual_summary`. `IntelligenceCurrentStateRepository.getCurrent`, raw lock SQL, transition address comparison, projection repository reads, and contract-scope reads use the same incomplete address.

Candidate identity propagates the collision because `IntelligenceComponentCandidate` references the current component's Brand/object/path address. Object/component history and transition indexes are also Brand/object/path oriented, and `ProcessorRuntimeProjectionService` selects latest by `{brandId,processorId}`.

Exact changes:

- current unique/full-address keys become `(brandId,subjectId,objectSemanticId,pathSchemeVersion,componentSemanticPath)` and `(id,brandId,subjectId,...)`;
- component-generation and object-generation full/basis/supersession composite keys add `subjectId`;
- candidate full-address relations add `subjectId`;
- transition action-path unique becomes `(actionId,subjectId,objectSemanticId,componentSemanticPath)`;
- history/current/path indexes add subject between Brand and semantic object/path;
- processor latest index becomes `(brandId,subjectId,processorId,processorVersion,createdAt)`;
- execution trigger unique and action request unique add subject.

The existing processor-per-execution unique may remain `(executionId,processorId,activeScopeHash)` because one execution has exactly one subject. Processor output unique `(processorExecutionId,objectSemanticId)` also remains safe. Global processor execution key remains unique but v2 includes subject.

## 17. Runtime projection implications

Do not redesign the Brand Centre Brand endpoint. Generalize the detailed pattern behind it.

Introduce a generic projection request `{brandId, subject:{type,ref}, objectSemanticId}` and return subject identity in Object/component projections. `ComponentSemanticAddress`, canonical lock ordering/key generation, transition commands, current repository SQL, projection snapshot queries, snapshot assertions, and candidate summaries all include resolved `subjectId`.

Later Product runtime composition reads one exact Offering subject and independently queries:

- `offering_factual_synthesis` / `offering_factual_profile`;
- `offering_creator_communication` / `offering_creator_communication_profile`;
- `offering_actionability_synthesis` / `offering_actionability_profile`.

Its latest execution query filters `{brandId,subjectId,processorId}`. `hasCurrent` is computed from current rows for the same subject. Readiness, freshness, and processor activity remain distinct. A failed Offering X refresh preserves X's prior current state and cannot select, stale, or candidate Offering Y.

The bundle ownership/contract registry remains semantic-object scoped and unchanged; subject validation wraps execution/projection and does not alter contract ownership.

## 18. Campaign compatibility result

Classification: **NO_IMMEDIATE_CAMPAIGN_CHANGE** plus **COMPATIBILITY_READ_PROJECTION** and **COMPATIBILITY_WRITE_ADAPTER** in P1B application work. `CAMPAIGN_SCHEMA_CHANGE_REQUIRED: NO`.

`UceCampaignAsset` already references exact Offering or `BrandOffer`; selection services verify same Brand and active status. During reconciliation they should read canonical lifecycle when resolved, fall back conservatively to legacy `isActive` only for unresolved rows, display canonical primary media/kind through compatibility projections, and write no canonical Offering state.

Collection Asset behavior maps legacy `COLLECTION` to canonical `BUNDLE` in the adapter. Campaign OFFER remains separate and unchanged. Legacy Add Product / `UceCampaignProduct`, Briefs, active collaborations, and historical payload/snapshot records remain Campaign-owned snapshots and must not be rewritten to current Offering state. Adding same-Brand composite keys to Offering/Offer does not require changing existing Campaign FKs in the first slice.

## 19. Migration decomposition

Option A, one consolidated migration, couples catalogue backfill risk to shared Intelligence runtime constraints and has a large rollback surface. Option C, more than two fragments, creates partially usable intermediate states and unnecessary deployment ordering.

Recommendation: **OPTION B — two additive migrations**.

### Migration 1: canonical Offering state foundation

- Purpose: add canonical kind/subtype/lifecycle, authority/item state, price, media, bundle, Location, and Offer applicability.
- Affected: Offering, BrandOffer, Location relations; new enums/tables described above; composite same-Brand unique keys.
- Backfill: safe kind mappings; TREATMENT as SERVICE subtype; MODULE unresolved; ACTIVE only from true; false lifecycle unresolved; scalar/guidance/media values imported as LEGACY_UNVERIFIED; no price or Location relationship inference.
- Constraints/indexes: same-Brand composite FKs, positive revisions, price shape checks, primary-media guard, bundle kind/no-nesting guards, exact relation unique keys.
- Compatibility: dual-read/dual-write adapters and legacy projections; legacy columns retained.
- Rollback: schema is removable before canonical-only writes; after such writes, app rollback must precede schema removal and new state must be exported/preserved.
- Risk: MEDIUM, dominated by ambiguous legacy rows and dual-write correctness.
- Gates: schema/migration checks, mapping fixtures, same-Brand negative tests, lifecycle unresolved tests, price invariants, authority protection, media/bundle/Location/Offer relation tests, Campaign regression.

### Migration 2: generic Intelligence subject scope

- Purpose: introduce typed subject registry and make durable execution/current/candidate identity subject-safe.
- Affected: IntelligenceSubject plus Execution, ProcessorExecution, Action, ObjectGeneration, ComponentGeneration, CurrentComponent, Candidate, Transition; attempts and reference tables unchanged.
- Backfill: one BRAND subject per existing Brand; attach every existing W1 row consistently; preserve v1 processor keys; validate zero orphan/cross-subject lineage before non-null constraints.
- Constraints/indexes: subject-aware trigger/action/current/address/supersession/history/latest keys and composite FKs; v2 key version.
- Compatibility: existing Brand calls resolve the BRAND subject transparently; Offering engines remain disabled until later authorization.
- Rollback: safe before any non-BRAND execution; after Offering executions exist, schema rollback would discard valid history and is not allowed without archival/export.
- Risk: MEDIUM-HIGH because it changes shared persistence identity and CAS queries, though not claim/lease semantics.
- Gates: backfill cardinality and lineage audit, Brand regression, two-sibling Offering isolation, idempotency/replay/hash-version tests, concurrent CAS/candidate tests, failure-preserves-current tests, projection/runtime tests.

P2 DE capability work is not part of either migration.

## 20. Destructive-migration verdict

`DESTRUCTIVE_MIGRATION_REQUIRED: NO`.

No legacy column is dropped, no valid row is deleted, no historical Campaign/Intelligence record is rewritten semantically, and ambiguous false lifecycle, MODULE, price, or Location data is not force-mapped. Replacing Brand-only unique constraints with subject-aware supersets broadens identity while preserving existing BRAND identities; it is not destructive when ordered after backfill and validation.

## 21. Test plan

Mandatory P1B gates:

1. Prisma format/validate and migration SQL review; migration count and generated-client checks.
2. Existing-row mapping matrix for every `OfferingType`; MODULE and inactive rows remain unresolved.
3. New writes require canonical kind/lifecycle; unresolved rows fail closed for new Campaign selection.
4. Brand-confirmed non-price field/item cannot be overwritten by scan/observed input; price uses its separate controlled policy.
5. Price mode/amount/currency checks, stale-value retention, conflict non-advance, revision/CAS history.
6. Media same-Brand/same-Offering primary guard, one-primary rule, cap, deactivation guard, imageUrl projection.
7. Bundle parent/child kind, same Brand, no self/nesting, M:N behavior, independent lifecycle.
8. Location exact composite ownership and no legacy-array/fuzzy backfill.
9. Offer exact one-or-more applicability and Campaign OFFER regression.
10. Subject resolver rejects cross-Brand Offering and unsupported subject types.
11. Existing BRAND execution replay and processor-key v1 compatibility.
12. New v2 processor keys differ for sibling Offerings with identical processor/scope/manifests/intent.
13. Offering A and B can hold identical semantic paths with independent current, candidate, transition, freshness, and history.
14. Refresh/failure/retry/cancellation for one Offering cannot affect its sibling.
15. Claim/lease/heartbeat/reclaim and aggregate execution regression.
16. Object/current projection and Product processorRuntime latest query require exact subject.
17. Evidence/business references remain attached to the correct subject-derived generation.
18. Campaign selectable asset, Add Product, Add Brief, collaboration, public/marketplace, and historical snapshot regressions.
19. Architecture tests forbid direct legacy writers after their adapter is introduced and forbid Product Intelligence canonical-state mutation.

## 22. Open technical risks

- Legacy inactive rows and MODULE values need authorized data review; they are not Product decisions and do not block additive migration design.
- Dual-write drift is the main Offering migration risk; adapters need transactionally consistent mirrors and reconciliation metrics.
- Price disappearance and controlled refresh need explicit authorization/source rules before a writer is enabled; P2 evidence capability sufficiency remains intentionally open but does not block state storage.
- Subject-scope touches shared CAS and projection code. Missing one address filter would create cross-Offering corruption, so architecture and PostgreSQL isolation tests are mandatory.
- A normalized subject registry adds a join to latest/projection reads; the prescribed subject-aware indexes bound that cost.
- Database guards that inspect Offering kind or media selection may require SQL triggers beyond Prisma schema expressiveness; these must be reviewed in P1B, not authored here.

Product decisions required: **NONE**. Architecture conflicts: **NONE**. Provider/security conflicts: **NONE**. Cross-Brand subject references are a preserved tenancy boundary, not a new security model.

## 23. Exact proposed P1B implementation scope

P1B may implement only the two reviewed additive migrations and their minimal compatibility/runtime adapters after explicit Systems migration authorization:

1. canonical Offering enums/columns/models/relations/constraints and conservative backfill;
2. Offering canonical repositories/services needed for transactional authority, price, media, bundle, Location, and Offer state;
3. legacy read projections and write adapters for current Offering consumers, without frontend redesign;
4. normalized IntelligenceSubject, BRAND backfill, subject-aware keys/addresses/queries/CAS/projections, and Brand compatibility;
5. tests listed in section 21.

P1B must not implement Product processors, P2 DE capability changes, frontend work, Campaign schema redesign, SKU/variant hierarchy, nested bundles, DAM, or V2 catalogue features. Product Offering engines remain disabled until their later authorized phase.

**P1A stops at the Systems migration-design gate.**
