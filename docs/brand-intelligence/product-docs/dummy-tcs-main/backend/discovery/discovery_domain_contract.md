# Discovery Domain Contract

**Status:** FROZEN  
**Scope:** Campaign Discovery workspace domain  
**Depends on:** Campaign lifecycle/readiness, CampaignAsset + Brief contracts, Creator Shop Intelligence Engine  
**Backend reconciliation:** `backend/discovery_backend_schema_reconciliation.md`

## 1. Purpose

Discovery is the Campaign-level creator acquisition and review workspace. It owns the Campaign↔creator relationship and the brand's Discovery review workflow; it does not own Campaign strategy, Product/Brief selection, Applications, Collaborations, Outreach execution, Meta connection state, or raw Intelligence artifacts.

Creator recommendation is calculated at **Brand + Campaign level only**. CampaignAsset/Product and Brief have **zero recommendation weight** and are not recommendation cardinality dimensions. Product and Brief are selected later when a creator applies.

## 2. Canonical creator acquisition sources

Discovery supports two acquisition sources:

- `META_MARKETPLACE` — creators supplied by Creator Shop Intelligence after Creator Marketplace acquisition/evaluation.
- `MANUAL` — brand-added creators.

Manual single-add and CSV upload are the same source with different ingestion methods:

- `MANUAL_SINGLE`
- `MANUAL_CSV`

CSV is not a separate creator source.

## 3. Durable CampaignCreator

A creator entering Discovery creates/resolves one durable CampaignCreator for the Campaign. The same CampaignCreator identity survives downstream movement into Outreach, Applicants and Collaborations; those workspaces must not create duplicate creator identity merely for presentation.

Campaign-level uniqueness is based on Campaign + platform + normalized social identity. Marketplace, manual and CSV paths must converge on the same CampaignCreator.

Acquisition `source` records first successful entry and is immutable. Later Marketplace/Intelligence enrichment of a manually sourced creator does not rewrite `source`.

## 4. Review state

Canonical review states:

```text
PENDING_REVIEW
REVIEWED
REJECTED
```

Valid transitions:

```text
PENDING_REVIEW → REVIEWED
PENDING_REVIEW → REJECTED
REVIEWED       → REJECTED
REJECTED       → REVIEWED   // Restore
```

Review state is a brand workflow aid. It is not a Campaign lifecycle state, recommendation state, Outreach state, or Application-validity gate.

## 5. Recommendation semantics

The Creator Shop Intelligence Engine owns recommendation calculation. Discovery receives the final creator list plus published recommendation projection.

The internal numeric Recommendation Score is retained for ranking/replenishment/audit. The user sees only its canonical band:

```text
HIGH | MEDIUM | LOW
```

This is the Recommendation Score band, not a separate confidence metric. Discovery does not independently calculate score thresholds.

Marketplace recommendation ordering is score/rank driven. Manual creators do not receive artificial rank unless Intelligence later evaluates them.

## 6. Recommendation context

Every Intelligence evaluation belongs to a Campaign recommendation context/version. Historical scores remain associated with the context that produced them.

A material recommendation-relevant Campaign change creates a new recommendation context. Old scores must never silently be represented as current-context scores.

A creator evaluated under context V1 is deduplicated within V1, but is not permanently prohibited from evaluation under V2.

Which Campaign edits are material, and whether old L1/L2/L3 artifacts can be reused across contexts, is governed by the Intelligence/replenishment architecture.

## 7. Rolling creator inventory

Discovery does not assume one immutable Day-0 recommendation pool and does not require a blind daily refresh.

The canonical model is a **rolling recommended-creator inventory** with demand-driven replenishment. Inventory health may consider:

- usable creator quantity;
- remaining recommendation quality;
- Campaign urgency;
- fixed-date deadline proximity;
- evergreen steady-state demand.

Exact thresholds, buffer days and scheduling are policy parameters and are intentionally deferred.

## 8. Staged Intelligence boundary

Conceptual stages:

```text
L1 — broad Creator Marketplace candidate acquisition
L2 — base AI qualification
L3 — deep media/vision evaluation and final Recommendation Score
```

Replenishment should start from the deepest valid reusable stage available before repeating more expensive upstream work. Discovery owns only the published recommendation projection; L1/L2/L3 candidate pools, caches, scans and execution telemetry remain Intelligence-owned.

## 9. Campaign edits

Campaign edits do not destructively rewrite historical creator recommendations. Recommendation-relevant edits create a new context/version. Existing CampaignCreator identity and historical recommendation provenance remain intact.

The policy for unused recommendations from an older context — discard, rescore or retain-as-stale — remains deferred to Intelligence/replenishment policy.

## 10. Application boundary

Applicant workspace can never precede Discovery because a Campaign cannot accept an application until an executable Product/Brief construct exists.

A valid creator Application does not require `REVIEWED` state. A creator previously `REJECTED` in Discovery may still submit a valid Application if they legitimately have Campaign access. The Discovery rejection remains historical.

Applicants owns presentation of the creator's current-Campaign and cross-Campaign history (applied/collaborated/etc.).

## 11. Non-ownership / derived state

Discovery does not persist or own:

- Campaign Page workspace visibility;
- Campaign execution readiness;
- `activeDiscovery`;
- Meta capability/connection state;
- Outreach quota state;
- Applicant/Collaboration activation;
- Product/Brief recommendation matching;
- raw L1/L2/L3 Intelligence artifacts.

Campaign Pause, Meta disconnection, quota exhaustion, readiness loss and recommendation failure are non-destructive to CampaignCreator and recommendation history.

## 12. Frozen invariants

1. Creator matching is Brand + Campaign level only; Product/Brief do not contribute to recommendation scoring.
2. Manual single-add and CSV are one manual source with distinct ingestion methods.
3. CampaignCreator is the durable Campaign↔creator identity.
4. One creator resolves to one CampaignCreator per Campaign/platform/social identity.
5. Review state is `PENDING_REVIEW | REVIEWED | REJECTED` only.
6. Recommendation Score is Intelligence-owned; UI shows `HIGH | MEDIUM | LOW` band only.
7. Recommendation history is context-aware and non-destructive.
8. Discovery uses rolling, demand-driven recommendation inventory.
9. Fixed-date urgency may increase replenishment demand near deadline.
10. Replenishment should reuse the deepest valid L1/L2/L3 stage before repeating upstream acquisition.
11. Product/Brief selection occurs at Application time, not creator recommendation time.
12. Downstream workspaces do not redefine CampaignCreator identity.