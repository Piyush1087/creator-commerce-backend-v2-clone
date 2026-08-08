# Discovery Runtime + Lifecycle Contract

**Status:** FROZEN

## 1. Runtime separation

Recommendation execution state is separate from Campaign lifecycle and from current operational availability.

Canonical recommendation runtime projection:

```text
NOT_STARTED
RUNNING
SUCCEEDED
FAILED
```

`NOT_STARTED` is derived when no applicable run exists; it is not a persisted placeholder run.

## 2. Run types

Campaign-facing recommendation runs are:

```text
INITIAL
REPLENISHMENT
```

Retry is execution behavior, not a third business run type. A failed initial objective may be retried; this is distinct from asking for an arbitrary refresh.

## 3. Run outcomes

`RUNNING → SUCCEEDED` publishes a logically complete recommendation result. An incomplete worker result must not masquerade as success.

A legitimate result containing zero creators is `SUCCEEDED`, not `FAILED`.

`RUNNING → FAILED` does not change Campaign validity, delete Manual creators, or fabricate recommendation data.

## 4. Meta changes

If Meta is disconnected before an initial Marketplace-dependent run starts, runtime remains `NOT_STARTED`; nothing failed.

If Meta disconnects while a run is executing, runtime follows the actual run outcome: the run may succeed if it already has sufficient data, otherwise it fails.

If Meta disconnects after success, existing CampaignCreators and recommendation history remain intact.

## 5. Campaign Pause/readiness changes

Campaign Pause before a new run prevents that run from starting. Resume re-evaluates eligibility.

If Campaign is paused or executable Product/Brief readiness disappears while a run is already executing, the run is allowed to finish. Its result may be persisted while Campaign remains paused.

Pause/Resume and readiness restoration do not inherently rerun Intelligence or delete the creator pool.

## 6. Campaign edits and recommendation context

Campaign edits do not mutate historical score, band or rank. Material recommendation-relevant edits create a new recommendation context/version.

A creator recommendation always retains the context under which it was evaluated. Evaluation under V1 does not permanently block evaluation under V2.

The treatment of unused old-context recommendations — discard, rescore or retain-as-stale — is deferred to Intelligence/replenishment policy.

## 7. Rolling inventory and staged replenishment

Discovery maintains a rolling creator recommendation inventory. Replenishment is demand-driven and may consider quantity, remaining recommendation quality and Campaign urgency.

Fixed-date Campaigns may require greater creator inflow near deadline; evergreen Campaigns should avoid unnecessary long-horizon Day-0 acquisition.

Replenishment uses the deepest valid reusable Intelligence stage available before repeating upstream acquisition:

```text
L3 reusable output → use
else L2 reusable candidates → L3
else L1 reusable candidates → L2 → L3
else new L1 acquisition
```

Exact thresholds, buffer sizes, frequency, cache TTL and cross-Campaign allocation remain deferred.

## 8. Manual creator runtime

Manual single-add and CSV are independent of recommendation-run success. A manually sourced creator may later be resolved and evaluated by Intelligence without changing `source=MANUAL`.

Once a creator has been evaluated within a recommendation context/stage, that identity should be excluded from duplicate evaluation in the same applicable context/stage. Context V2 may permit reevaluation after a material Campaign change.

## 9. Review lifecycle

Valid creator review transitions:

```text
PENDING_REVIEW → REVIEWED
PENDING_REVIEW → REJECTED
REVIEWED       → REJECTED
REJECTED       → REVIEWED
```

Review transitions never trigger Intelligence recalculation.

## 10. Application handoff

A valid Application removes the creator from the active Discovery projection without deleting CampaignCreator or rewriting Discovery review state.

`REVIEWED` is not a prerequisite for a valid Application. A creator previously `REJECTED` in Discovery may still apply if they legitimately have Campaign access; Applicants receives the Application and Discovery history remains auditable.

## 11. Quota behavior

Campaign-level daily contact/outreach quota exhaustion causes no Discovery runtime transition. Recommendation data remains intact. Quota reset does not itself require an Intelligence rerun.

## 12. Idempotency and concurrency

The following operations must be logically idempotent:

- recommendation triggering/ingestion;
- Manual Add retries;
- CSV import confirmation;
- review mutations;
- restore;
- downstream Application handoff.

Concurrent Marketplace, Manual and CSV acquisition for the same Campaign/platform/social identity must converge on one CampaignCreator.

## 13. Frozen runtime invariants

1. Recommendation runtime is separate from Campaign lifecycle.
2. `NOT_STARTED` is derived; persisted runs are RUNNING/SUCCEEDED/FAILED.
3. Zero-result success is not failure.
4. Failure is non-destructive.
5. Running work may finish after Pause/readiness loss.
6. Meta disconnection after success does not invalidate recommendation history.
7. Campaign edits do not destructively recalculate historical recommendations.
8. Recommendation evaluation is context-aware.
9. Replenishment is demand-driven and staged.
10. Manual acquisition is independent of recommendation success.
11. Review transitions do not trigger Intelligence.
12. Application handoff preserves Discovery history.
13. Quota exhaustion is not a Discovery lifecycle transition.
14. Cross-path writes must be idempotent and converge on one CampaignCreator.