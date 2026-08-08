# Creator Shop — Reporting Backend Schema Reconciliation

**Status:** FROZEN  
**Scope:** Campaign Reporting persistence boundary  
**Schema baseline:** `campaign_schema.prisma` v1.6  
**Target patch:** v1.6 → v1.7

## 1. Purpose

This artifact freezes the backend reconciliation for Campaign Reporting after Reporting Steps 1–5.

Campaign Reporting is a read-only, Intelligence-owned analytical projection of Campaign performance. The Campaign domain consumes published Reporting output; it does not independently calculate Campaign reporting metrics.

The schema must preserve a thin Campaign-facing Reporting boundary while retaining enough immutable provenance for atomic publication, last-known-good behavior, Campaign-context changes, Intelligence/reporting-version changes, and final-report semantics.

## 2. Canonical ownership boundary

```text
Campaign / Discovery / Outreach / Applicants / Collaboration / performance sources
                                ↓
                       Intelligence Engine
                                ↓
                   Campaign Report Calculation
                                ↓
                    latest published Report
                         ┌──────┴──────┐
                         ↓             ↓
                  Reporting Card   Full Report View
```

Ownership rules:

- Intelligence Engine owns calculation and interpretation.
- Campaign Reporting persistence stores the published analytical projection and provenance.
- Campaign frontend/backend must not independently recompute a second version of a Reporting metric.
- Collaboration remains an independent module. Reporting may consume its canonical evidence through Intelligence but must not duplicate Collaboration entities in this schema.
- The full Report UI remains outside the current Campaign UI scope.

## 3. Reporting grain and cardinality

Reporting grain is Campaign-level.

```text
Campaign
  └─ CampaignReport 0..1
       └─ CampaignReportCalculation[]
```

There is one logical Report per Campaign and append-oriented successful calculations beneath it.

Product/CampaignAsset, Brief, Creator and Platform may be analytical dimensions used by Intelligence, but they do not create separate first-class Report entities in the MVP Campaign schema.

## 4. Required schema additions

### 4.1 `UceReportAvailability`

Add a calculation-level availability enum:

```prisma
enum UceReportAvailability {
  AVAILABLE
  PARTIAL
}
```

`NOT_AVAILABLE` and `NOT_YET_CALCULATED` are not persisted as published-calculation states.

- No meaningful successful Report yet → no published calculation / no latest published pointer.
- A successful calculation with incomplete source evidence → `PARTIAL`.
- A successful calculation with the expected available evidence → `AVAILABLE`.

Individual metric availability remains part of the validated structured metric payload and must preserve the semantic distinction between a legitimate zero, unavailable evidence and not-yet-calculated evidence.

### 4.2 `UceCampaignReport`

Add one stable logical Report identity per Campaign.

Required conceptual fields:

```text
id
campaignId               // unique
latestCalculationId?     // explicit currently-published calculation pointer
createdAt
updatedAt
```

Responsibilities:

- provide stable Campaign↔Report identity;
- own the append-oriented calculation collection;
- explicitly identify the currently published calculation.

The logical Report must not contain duplicated calculated metrics, card fields, report availability, Campaign-health state or Intelligence execution state.

### 4.3 `UceCampaignReportCalculation`

Add immutable/append-oriented successful analytical snapshots.

Required conceptual fields:

```text
id
reportId
version

objective
primaryKpiId
supportingKpiIds

reportingVersion
reportContextHash?

availability

dataFrom
dataThrough

metrics Json
insights Json?
provenance Json?

isFinal

calculatedAt
publishedAt?
createdAt
```

Required uniqueness:

```text
(reportId, version)
```

A calculation row represents valid Intelligence output. Failed/running/queued jobs are not Campaign Report calculations.

## 5. Explicit latest-publication pointer

The logical Report must explicitly reference its latest published calculation rather than deriving publication solely from `MAX(calculatedAt)` or `MAX(version)`.

Conceptually:

```text
published v4
latestCalculationId = v4

v5 calculating / persisted but not published
latestCalculationId = v4

v5 successfully published atomically
latestCalculationId = v5
```

This implements the frozen atomic-publication and last-known-good contracts.

The Prisma patch must use named relations as necessary to model the Report→latest calculation pointer alongside the Report→calculations collection without ambiguous relations.

`latestCalculationId` is the authoritative publication pointer. `publishedAt` records when a successful calculation became Brand-facing.

## 6. Campaign relation

Add only the thin relation on `UceCampaign`:

```text
report UceCampaignReport?
```

Do not add Campaign-level Reporting status, freshness, latest metric, card values or refresh flags merely for presentation convenience.

## 7. Campaign strategy provenance

The current Campaign strategy already owns Campaign objective and KPI selection. Each Report calculation must snapshot the reporting construct used for that calculation:

```text
objective
primaryKpiId
supportingKpiIds
```

This is intentional historical provenance rather than accidental duplication.

If Campaign Strategy changes later, old calculations remain interpretable against the construct under which they were produced. A newer calculation uses the then-current Campaign reporting construct.

Reporting must not silently substitute a different North Star/Secondary KPI because the configured KPI is unavailable.

## 8. Reporting context provenance

Persist:

```text
reportingVersion
reportContextHash?
```

`reportingVersion` identifies the Intelligence/reporting calculation contract/version responsible for the snapshot.

`reportContextHash` is an opaque fingerprint of the reporting-relevant Campaign context used by Intelligence. It avoids coupling Reporting persistence to every Campaign field that may influence interpretation and supports refresh eligibility when reporting context changes.

The hash-generation algorithm remains Intelligence/runtime-owned.

## 9. Reporting window and freshness

Persist separately:

```text
dataFrom
dataThrough
calculatedAt
publishedAt
```

Semantics:

- `dataFrom` → beginning of the Campaign-to-date reporting window used by the calculation.
- `dataThrough` → conservative evidence-freshness boundary represented by the published Report.
- `calculatedAt` → when Intelligence completed the calculation.
- `publishedAt` → when that calculation became the Brand-facing published Report.

The Campaign Reporting Card's user-facing freshness is based on data freshness, not merely calculation time.

## 10. Metrics payload

Canonical metrics must not be flattened into dozens of Prisma columns.

Persist:

```text
metrics Json
```

The payload is structured and application-validated. `Json` does not mean arbitrary/uncontracted output.

Conceptually, metric entries preserve at least:

```text
metricKey
value
availability
source/data basis where required
```

Canonical persistence stores raw/typed analytical values rather than presentation strings. For example, persist a numeric reach value rather than `"1.2M Reach"`.

The metric contract may include Campaign funnel metrics, objective performance metrics, North Star/Secondary KPI actuals and supporting metrics according to the frozen Reporting Metric Contract.

Do not infer unavailable metrics as zero.

## 11. Insights payload

Persist:

```text
insights Json?
```

Insights are structured, evidence-grounded Intelligence output. The payload may contain more than the single insight projected onto the Campaign Reporting Card.

The Campaign Card selects at most one useful current insight; this presentation rule must not constrain the canonical persisted Report output.

Intelligence insights must not fabricate unsupported causal claims or fake precision such as an unengineered Campaign Health/Trust score.

## 12. Provenance payload

Persist:

```text
provenance Json?
```

This may capture source-level evidence basis/freshness required to explain the calculation without normalizing every Intelligence source into Campaign-domain relational tables.

Examples may include differing source freshness boundaries for platform performance, Applicants or Collaboration evidence.

The Report-level `dataThrough` remains the conservative Brand-facing freshness boundary.

## 13. Final-report semantics

Persist on the calculation:

```text
isFinal Boolean
```

A completed Campaign becomes eligible for a final Campaign-to-date calculation after the Intelligence/runtime settlement window. The successful final calculation is published with `isFinal = true`.

Finality belongs to the calculation, not the logical Report. This permits a later corrected/backfilled final calculation without mutating historical calculation evidence.

Routine refresh stops after finalization according to the frozen refresh contract; admin/system backfill mechanics remain outside this Campaign schema.

## 14. Calculation publication and failure semantics

Campaign Report calculations are append-oriented successful outputs.

```text
new calculation fails
→ do not overwrite/delete latest published calculation
→ latestCalculationId remains unchanged

new calculation succeeds partially
→ persist PARTIAL calculation
→ it may be published as latest

new calculation succeeds fully
→ persist AVAILABLE calculation
→ publish atomically
```

Failed, queued and running Intelligence jobs belong to Intelligence/job observability and are explicitly excluded from Campaign Reporting persistence.

## 15. Refresh contract boundary

The schema supports, but does not itself encode, the frozen runtime behavior:

- Campaign Page load does not trigger calculation.
- `View full report` does not trigger calculation.
- Initial calculation becomes eligible once meaningful reporting evidence exists.
- At least one canonical metric must be available before the first meaningful Report is published.
- Active/paused Campaigns receive daily refresh eligibility, not mandatory daily recomputation.
- If neither reporting-relevant evidence nor reporting context changed, the scheduled run may be skipped.
- Campaign edits do not synchronously recalculate Reporting.
- Completed Campaigns receive a final calculation after a configurable settlement window.
- Fixed-date urgency does not increase Reporting frequency merely because the deadline is approaching.

Exact scheduling, dirty detection, job queues and settlement duration remain Intelligence/runtime concerns.

## 16. Reporting Card projection boundary

Do not create a separate Reporting Card persistence model or card-specific columns.

The Campaign Page card is derived from the latest published calculation and is constrained by the frozen UI contract to:

```text
1 North Star KPI
1 Secondary KPI
0..2 supporting metrics
0..1 Intelligence insight
freshness
View full report action
```

Unavailable configured KPIs remain visibly unavailable; the card must not silently substitute another KPI.

No successful published calculation means the Report is not yet available and `View full report` is not actionable.

## 17. Full Report boundary

Do not create Campaign-domain models for:

```text
ReportPage
ReportSection
ReportWidget
ReportDashboard
```

`View full report` is a read action that routes/opens the Intelligence-owned full Campaign Report view using the same latest published calculation as the Reporting Card.

The action does not create a Report, recalculate metrics, freeze a snapshot or increase Intelligence execution priority.

## 18. Collaboration boundary

Collaborations are a separate independent module.

Reporting may consume canonical Collaboration evidence through the Intelligence Engine, but the Campaign Reporting schema must not duplicate Collaboration entities or introduce Reporting-owned Collaboration workflow/state.

The same ownership principle applies to Outreach and Applicants: Reporting stores analytical results, not copies of their operational entities.

## 19. Commercial reporting boundary

Campaign planned commercial values, including total Campaign budget, must not be presented as actual Campaign spend.

Commercial-efficiency metrics such as actual spend, cost per approved creator, CPM or ROI require authoritative actual-spend/payment evidence. Until such evidence exists, Reporting must not infer those metrics from planned Campaign commercials.

No additional actual-spend persistence is introduced by this Reporting patch.

## 20. Delete semantics

Campaign Report has no independent business existence outside its Campaign.

Expected lifecycle:

```text
Campaign delete
→ CampaignReport delete
→ CampaignReportCalculation delete
```

Campaign completion/archive must not delete or hide the historical Report. Archive is operational/presentation state, not analytical-history deletion.

## 21. Explicit exclusions from the v1.7 Campaign schema

Do **not** add:

- Reporting job queue/state;
- failed calculation records;
- retry counters/provider errors;
- `reportingDirty` unless later implementation evidence proves it necessary;
- source synchronization jobs;
- dozens of individual metric columns;
- Reporting Card persistence;
- full-Report UI sections/widgets;
- duplicate Collaboration/Applicant/Outreach entities;
- actual-spend inference from planned commercials;
- generic Campaign Health/Trust scores;
- manual-refresh state;
- Brand-user-specific Reports;
- Product/Brief/Creator first-class Report entities for MVP.

## 22. Planned v1.6 → v1.7 schema delta

The Reporting patch should therefore be limited to approximately:

```text
NEW ENUM
UceReportAvailability

UCE CAMPAIGN
+ report UceCampaignReport?

NEW MODEL
UceCampaignReport
- id
- campaignId (unique)
- latestCalculationId?
- calculations[]
- createdAt
- updatedAt

NEW MODEL
UceCampaignReportCalculation
- id
- reportId
- version
- objective
- primaryKpiId
- supportingKpiIds
- reportingVersion
- reportContextHash?
- availability
- dataFrom
- dataThrough
- metrics Json
- insights Json?
- provenance Json?
- isFinal
- calculatedAt
- publishedAt?
- createdAt
- unique(reportId, version)
```

The implementation must use an unambiguous Prisma relation shape for the explicit latest-calculation pointer and the append-oriented calculation collection.

## 23. Frozen invariants

The v1.7 implementation must preserve all of the following:

1. Reporting grain is Campaign-level.
2. One logical Report exists per Campaign at most.
3. Intelligence Engine is the sole Reporting calculation authority.
4. Published calculations are append-oriented.
5. Latest Brand-facing calculation is explicit and atomically switchable.
6. Failed refresh never destroys last-known-good Report.
7. Successful partial calculations may publish.
8. Zero, unavailable and not-yet-calculated remain semantically distinct.
9. Campaign strategy KPI/objective context is snapshotted per calculation.
10. Metrics/insights/provenance are structured Intelligence output, not UI strings.
11. Reporting Card and Full Report read the same latest published calculation.
12. Card/full-report reads never trigger Intelligence calculation.
13. Collaboration remains independently owned.
14. Reporting survives Campaign completion/archive.
15. Finality belongs to a calculation.
16. Planned Campaign commercials are not actual-spend evidence.
17. Operational Intelligence jobs remain outside Campaign Reporting persistence.

---

**Reporting Step 5 backend schema reconciliation is FROZEN.**

The next schema action is to patch `campaign_schema.prisma` **v1.6 → v1.7** according to this artifact, validate the resulting Prisma relation shape and then validate v1.7 against frozen Reporting Steps 1–5.