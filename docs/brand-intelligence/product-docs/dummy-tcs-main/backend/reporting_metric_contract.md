# Creator Shop — Reporting Metric Contract

**Status:** FROZEN  
**Scope:** Campaign Reporting — Step 2

## 1. Metric authority

The Intelligence Engine is the sole calculation authority for Campaign Reporting metrics. Campaign UI/backend must not independently derive a second value for the same canonical Reporting metric.

## 2. Campaign Strategy anchors

The configured Campaign Strategy remains authoritative for Reporting interpretation.

The Report must preserve and report against:

- Campaign objective;
- configured North Star / primary KPI;
- configured Secondary/supporting KPI construct.

Reporting must not silently replace an unavailable configured KPI with a different KPI merely because another metric is available.

## 3. Reporting window

Normal MVP Reporting is Campaign-to-date.

Each calculation represents the reporting window from its recorded `dataFrom` through `dataThrough`, rather than only the latest daily increment.

## 4. Canonical metric semantics

Metrics must preserve typed/raw analytical values rather than UI-formatted strings.

Conceptually a canonical metric carries:

```text
metricKey
value
availability
source/evidence basis where required
```

Formatting such as `1.2M`, `%`, currency display or labels remains presentation responsibility.

## 5. Availability semantics

Metric availability must distinguish at least:

- available value;
- legitimate zero;
- unavailable evidence;
- not-yet-calculated/not-yet-available evidence.

Unavailable must never be coerced to zero.

## 6. North Star KPI

The configured primary/North Star KPI is the principal Campaign performance metric in Reporting.

If its evidence is unavailable, Reporting communicates that it is unavailable. It does not substitute another metric as the North Star.

## 7. Secondary KPI

The configured Secondary/supporting KPI receives second priority in the Campaign Reporting projection.

The same no-substitution rule applies when it is unavailable.

## 8. Supporting metrics

Intelligence may select contextual supporting metrics appropriate to the Campaign objective and available evidence.

These are evidence/context for the configured Campaign Strategy; they do not override the North Star/Secondary KPI hierarchy.

## 9. Objective-aware reporting

Pulse, Proof, Production and Push Campaigns may expose different useful supporting metrics. The persistence contract therefore remains extensible rather than flattening every possible metric into fixed Campaign columns.

## 10. Funnel and operational evidence

Reporting may incorporate canonical Campaign evidence such as Outreach, tracked clicks, Applications, Applicant decisions, Collaboration facts, content facts and connected platform performance where available.

The Intelligence Engine owns the calculation definitions and prevents double counting or incompatible evidence mixing.

## 11. Insights

Intelligence may produce evidence-grounded observations from canonical metrics/evidence.

Insights must not fabricate unsupported causal explanations or fake precision. No generic Campaign Health/Trust score is introduced by the MVP Reporting contract.

## 12. Freshness

`dataThrough` represents evidence freshness and is distinct from calculation/publish timestamps.

Where source freshness differs, the Report-level freshness boundary must remain conservative enough not to imply that a headline KPI contains evidence newer than it actually does. More detailed source freshness may be retained in provenance.

## 13. Commercial-efficiency exclusion

Planned Campaign budget or creator commercials are not actual-spend evidence.

Therefore actual spend, ROI, CPM, cost-per-approved-creator or similar efficiency metrics are excluded unless an authoritative actual-payment/spend source exists.

---

**Reporting Step 2 — Metric Contract is FROZEN.**