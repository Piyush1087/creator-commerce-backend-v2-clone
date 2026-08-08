# Creator Shop — Reporting Calculation + Refresh Contract

**Status:** FROZEN  
**Scope:** Campaign Reporting — Step 4

## 1. Asynchronous calculation

Reporting calculation is asynchronous and Intelligence-owned.

```text
Campaign/source evidence
        +
Campaign reporting context
        ↓
refresh eligibility
        ↓
Intelligence calculation
        ↓
successful atomic publication
        ↓
Reporting Card + Full Report
```

Campaign Page load and `View full report` are read actions and never synchronously trigger a Reporting calculation.

## 2. Event-informed, scheduled refresh

MVP does not recalculate after every individual Outreach, click, Application, Collaboration or performance event.

Those events update the underlying evidence. Scheduled Reporting eligibility incorporates the accumulated evidence.

## 3. Initial Report

Campaign launch alone does not require creation of an empty Report.

When no successful published Report exists, an initial calculation becomes eligible once Intelligence determines that meaningful reporting evidence exists.

At least one canonical Report metric must be available before a meaningful first Report is published.

## 4. Normal cadence

Active/paused Campaigns receive **daily refresh eligibility**, not mandatory daily recomputation.

Exact clock time is infrastructure/configuration rather than a Campaign-domain invariant.

If neither reporting-relevant evidence nor reporting context changed since the latest successful calculation, the scheduled run may be skipped.

## 5. Evidence changes are not direct run triggers

Outreach, clicks, Applications, Applicant decisions, Collaboration facts, content/performance changes and other canonical reporting evidence do not imply one Intelligence run per event.

They make newer evidence available to the next eligible calculation.

## 6. Campaign edits

Campaign edits do not synchronously recalculate Reporting.

The next eligible calculation uses the then-current reporting context. Historical calculations remain unchanged and retain their own Campaign objective/KPI/context provenance.

## 7. KPI/context change atomicity

If Campaign Strategy changes after a Report is published, the currently published Report remains an internally consistent snapshot of its old reporting context until a new calculation is successfully published.

The UI must not combine the newly edited KPI identity with an old metric value from the previous calculation.

## 8. Atomic publication

A new calculation is not progressively exposed metric-by-metric.

```text
v4 = latest published
v5 = calculating
→ Brand continues reading v4

v5 succeeds
→ publish atomically
→ v5 becomes latest
```

Reporting Card and Full Report switch to the same new calculation together.

## 9. Failed refresh

If a new calculation fails:

```text
keep previous latest successful calculation
```

The failed job belongs to Intelligence/job observability and does not destructively overwrite Campaign Reporting.

## 10. Partial successful refresh

A calculation that succeeds with incomplete source evidence may publish as `PARTIAL` and replace the previous latest calculation.

A failed calculation and a successful partial calculation are distinct states.

## 11. No stale-value mixing

If a new successful calculation cannot observe a metric that an older calculation could observe, the new calculation reports that metric as unavailable according to the metric contract.

It must not copy the older value into the newer calculation merely to fill the gap.

## 12. Reporting window

Normal MVP calculations are Campaign-to-date.

The daily eligible run recalculates the cumulative Campaign Report from `dataFrom` through the new `dataThrough`, rather than producing only a daily incremental Report.

## 13. Freshness

`dataThrough` reflects the evidence window actually represented by the Report.

Where source freshness differs, the Brand-facing Report-level freshness boundary remains conservative. Detailed source freshness may remain in provenance.

Reporting does not need to orchestrate every upstream source synchronization itself.

## 14. Paused Campaign

Paused Campaigns retain readable Reporting.

Reporting may remain eligible for refresh when new reporting-relevant evidence can still arrive, such as performance changes on already-published content.

Campaign operational pause does not automatically invalidate Reporting.

## 15. Completed Campaign and final Report

Campaign completion creates eligibility for one final Campaign-to-date calculation after a configurable evidence settlement window.

The successful final calculation is marked final and published. Routine daily refresh stops after finalization.

The exact settlement duration remains Intelligence/runtime configuration, not a hard-coded Campaign-domain invariant.

A later admin/system backfill or correction may produce a corrected final calculation if required; no Brand manual-refresh flow is introduced.

## 16. Archived Campaign

Historical Reporting remains readable after archive. Archive does not delete Reporting history.

Routine calculation behavior follows Campaign lifecycle/finalization semantics rather than inventing a separate Reporting lifecycle.

## 17. Evergreen vs fixed-date

Evergreen active Campaigns follow the same initial + daily eligibility model while active.

Fixed-date Campaigns do not automatically receive higher Reporting frequency merely because the deadline is approaching. Reporting is observational; deadline-driven operational urgency does not require hourly Reporting.

## 18. Page views do not affect refresh

Reporting cadence is Campaign/evidence-driven, not traffic-driven.

Zero Campaign Page views do not stop eligible Reporting refreshes, and repeated Campaign Page/Full Report views do not create extra Intelligence runs.

## 19. Intelligence/reporting version changes

A newer Intelligence/reporting engine version does not invalidate existing historical calculations.

The next eligible calculation may use the newer reporting version while older calculations preserve their original version provenance.

## 20. Append-oriented successful history

Successful published calculations are append-oriented rather than destructively overwritten.

This supports:

- last-known-good fallback;
- calculation provenance;
- Campaign-context changes;
- reporting-version provenance;
- final-report semantics.

The Brand does not require a calculation-history UI in MVP.

## 21. Dirty/change detection

The domain requirement is:

> Do not recompute when neither relevant evidence nor reporting context changed.

The implementation may use timestamps, versions, fingerprints or scheduler/runtime mechanisms. A persisted `reportingDirty` boolean is not required by the domain contract.

---

**Reporting Step 4 — Calculation + Refresh Contract is FROZEN.**