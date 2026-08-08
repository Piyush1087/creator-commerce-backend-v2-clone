# Brand Intelligence — Identity

**Version:** 1.0  
**Status:** FROZEN  
**Role:** MVP reference branch for subsequent Intelligence Engine branches.

## Purpose

Identity establishes the canonical facts required to know which brand the platform is operating on and to safely run downstream Brand Intelligence.

Identity v1.0 passed the five-pass end-to-end review covering runtime journey, Intelligence Object/processor ownership, Evidence → reasoning → output contracts, state/lifecycle/persistence, and final cross-file integrity.

The architecture should now be replicated rather than redesigned for every new branch. Reopen Identity only when implementation/testing exposes a concrete requirement or an approved platform-level architecture change requires it.

## Frozen processor structure

```text
Identity
├── industry_classification
│   ├── gatekeeper scope -> industry, sub_industry
│   └── industry_niche scope -> industry_niche
├── identity_core
│   └── core brand, geography, language, currency and social Identity outputs
└── market_geography
    └── markets_served

Deterministic runtime
└── country -> reporting_currency
```

## Frozen onboarding sequence

```text
Application / scan admission
        ↓
Gatekeeper  ||  Website Evidence acquisition
        ↓
identity_core
        ↓
EARLY IDENTITY CHECKPOINT
        ↓
provisional edits
        ↓
persist state / worker exits
        ↓
domain verification
   ┌────┴────┐
 failed    verified
   ↓          ↓
discard     resume
edits        commit + lock
              ↓
   industry_niche || market_geography
              ↓
        Identity complete
              ↓
   remaining Surface Intelligence
```

The early Identity checkpoint is **not** the final Surface Intelligence review. It corrects critical Identity anchors before downstream Surface Intelligence depends on them.

## Gatekeeper implementation decision

For MVP, industry/sub-industry classification continues to use the direct Gemini website call against the homepage for speed. Zyte + Cheerio Website Evidence acquisition starts in parallel and is used by downstream Identity processing.

Architecturally, Gatekeeper classification remains an Identity processor. Its current acquisition mode does not move it outside the Intelligence System.

## Identity checkpoint

The checkpoint can display broader Identity information while only the following are editable in the normal onboarding flow:

- brand name
- social handles
- industry
- sub-industry
- country
- website currency

AI is allowed to leave `country` or `website_currency` unresolved. The user must provide valid values for these before submitting the checkpoint; the model must not fabricate them simply because onboarding requires completion.

Manual changes remain provisional until domain verification succeeds. Failed/abandoned verification discards provisional edits while AI-generated scan results may remain eligible for application-level reuse.

## Lock semantics

After successful domain verification and canonical commit, checkpoint-controlled fields are locked from normal user editing and automated Intelligence refresh.

`locked` does **not** mean physically immutable at the database level. An explicitly authorized admin/system correction may update a value outside the normal lifecycle.

## Currency distinction

`website_currency` records the primary currency exposed by the brand website and is used as context for catalogue/product intelligence.

`reporting_currency` is Creator Shop's platform reporting/transaction currency and is deterministically derived from confirmed country:

- India → INR
- United States → USD
- Rest of World → USD

It must never be inferred from `website_currency`, and it must be recalculated if canonical country changes during verified checkpoint commit.

## Geography distinction

Identity keeps three concepts separate:

- `country` — country-level business base
- `business_geography` — more precise business/registration/operating base where resolvable
- `markets_served` — where the business can meaningfully sell/deliver its product, service or experience

`market_geography` uses Website Evidence as the primary commercial-availability evidence, with optional Similarweb demand geography and Instagram audience geography as supporting evidence. Fallback is business-model aware: location-bound businesses may fall back to business geography; nationally/digitally deliverable and multi-market businesses fall back to country rather than headquarters locality. GLOBAL is never assumed merely from digital accessibility.

## Application / scan-admission safeguards

These occur before fresh Intelligence execution and are not processor reasoning:

1. A normalized domain already belonging to a verified brand stops onboarding and returns the existing-brand/contact-admin journey.
2. A result may be reused within 7 days only when it is an **eligible reusable result**. Technical failures, incomplete failed scans and provisional edits are not reusable results.
3. At the configured abuse threshold (currently 5+ websites added by a user or the same website added 5+ times), domain verification is required before further new scan execution.

`website_url`/domain is application input consumed by the Intelligence System; it is not AI-derived Intelligence.

## Persistence rule

An Intelligence Object definition does **not** automatically create a second value store. Where the existing backend already has the canonical field, Intelligence maps to that field. New PostgreSQL storage is added only when the required Intelligence structure does not already exist.

Temporary provisional edits and runtime execution records are separate from canonical application values.

## Async checkpoint implementation

Domain verification is persist-and-resume:

```text
checkpoint submitted
→ persist profile/checkpoint state
→ active worker exits
→ application completes domain verification
→ resume profile from persisted state
```

The Intelligence Compiler must not remain alive waiting for user action.

## Reliability retained in the MVP architecture

- controlled taxonomy
- processor-specific reasoning
- output contracts
- normalized Evidence contracts
- null rather than forced inference
- Evidence/runtime provenance
- partial execution
- parallel execution
- dependency-aware downstream execution
- output validation before persistence
- provisional manual correction
- lifecycle-aware refresh protection
- task-level retry using valid prerequisite state/evidence

## Global concerns intentionally not duplicated inside Identity

- Evidence freshness thresholds belong to a global Evidence/runtime policy.
- Trigger schedules/events belong to the Trigger layer.
- Model selection and prompt-package runtime configuration belong to Compiler/runtime configuration.
- Scan-admission query/storage implementation belongs to the application layer.

## Files

- `objects.yaml` — canonical Identity object definitions and lifecycle/storage metadata.
- `processors/` — frozen processor definitions.
- `evidence/evidence.yaml` — frozen normalized Evidence contract.
- `artifacts/` — frozen processor reasoning/taxonomy/output contracts where required.
- `../../../../execution_profiles/identity_onboarding.yaml` — frozen machine-readable onboarding orchestration profile.

## Freeze result

**PASS — Brand Intelligence > Identity v1.0 is FROZEN as the MVP reference branch.**
