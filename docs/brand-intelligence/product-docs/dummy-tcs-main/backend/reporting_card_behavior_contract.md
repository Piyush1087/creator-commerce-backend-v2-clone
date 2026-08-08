# Creator Shop — Reporting Card + Behaviour Contract

**Status:** FROZEN  
**Scope:** Campaign Reporting — Step 3

## 1. Scope

This contract defines only the single Campaign Page Reporting Card and its behavior. It does not design the full Report UI.

The card is a projection of the Intelligence-owned latest published Campaign Report calculation.

## 2. Card purpose

The card answers at a glance:

> How is this Campaign performing against its intended objective?

It is not intended to reproduce the entire Campaign funnel or full Report.

## 3. Canonical hierarchy

The card is constrained to:

```text
1 North Star KPI
1 Secondary KPI
0..2 supporting metrics
0..1 Intelligence insight
freshness
View full report action
```

The configured North Star KPI is the dominant element. Secondary KPI receives second priority. Supporting metrics contextualize the configured strategy.

## 4. No KPI substitution

If the configured North Star or Secondary KPI is unavailable, the card displays that state truthfully.

It must not silently substitute another available metric into that KPI's role.

## 5. Supporting metrics

Supporting metrics are Intelligence-selected according to Campaign objective and available evidence. They are not hard-coded as one universal pair across every Campaign type.

Maximum supporting metrics on the card: two.

## 6. Intelligence insight

The card may show at most one evidence-grounded current Campaign observation.

The insight is optional. If Intelligence has no sufficiently useful/evidence-grounded observation, the insight slot remains absent rather than showing generic filler.

No MVP positive/warning/negative/critical insight taxonomy is required.

## 7. Partial Report behavior

A valid partial Report remains displayable. The card may communicate unobtrusively that some reporting data is unavailable.

`PARTIAL` is not treated as a calculation failure.

## 8. Not-yet-available behavior

Before any meaningful successful Report is published, the card communicates that Campaign performance reporting is not yet available.

`View full report` is not actionable when there is no successful published Report.

## 9. Zero behavior

A successfully calculated zero renders as zero. It must not trigger the not-yet-available state.

## 10. Loading behavior

Campaign Page load reads the latest published Report. The page may show a request-level skeleton while fetching it.

Opening the Campaign Page does not synchronously trigger Intelligence calculation.

If a newer Intelligence calculation is underway, the card continues showing the latest successfully published calculation rather than reverting to a loading state.

## 11. Freshness

User-facing freshness is based primarily on the Report's evidence freshness (`dataThrough`) rather than merely `calculatedAt`.

A stale last-known-good Report remains visible with truthful freshness rather than being blanked because a newer refresh failed.

## 12. Failed refresh behavior

A background refresh failure is not automatically a Brand-facing Report error.

If a previous valid published calculation exists, the card continues displaying it and its truthful freshness.

## 13. `View full report`

`View full report` is a read action.

On click, it opens the Campaign's full Intelligence-owned Report view using the same latest published calculation as the card.

It does not:

- trigger calculation;
- create a Report;
- refresh metrics;
- create a new snapshot;
- change Intelligence execution priority.

## 14. Atomic consistency

Reporting Card and Full Report must read the same latest published calculation.

A newer calculation becomes visible only after successful atomic publication. The card must not progressively mix metrics from different calculation versions.

## 15. Card interactions excluded from MVP

The Campaign Page Reporting Card does not add:

- manual Refresh;
- Edit;
- Download;
- Share;
- date-range selection;
- metric selection;
- creator/Brief filters.

These are outside the frozen MVP card contract.

## 16. Card projection contract

Conceptually:

```text
ReportingCard
├── reportAvailability
├── northStar
│   ├── metric
│   ├── value
│   └── availability
├── secondaryKpi
│   ├── metric
│   ├── value
│   └── availability
├── supportingMetrics[0..2]
├── primaryInsight?
├── dataThrough
└── canViewFullReport
```

This is a read projection, not a dedicated database model.

---

**Reporting Step 3 — Reporting Card + Behaviour Contract is FROZEN.**