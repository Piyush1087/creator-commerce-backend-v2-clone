# Creator Shop — Reporting Domain Contract

**Status:** FROZEN  
**Scope:** Campaign Reporting — Step 1

## 1. Domain purpose

Campaign Reporting is a Campaign-level, read-only analytical projection of Campaign performance.

The Intelligence Engine is the authoritative owner of Reporting calculation and interpretation. Campaign surfaces consume published Reporting output and must not independently calculate competing metric values.

## 2. Reporting grain

Reporting is Campaign-level for MVP.

Product/CampaignAsset, Brief, Creator and Platform may be analytical dimensions inside Intelligence output, but they do not create independent first-class Campaign Report identities.

## 3. Logical identity

A Campaign may have one logical Campaign Report. The Report may have multiple successful calculations over time, while the Brand-facing product consumes the latest successfully published calculation.

## 4. Reporting evidence

Reporting may consume canonical evidence from Campaign, Outreach, Applicants, Collaboration and connected performance sources. These operational modules retain ownership of their entities and lifecycle state.

Reporting stores analytical output; it does not duplicate those operational aggregates.

Discovery/recommendation activity alone is not sufficient to imply Campaign performance.

## 5. Intelligence ownership

The Intelligence Engine owns:

- calculation logic;
- metric derivation;
- interpretation;
- evidence selection;
- insight generation;
- reporting-version provenance;
- determination of whether meaningful reporting evidence exists.

Campaign Reporting owns only the published Campaign-facing analytical projection and its persistence/provenance boundary.

## 6. Report availability

No successful meaningful published calculation means Reporting is not yet available.

A successful calculation may be:

- `AVAILABLE` — expected evidence used by the calculation is available;
- `PARTIAL` — a valid Report can be produced, but some relevant evidence is unavailable.

A partial Report is legitimate Reporting and must not be treated as a failed calculation.

## 7. Zero vs unavailable

A legitimate calculated zero is data and must render as zero.

It must remain distinct from:

- unavailable evidence; and
- not-yet-calculated/not-yet-available evidence.

The Intelligence output contract must preserve this distinction.

## 8. Last-known-good principle

A failed refresh must never destroy the latest successfully published Report.

If a newer Intelligence calculation fails, the previous successful published calculation remains Brand-facing with truthful freshness metadata.

## 9. Campaign context

Reporting interprets Campaign performance against Campaign Strategy, including the configured objective and KPI construct.

Campaign edits do not mutate historical calculations. Each calculation retains the Campaign reporting context/provenance under which it was produced.

## 10. Read-only Campaign behavior

Opening the Campaign Page or opening the full Report is a read action. Neither action synchronously triggers Reporting calculation.

## 11. Campaign lifecycle

Paused Campaigns retain readable Reporting and may continue to accumulate reporting evidence.

Campaign completion/archive must not delete historical Reporting.

A completed Campaign becomes eligible for final-report semantics according to the Reporting refresh contract.

## 12. Commercial reporting boundary

Planned Campaign budget/commercial values are not authoritative actual-spend evidence.

Actual-spend, ROI, CPM or similar commercial-efficiency metrics must not be inferred from planned commercials. Such metrics require an authoritative actual-payment/spend source.

## 13. Explicit exclusions

MVP Reporting does not introduce:

- a generic Campaign Health score;
- manual Report refresh;
- Reporting-owned Collaboration workflow;
- Product/Brief-level Report identities;
- user-specific Reports;
- Intelligence execution/job state in the Campaign domain.

---

**Reporting Step 1 — Domain Contract is FROZEN.**