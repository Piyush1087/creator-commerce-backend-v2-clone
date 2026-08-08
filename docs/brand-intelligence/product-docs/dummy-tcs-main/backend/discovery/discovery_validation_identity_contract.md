# Discovery Validation + Identity Resolution Contract

**Status:** FROZEN

## 1. Identity layers

Keep three concepts separate:

1. canonical Creator identity — who the creator is platform-wide;
2. CampaignCreator identity — whether the creator already exists in this Campaign;
3. recommendation-evaluation identity — whether Intelligence already evaluated the creator under the applicable Campaign recommendation context/stage.

CampaignCreator may exist before canonical Creator resolution succeeds.

## 2. Required manual identity

Both Manual single-add and CSV ingestion require:

- email; and
- social handle.

The social handle must pass a lightweight crawl/validation before CampaignCreator creation.

Marketplace creators may not expose email during Discovery, so database nullability may remain broader than Manual runtime validation.

## 3. Social identity normalization

Before comparison, supported forms such as:

```text
@CreatorName
creatorname
https://instagram.com/CreatorName/
```

must normalize to the same comparison identity where resolvable.

Normalization includes trimming, removing supported prefixes, case normalization for comparison, extracting a username from supported profile URLs, and rejecting malformed identifiers. Display handle remains separate from normalized identity.

## 4. Campaign uniqueness

One creator may have at most one CampaignCreator per Campaign/platform/normalized social identity.

Marketplace, Manual single, CSV and later Intelligence enrichment must converge on that same CampaignCreator. Concurrent acquisition paths must not create duplicates.

First successful entry determines immutable acquisition `source`:

```text
META_MARKETPLACE | MANUAL
```

CSV is an ingestion method, not a source.

## 5. Recommendation deduplication

Recommendation evaluation is Campaign-context aware. A creator already evaluated under context V1/stage should not consume duplicate evaluation capacity in the same applicable context/stage.

Evaluation under V1 does not inherently prohibit evaluation under V2 after a material recommendation-context change.

Discovery validates the structure/provenance of Intelligence output but does not recalculate the Recommendation Score or HIGH/MEDIUM/LOW thresholds.

## 6. Manual Add validation

Canonical flow:

```text
email + social handle
→ structural validation
→ normalize social identity
→ lightweight crawl validation
→ identity resolution
→ Campaign deduplication
→ create/resolve CampaignCreator
```

Failure to resolve a canonical Marketplace/Creator identity does not by itself invalidate a manually supplied creator if required Manual validation succeeds.

If the creator already exists:

- active/reviewable creator → do not duplicate;
- `REJECTED` creator → Restore existing CampaignCreator;
- creator already downstream in Campaign journey → do not recreate.

## 7. CSV validation

Canonical flow:

```text
UPLOAD → MAP → VALIDATE → PREVIEW → CONFIRM → IMPORT
```

Validate file-level readability/mapping and row-level required identity/syntax.

Rows should distinguish at least:

```text
VALID_NEW
DUPLICATE_IN_FILE
ALREADY_IN_CAMPAIGN
INVALID
RESTORABLE
```

Partial import is allowed. Valid rows may be imported while invalid/duplicate rows are excluded.

Repeated creator rows in one file produce one candidate. Conflicting supplementary values must not be silently merged without an explicit rule.

## 8. Email identity

Email is required for Manual/CSV ingestion but is not the primary CampaignCreator uniqueness key. Platform/social identity is stronger for the Instagram-first MVP. Uploaded email alone must not become an unsafe global uniqueness constraint.

## 9. Review validation

Backend-authoritative valid transitions:

```text
PENDING_REVIEW → REVIEWED
PENDING_REVIEW → REJECTED
REVIEWED       → REJECTED
REJECTED       → REVIEWED
```

Restore does not create a new CampaignCreator and does not trigger Intelligence recalculation.

## 10. Campaign/readiness validation

Validation is operation-specific rather than a blanket `Campaign must be LIVE` rule.

Starting new creator acquisition requires current Discovery readiness. A recommendation run already in progress may finish after readiness is lost.

Meta connection is required for Marketplace-dependent acquisition, not for viewing existing Discovery data or for Manual identity validation/ingestion.

Quota state is not a Discovery validation dependency.

## 11. Application boundary

A valid Application does not require CampaignCreator to be `REVIEWED`. Discovery `REJECTED` state does not invalidate an otherwise valid Application.

Application submission preserves CampaignCreator, source, recommendation provenance and review history. Applicants owns interpretation/display of current-Campaign and cross-Campaign application/collaboration history.

## 12. Historical recommendation validity

An older-context recommendation remains a valid historical record even when it is no longer current-context intelligence. Do not mutate or relabel it. Intelligence/replenishment policy decides whether to reuse, rescore or replace it.

## 13. Idempotency

Network retries and concurrent writes must not create duplicate CampaignCreators or duplicate logical recommendation/import/review mutations. Database uniqueness and service-level identity resolution must work together.

## 14. Canonical semantic errors

Implementation should expose stable domain errors rather than raw database failures. Expected categories include:

```text
DISCOVERY_NOT_AVAILABLE
CREATOR_IDENTIFIER_REQUIRED
CREATOR_IDENTIFIER_INVALID
CREATOR_SOCIAL_VALIDATION_FAILED
CREATOR_ALREADY_IN_CAMPAIGN
CREATOR_ALREADY_APPLIED
CREATOR_IDENTITY_CONFLICT
CREATOR_REVIEW_TRANSITION_INVALID
MARKETPLACE_CONNECTION_REQUIRED
RECOMMENDATION_RUN_INVALID
RECOMMENDATION_PAYLOAD_INVALID
RECOMMENDATION_CONTEXT_INVALID
CSV_FILE_INVALID
CSV_MAPPING_INVALID
CSV_ROW_INVALID
CSV_DUPLICATE_ROW
CAMPAIGN_STATE_DISALLOWS_DISCOVERY_OPERATION
CAMPAIGN_NOT_DISCOVERY_READY
CONCURRENT_CREATOR_MUTATION
```

Exact transport/error-code mapping may be finalized during service implementation.

## 15. Frozen validation invariants

1. Canonical Creator, CampaignCreator and recommendation-evaluation identity are separate.
2. Manual/CSV require both email and social handle.
3. Social handle must pass lightweight crawl validation.
4. Social identity is normalized before comparison.
5. Campaign/platform/normalized social identity is unique.
6. First acquisition source is immutable.
7. Recommendation deduplication is context-aware.
8. Discovery validates Intelligence payloads but does not recalculate scores/bands.
9. Duplicate Manual/CSV paths never create another CampaignCreator.
10. Partial CSV import is allowed.
11. Email is not the primary uniqueness key.
12. Review transitions are backend-authoritative.
13. Readiness checks are operation-specific.
14. Meta is required only for Marketplace-dependent acquisition.
15. Quota state is not Discovery validation.
16. Older-context recommendations remain valid historical records.
17. Writes are idempotent and concurrency-safe.