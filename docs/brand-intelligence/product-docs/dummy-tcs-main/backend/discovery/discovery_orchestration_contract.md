# Discovery Orchestration Contract

**Status:** FROZEN

Campaign Page Orchestration is authoritative for whether Discovery is rendered. Discovery controls only its internal content and actions.

## Readiness
New Discovery acquisition requires a Campaign state that permits Discovery plus at least one ACTIVE CampaignAsset with at least one PUBLISHED Brief. Applicants cannot structurally precede Discovery because a valid application requires an executable Product/Brief construct. Campaign Share remains locked without that executable construct.

## Meta dependency
Creator Marketplace-dependent acquisition requires an active Meta/Creator Marketplace connection when the operation starts. Disconnection does not delete existing creators or recommendation history. Manual ingestion and review are separate from Marketplace capability.

## Initial recommendation
The initial run may start when Campaign state permits Discovery, Product/Brief readiness exists, Meta capability is active, and no applicable initial recommendation has already completed. Triggering is idempotent.

## Replenishment
After the initial recommendation, additional creator recommendation is demand-driven rather than a mandatory daily refresh or a single giant Day-0 pool. Demand may consider usable inventory quantity, remaining recommendation quality, expected campaign creator demand, Campaign urgency, and fixed-date deadline proximity. Exact thresholds remain deferred.

Evergreen Campaigns maintain a rolling inventory. Fixed-date Campaigns may require increasing creator inflow as deadline proximity increases.

When replenishment is required, Intelligence should use the deepest valid reusable stage available before repeating upstream work: valid unused L3 output, then valid L2 candidates for L3, then valid L1 candidates for L2/L3, and only then new L1 Creator Marketplace acquisition. Storage, TTL and invalidation remain Intelligence concerns.

## Operational changes
Campaign Pause, Meta disconnection, quota exhaustion, loss of Product/Brief readiness, and recommendation failure do not destroy persisted Discovery data. A recommendation run already executing may finish after Campaign Pause or readiness loss. Resume/readiness restoration re-evaluates future need without automatically invalidating existing recommendations.

Campaign edits do not blindly refresh recommendations. Material recommendation-relevant edits create a new recommendation context/version; historical recommendations retain their original provenance.

Manual single-add and CSV operate independently of Marketplace recommendation success, subject to Campaign operation/readiness rules. A manual creator later evaluated by Intelligence retains `source=MANUAL`.

## Frozen invariants
1. Campaign Page owns Discovery workspace visibility.
2. New acquisition requires executable CampaignAsset + Published Brief readiness.
3. Applicants never structurally precedes Discovery.
4. Meta is required only for Marketplace-dependent acquisition.
5. Initial recommendation triggering is idempotent.
6. Future recommendation is demand-driven replenishment.
7. Replenishment prefers the deepest valid reusable Intelligence stage.
8. Pause/readiness loss is non-destructive.
9. An already-running recommendation may finish after Pause/readiness loss.
10. Quota exhaustion is not a Discovery lifecycle transition.
11. Campaign edits do not destructively recalculate historical recommendations.
12. Discovery does not directly activate Applicants or Collaborations.