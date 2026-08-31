# Product Intelligence V1 P2A — Product-scoped Data Extraction capability sufficiency preflight

**Status:** CHECKPOINT_READY_FOR_SYSTEMS_REVIEW

**Execution scope:** P2A design/audit only; no runtime, schema, migration, authority, or contract implementation is included.

## 1. Authority and checkpoint pins

| Authority | Verified pin |
| --- | --- |
| Product Authority, `dummy_tcs/main` | `811d63a4f81255d9082f765b7569c8b60fcae28e` |
| Frozen Product Intelligence contracts, `dummy_tcs/agent/product-intelligence-v1-contracts` | `bbb0be3345c36e9cc7c4f06ca68fb491b742b83f` |
| Accepted backend P1B-2 / P2A parent | `ce17f9f8b7084fbd188f748b167e680747dad12e` |
| Canonical backend development base | `e066265d720b8f76516acb5063b9843faac5a85e` |

The starting migration count is 51. The frozen semantic basis is `intelligence/engines/product_intelligence/` and `intelligence/product_authority/product_intelligence_product_authority_register_v1.md`; implementation evidence is the backend at the accepted P1B-2 pin.

## 2. Current DE capability inventory

`src/features/data-extraction/evidence/domain/evidence-vocabulary.ts` and `src/features/brand-intelligence/input/evidence/intelligence-evidence.port.ts` expose exactly nine durable normalized capabilities:

1. `owned_website.brand_messaging`
2. `owned_website.brand_company_context`
3. `owned_website.offering_context`
4. `observed_brand_communication_language_signals`
5. `derived_communication_constraint_evidence`
6. `explicit_factual_proof_or_claim_evidence`
7. `owned_website.visual_evidence`
8. `owned_website.serviceability_evidence`
9. `owned_website.location_evidence`

The five direct Product-relevant IDs are `owned_website.offering_context`, `explicit_factual_proof_or_claim_evidence`, `derived_communication_constraint_evidence`, `owned_website.serviceability_evidence`, and `owned_website.location_evidence`. Brand messaging and company context are reusable indirect parents for Brand-level communication context; language and visual Evidence are not minimum Product V1 dependencies.

The durable platform is provider-neutral and retains distinct `Resource`, `Capture`, `ContentArtifact`, `CapabilityExecution`, `Evidence`, semantic-observation support/relation, freshness-assessment, and provider-execution-link records in `prisma/schema.prisma`. `prisma/migrations/20260826180000_data_extraction_wave2_supported_capabilities/migration.sql` enforces the nine-ID closed list across seven tables.

## 3. Current Offering Evidence implementation audit

The frozen `data-extraction/contracts/owned_website_offering_context_v1.yaml` permits an existing application reconciliation to supply `canonical_offering_ref`; it does not let DE create canonical identity. The current `OfferingContextNormalizer` in `src/features/data-extraction/evidence/normalization/owned-website-wave1-normalizers.ts` emits bounded sentence-level observations with:

- role-derived `generalization_scope`;
- `observed_context`, a weak short-sentence title candidate, and the same sentence as `observed_description`;
- no normalized category, portfolio breadth, or repeated themes in the emitted implementation;
- only a currency-symbol-and-number token in `feature_or_value_language` when the simple regex matches; and
- `canonical_offering_ref: null` for every item.

This payload can ground a useful partial factual synthesis after exact application-owned scope is attached. It can contain name/title context, description, feature/capability statements, usage statements, customer/use-case statements, differentiating statements, and destination/action hints when those appear in selected source sentences. It does not guarantee each family, does not provide a normalized attribute graph, and need not do so: the Product contract explicitly permits a grounded partial result. The current implementation is therefore **sufficient for a bounded partial factual payload but not sufficient unmodified for Product execution**, because exact Offering scope is absent.

Acquisition in `src/features/data-extraction/evidence/acquisition/owned-website-wave1-acquisition.service.ts` uses direct owned-site fetch first and the existing Zyte path only as a configured fallback. It retains immutable source/capture lineage and normalized text. `src/features/data-extraction/evidence/acquisition/owned-site-observation-fragment.ts` uses Cheerio for bounded static DOM/JSON-LD inspection, but its JSON-LD traversal retains business locations, not Product/Offer commercial structures.

## 4. Offering-scope audit

**Classification: `NORMALIZER_EXTENSION_REQUIRED`, with a separate bounded reader extension.**

Current behavior cannot distinguish Offering A from Offering B safely under one Brand:

- the acquisition request in `src/features/data-extraction/evidence/ports/evidence-runtime.ports.ts` has Brand, capability, site root, and optional resource scope, but no application-owned canonical Offering reconciliation;
- URL inference in `owned-website-wave1-acquisition.service.ts` maps `/products`, `/shop`, `/services`, `/solutions`, `/pricing`, and category paths to overview roles and never infers `OFFERING_DETAIL`;
- `OfferingContextNormalizer` calls only the page role `OFFERING_DETAIL` a `SINGLE_OFFERING`, treats overview/pricing roles as `MULTIPLE_OFFERINGS`, and always emits a null canonical reference;
- the proof, serviceability, and location Wave-2 schemas similarly emit empty/null Offering references; and
- a canonical URL match alone is not a universal identity key under Product Authority.

P2B must accept an existing application-owned Offering reference only through an explicit capture/resource reconciliation, validate same-Brand ownership, mark only the reconciled resource as `OFFERING_DETAIL`, and populate the existing `canonical_offering_ref` field only on that exact source. It must never stamp one Offering reference over all pages in a broad capability execution. Multi-offering/category/pricing pages remain `MULTIPLE_OFFERINGS` and are inadmissible as exact subject Evidence unless a separately bounded item is deterministically reconciled.

No new capability is needed to establish factual scope, and DE must not invent Offering IDs.

## 5. Page-role and industry-family coverage

Implementation equivalents for the frozen contract are `PORTFOLIO_OVERVIEW` (offering/portfolio overview), `CATEGORY_OVERVIEW` (product category), `SERVICE_OVERVIEW` (service category), `SOLUTIONS_OVERVIEW`, `PRICING_PLANS`, and `OFFERING_DETAIL` (single product/service/plan). Selection examines at most 30 discovered links and scores relevant secondary pages, with at most three newly selected secondary pages.

| Family/surface | Current coverage | Result |
| --- | --- | --- |
| D2C PDP | Product/shop paths are discovered, but nested PDPs are classified `PORTFOLIO_OVERVIEW`, not exact detail. | `BOUNDED_RESOURCE_SELECTION_EXTENSION_REQUIRED` |
| D2C Collection | Collection/category paths map to `CATEGORY_OVERVIEW` and are acquired as multi-offering context. | `SUFFICIENT` for collection context; not exact child-Product truth |
| SaaS product/solution page | `/solutions` and product paths are selectable but overview-scoped; an exact plan/product URL is not automatically a detail subject. | `BOUNDED_RESOURCE_SELECTION_EXTENSION_REQUIRED` |
| SaaS pricing/plan page | `/pricing` and `/plans` map to `PRICING_PLANS`. | `SUFFICIENT` for multi-plan context; exact plan still needs reconciliation |
| Healthcare treatment/service page | Service paths are selectable, but nested treatment/service pages remain `SERVICE_OVERVIEW`. | `BOUNDED_RESOURCE_SELECTION_EXTENSION_REQUIRED` |
| Offline service/experience page | No experience-specific path/role inference exists; arbitrary exact experience URLs fall to `OTHER`. | `BOUNDED_RESOURCE_SELECTION_EXTENSION_REQUIRED` |

Overall: D2C and SaaS are **PARTIAL**; Healthcare and Offline require the same bounded resource-selection/role extension. No family proves a need for a new provider.

## 6. Factual processor minimum profile

| Output family | Classification | Basis |
| --- | --- | --- |
| `factual_summary` | `PARTIALLY_SUPPORTED` | `observed_context`/description can ground a concise summary, but current Evidence lacks exact canonical scope. |
| `key_facts` | `PARTIALLY_SUPPORTED` | Direct first-party statements can be selected from bounded context, but item typing and exact subject scope are not durable today. |
| `key_benefits` | `PARTIALLY_SUPPORTED` | Benefits may be defensibly reasoned from same-Offering facts; the payload's feature/value list is weak and unsupported outcomes must remain null. |
| `proof_points` | `PARTIALLY_SUPPORTED` | The proof capability preserves proof strength/class, sensitivity, source locator, and non-verification status, but its implementation emits `offering_refs: []`. |
| `usage_context` | `PARTIALLY_SUPPORTED` | Source sentences can state use situations; coverage is opportunistic and exact scope is missing. |
| `customer_context` | `PARTIALLY_SUPPORTED` | Source sentences can state customer/use-case relevance; absence remains null and no Audience is created. |

None of these families requires a new DE capability for the first slice. After the bounded exact-scope normalizer/reader work, a grounded subset may produce `PARTIAL`; unsupported families remain null or absent.

## 7. Proof and claim reuse result

**Reuse `explicit_factual_proof_or_claim_evidence`; do not create a Product proof capability.** `src/features/data-extraction/evidence/normalization/wave2/proof-evidence.normalizer.ts` and `wave2-evidence-contracts.ts` durably preserve the statement, `proof_strength`, `proof_class`, explicit subject scope, authorship, source URL/locator, claim sensitivity, and `NOT_EXTERNALLY_VERIFIED`. Testimonials, credential occurrence, first-party claims, and externally verified facts remain distinct; acquired copy cannot emit `VERIFIED_BUSINESS_FACT`.

The implementation gap is exact Product scope, not proof semantics: `factual_referent_ref` is null and `offering_refs` is constrained to an empty array. P2B may extend this existing payload with an application-supplied exact Offering reference under the same reconciliation rules as Offering context. Claim-sensitive output must still fail closed. Proof remains conditional for the first factual slice.

## 8. Creator-communication DE needs

`offering_creator_communication` does not need Product-specific extraction. Its reusable inputs are the current exact-Offering factual profile, same-Offering proof/claim Evidence for claim-sensitive talking points, protected canonical Offering `DO_NOT_SAY` guidance, explicitly applicable Brand constraints, and `derived_communication_constraint_evidence`.

The derived constraint normalizer in `owned-website-wave1-normalizers.ts` preserves explicit prohibitions/required terminology/disclaimer rules and scope class. It does not manufacture finished talking points or hard rules from ordinary repetition. P2B only needs the common exact-Offering scope plumbing and reader enforcement for `OFFERING_SPECIFIC` items; Brand-level rules require explicit applicability. Meta remains optional.

## 9. Actionability DE needs

No generic Product actionability capability is justified. `offering_actionability_synthesis` can use canonical lifecycle, customer destination, canonical price tuple, Offer refs, and `OFFERING_AVAILABLE_AT_LOCATION` relations without duplicating them in DE.

`owned_website.serviceability_evidence`, `owned_website.location_evidence`, and same-Offering offering context remain optional derived enrichment. The current Wave-2 serviceability and location payloads deliberately emit null `offering_ref`; use for exact Product enrichment therefore requires the same bounded reconciliation/reader treatment when that optional path is enabled. Location observations do not prove Offering availability, and serviceability does not create broad canonical geography.

## 10. Commercial and price Evidence audit

**Selected outcome: `NEW_BOUNDED_COMMERCIAL_CAPABILITY_REQUIRED`.**

Current normalized DE is not sufficient for deterministic controlled canonical price refresh:

| Required commercial semantic | Current evidence |
| --- | --- |
| Exact same-Offering scope | Missing; `canonical_offering_ref` is always null. |
| `EXACT`, `STARTING_AT`, `RANGE`, `NOT_PUBLICLY_LISTED` | Not normalized. |
| Current min/max amounts | One simple symbol-prefixed token may appear in `feature_or_value_language`; no numeric fields or bounds. |
| Regular/reference min/max | Not normalized. |
| Currency | Symbol is not a durable ISO currency and ambiguous symbols are unresolved. |
| Sale/reference distinction | Not normalized. |
| Explicit not-publicly-listed statement | May survive as generic text but has no durable commercial semantic. |
| Source locator | Shared Evidence has resource/capture lineage, but the Wave-1 offering payload has no item-level source locator. |
| Observation time/freshness | Shared capture/freshness lineage exists. |
| Conflicting prices | Generic Evidence history is retained, but commercial equivalence/conflict semantics and no-winner behavior are not defined. |
| Product JSON-LD/Offer structures | Not retained by the current Product path; bounded JSON-LD traversal only normalizes location structures. |

Legacy Stage-1 surface scanning (`src/features/brand-onboarding/surface-scan/http-brand-surface-scan.runner.ts`) parses a human starting-price label into the legacy Offering row and uses a configured default currency. Deep-scan inventory (`deep-scan-prompt1.schema.ts` and `apply-prompt1-inventory.util.ts`) does not define the canonical commercial tuple. These paths are canonical/onboarding application behavior, not normalized DE Evidence and cannot supply the required immutable, conflict-preserving refresh basis.

Extending generic `offering_context` would couple high-refresh commercial observation and explicit zero-item/not-public semantics to broad factual extraction, while still lacking an independently requestable capability result. Commercial observation is a durable semantic distinction with its own conflict and refresh behavior, so a bounded companion capability is warranted.

## 11. Product Evidence reader audit

**Classification: `BACKEND_READER_EXTENSION_REQUIRED`.**

`IntelligenceEvidenceReadRequest` currently contains only `brandId`, processor identity, and capability IDs. `DataExtractionEvidenceQueryService` calls `findLatestCompleted(brandId, capabilityId)`, which selects the latest Brand-wide execution and projects all of its Evidence. Neither the query nor `DataExtractionIntelligenceEvidenceAdapter` accepts or enforces an Offering subject. A later execution for Offering B could therefore hide or replace the selected execution for Offering A, while a broad execution can expose sibling items.

P2B must add an exact `canonicalOfferingRef` request predicate for Product consumers and fail closed unless every returned Offering-specific item has:

- the requested Brand;
- the requested capability;
- a populated matching application-supplied Offering reference; and
- a capability-appropriate exact scope (`SINGLE_OFFERING`/`OFFERING_SPECIFIC`).

It must query/select matching Evidence across completed executions rather than trust the newest Brand-wide execution, exclude null, multi-offering, unknown, and sibling references, retain the qualifying execution/capture lineage, and preserve conflict groups. This is a reader/repository extension, not a new DE capability. Existing Brand Intelligence reads remain backward-compatible and Brand-scoped.

## 12. Freshness and recapture assessment

Reuse the existing DE Evidence vocabulary exactly: `CURRENT`, `POSSIBLY_STALE`, and `UNKNOWN`, including `evaluatedAt`, basis, prior capture, source revision, and retained immutable capture history. Product output may map this conservatively into the shared Intelligence output vocabulary without inventing a Product Evidence state. No universal TTL is justified.

The first factual slice should read a current or explicitly usability-qualified retained capture. It does not require automatic recapture. If no exact scoped usable Evidence exists, a manual/requested refresh may use existing `REUSE_ALLOWED`, `REFRESH_IF_NOT_CURRENT`, or `FORCE_RECAPTURE` intent. Compatible retained capture content may be renormalized without network acquisition; the read adapter itself must never crawl, normalize, or recapture.

## 13. Provider and access matrix

| Need | Requirement |
| --- | --- |
| Direct owned-site fetch | Minimum existing path |
| Zyte | Existing optional fallback for blocked/degraded direct fetch; not universally required |
| Cheerio/static parsing | Existing bounded static HTML/text/JSON-LD mechanism; sufficient foundation |
| Gemini/OpenAI structured normalization | Not required for DE minimum; Product reasoning provider selection is separate |
| Parallel | Not required |
| Meta/Instagram | Optional enrichment only; not required |
| Similarweb | Not required |
| Competitor sources | Not required |
| New provider or credential | No |

No provider, access, security-boundary, or external-production call is required by the recommended P2B work.

## 14. Full processor dependency matrix

| Processor | Semantic requirement | Current capability/state | Scope | Payload | Provider | Freshness | Reader | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `offering_factual_synthesis` | Bounded exact-Offering factual context | `owned_website.offering_context` | Missing durable exact ref | Useful partial context | Sufficient | Reusable | Exact filter missing | `REUSE_WITH_BOUNDED_PAYLOAD_EXTENSION` plus reader extension |
| `offering_factual_synthesis` | Conditional proof points/claim-safe benefits | `explicit_factual_proof_or_claim_evidence` | Scope class exists; exact ref absent | Proof semantics sufficient | Sufficient | Reusable | Exact filter missing | `REUSE_WITH_READER_EXTENSION` plus bounded exact-ref population |
| `offering_creator_communication` | Factual ingredients | Current `offering_factual_profile` | Exact Product Object | Sufficient when current/safe | Not a DE provider need | Shared runtime | Subject-scoped Intelligence read required | `REUSE_EXISTING_CAPABILITY` |
| `offering_creator_communication` | Claim support and constraints | Proof + `derived_communication_constraint_evidence` + canonical guidance | Exact Offering/explicit Brand applicability needs enforcement | Sufficient; no finished talking points expected | Sufficient | Reusable | Exact filter missing | `REUSE_WITH_READER_EXTENSION` |
| `offering_actionability_synthesis` | Lifecycle, destination, commercial tuple, Offer/Location refs | Canonical application state | Exact Offering already owned by application | Sufficient for emitted bounded interpretations | None | Canonical/runtime freshness | Canonical subject read | `REUSE_EXISTING_CAPABILITY` |
| `offering_actionability_synthesis` | Optional observed availability/location context | Serviceability + location + offering context | Offering refs currently null | Semantics sufficient as optional enrichment | Sufficient | High sensitivity already modeled | Exact filter missing | `REUSE_WITH_READER_EXTENSION` |
| `offering_actionability_synthesis` | Controlled first-party price refresh basis | No current normalized capability | Absent | Insufficient | Existing owned-site path sufficient | Needs independent high-sensitivity result | New capability must be exact-scoped | `NEW_BOUNDED_CAPABILITY_REQUIRED` (not a first-factual-slice dependency) |

Final processor-level classifications are:

- `offering_factual_synthesis`: `REUSE_WITH_BOUNDED_PAYLOAD_EXTENSION` plus bounded reader extension;
- `offering_creator_communication`: `REUSE_WITH_READER_EXTENSION`;
- `offering_actionability_synthesis`: `REUSE_WITH_READER_EXTENSION` for optional Evidence, with canonical inputs reused and one deferred commercial capability for controlled refresh.

## 15. Proposed new capability

Systems should consider a capability concept named **`owned_website.offering_commercial_evidence`**. This is a recommendation, not a frozen or created capability ID.

Its smallest bounded observation payload should include an application-supplied exact `canonical_offering_ref`; observed price mode; current amount/min/max; regular/reference amount/min/max; ISO currency only when explicit/unambiguous; explicit not-publicly-listed statement; sale/reference distinction only when explicit; source URL and item locator; capture/observation time; and commercial temporal wording. It should use the existing owned-site provider/acquisition boundary and retain independent conflicting observations.

It must not mutate canonical Offering state, resolve identity, derive unexpressed discounts, convert currency, combine unrelated plans into a range, pick a winning price, claim catalogue completeness, or mix sibling Offering prices. A successful inspection with no public price is not `NOT_PUBLICLY_LISTED`; that mode requires an explicit first-party statement. Canonical price refresh remains an application-owned, separately authorized controlled transition.

## 16. Migration 52 implication

**`MIGRATION_52_REQUIRED = YES` if Systems authorizes the recommended capability.** No migration is required for the first factual slice's scope/reader extensions alone.

Because capability IDs are strings rather than a Prisma enum, `prisma/schema.prisma` needs no shape change. A single additive compatibility migration would expand the closed list in the same seven-constraint pattern used by migration 49:

1. `ck_de_capexec_supported_capability` on `data_extraction_capability_executions`
2. `ck_de_capresource_supported_capability` on `data_extraction_capability_resources`
3. `ck_de_evidence_supported_capability` on `data_extraction_evidence_items`
4. `ck_de_capevidence_supported_capability` on `data_extraction_capability_evidence`
5. `ck_de_observation_supported_capability` on `data_extraction_semantic_observations`
6. `ck_de_obs_support_supported_capability` on `data_extraction_observation_support`
7. `ck_de_obs_relation_supported_capability` on `data_extraction_observation_relations`

The TypeScript allow-lists in the DE vocabulary and Intelligence Evidence port, associated runtime schemas/normalizer registry, acquisition policy, and exact allow-list tests would also need an additive entry. The migration can preserve all rows, FKs, indexes, identities, and the existing nine IDs. P2A creates none of this.

## 17. First vertical slice decision

**YES — the P3 first factual vertical slice can run without a new DE capability**, after P2B supplies the bounded exact-scope normalizer/resource-selection and reader extensions.

Exact minimum Evidence profile:

- one validated Brand and one existing canonical `Offering.id` owned by that Brand;
- one application-reconciled owned first-party `OFFERING_DETAIL` resource/capture for that exact Offering;
- at least one current or explicitly usability-qualified `owned_website.offering_context` Evidence item whose `generalization_scope` is `SINGLE_OFFERING`, whose `canonical_offering_ref` exactly matches the subject, and whose bounded observed context is non-empty;
- complete immutable resource/capture/evidence/freshness/provenance lineage; and
- no null-ref, multi-offering, unknown, or sibling Offering item in the processor input.

Proof Evidence is conditional. The processor may emit any grounded subset of `factual_summary`, `key_facts`, `key_benefits`, `usage_context`, and `customer_context`; `proof_points` and unsupported families may be null/absent, producing a valid `PARTIAL` Object.

## 18. Exact proposed P2B scope

Subject to Systems authorization, P2B should be limited to:

1. add an application-owned exact Offering-to-resource/capture reconciliation input, same-Brand validation, and explicit `OFFERING_DETAIL` selection without fuzzy or URL-only identity creation;
2. populate the existing exact Offering reference in `owned_website.offering_context` and the existing proof/serviceability/location reference fields only for explicitly mapped sources;
3. extend the DE query and Intelligence reader with a fail-closed exact Offering predicate across completed executions while preserving existing Brand-scoped consumers;
4. authorize and implement the single bounded commercial Evidence capability recommended in section 15, if Systems accepts it;
5. if that capability is accepted, create one additive migration 52 expanding exactly the seven closed-list checks, with no Prisma model change; and
6. add unit, architecture, and disposable-PostgreSQL coverage for sibling isolation, retained-capture reuse, null/multi scope rejection, conflict preservation, allow-list behavior, and no canonical mutation.

P2B must not implement Product processors or canonical price mutation.

## 19. P3 prerequisites

- Systems acceptance of this audit and an explicit P2B capability decision.
- P2B exact Offering reconciliation, `OFFERING_DETAIL` resource selection, normalizer population, and reader/query sibling isolation complete and tested.
- The first-slice factual Evidence profile in section 17 demonstrably available for a fixture Offering.
- Shared Product subject identity from migration 51 remains the execution/current/candidate scope.
- Product contract bundle/runtime registration and the first `offering_factual_synthesis` processor implementation are separately authorized.
- Commercial capability completion is **not** a prerequisite for the first factual processor, but is required before controlled deterministic Product price refresh can be enabled.

## 20. Blockers and residual risks

No P2A circuit breaker is triggered. There is no Product decision, architecture conflict, provider/security conflict, destructive migration requirement, branch divergence, or need for a second extraction framework.

Residual risks for P2B/P3 are bounded and explicit:

- page-role inference is path-based and will miss opaque or JavaScript-routed detail URLs unless the application supplies an exact resource;
- static/direct fetch may be partial on client-rendered sites, with Zyte remaining the existing fallback rather than a guarantee;
- current sentence selection is heuristic and may yield sparse but contract-valid partial profiles;
- reader selection must not use only the newest Brand-wide execution;
- proof, serviceability, and location exact references need application reconciliation before Product-scoped use;
- price symbols and visible labels are ambiguous, so the proposed commercial normalizer must fail closed on currency/mode ambiguity and preserve conflicts; and
- Product output freshness vocabulary differs lexically from DE's `POSSIBLY_STALE`, requiring a conservative shared-runtime mapping rather than a new Product Evidence vocabulary.

P2A stops at the Systems capability gate.
