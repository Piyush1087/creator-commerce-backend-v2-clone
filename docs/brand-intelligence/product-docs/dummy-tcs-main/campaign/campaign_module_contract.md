# Creator Shop Campaign Module — End-to-End Contract

**Status:** CANONICAL / PHASE 1C  
**Scope:** Create Campaign → Edit/View Campaign → Product/Brief setup → operational Campaign Page

## 1. Purpose

This contract ties the already-frozen Campaign surfaces into one module journey. It does not create a second Campaign aggregate, duplicate focused field contracts, or redefine Product/Brief/Discovery/Applicants/Reporting/Share semantics.

The same `UceCampaign` aggregate and Campaign definition are used across Create, Edit, View and the operational Campaign Page.

## 2. Authority

Use the canonical authority stack from `campaign/README.md`. For Campaign-definition behavior specifically:

1. `campaign/create_campaign/field_object_contract.yaml`
2. `campaign/create_campaign/field_validation_reconciliation.md`
3. `campaign/create_campaign/runtime_contract.yaml`
4. `backend/validation/**`
5. `campaign/backend/implementation_map.md`
6. `campaign/frontend/view_dto_api_contract.md`
7. `campaign/frontend/state_map.md`
8. focused contracts under `campaign/**`

This bridge resolves ownership and journey; it does not override more-specific frozen behavior.

## 3. One Campaign definition

Create Campaign, Edit Campaign and Campaign Details/View operate over one Campaign definition composed of:

- Campaign strategy;
- creator strategy/targeting;
- commercial policy.

Do not create separate Create and Edit field models. Differences are runtime capability/editability rules, lifecycle and creation-source policy.

System-derived fields such as KPI resolution and Campaign commercial currency remain system/domain-owned even when displayed in Create/Edit/View.

## 4. Manual Campaign journey

### 4.1 Create

Manual Campaign creation begins/resumes a persisted `DRAFT`.

The user progresses through the frozen Create Campaign steps with:

- validation on field exit for entered values;
- current-step validation on `Next`;
- aggregate validation on Publish;
- autosave/resume of accepted valid Draft values.

Untouched future required fields do not surface premature errors.

### 4.2 Publish

Successful manual Publish transitions:

`DRAFT -> PUBLISHED`

Publish does not require Product or Brief.

After Publish:

- navigate to the Campaign Page;
- Campaign Page resolves Product Setup when no active Campaign Asset exists;
- Add Product becomes the primary next action.

### 4.3 Product setup

Adding a valid Campaign Asset moves the Campaign Page from Product Setup to Brief Setup when no execution-ready Brief path exists.

Product semantics remain owned by `campaign/add_product/` and `OpportunityService`.

### 4.4 Brief setup

Adding/publishing a Brief is governed by `campaign/add_brief/` and `OpportunityService`.

When frozen execution-readiness conditions become true, Campaign runtime may transition:

`PUBLISHED -> LIVE`

The frontend does not derive or force this transition.

### 4.5 Operational Campaign

Once `LIVE`, Campaign Page becomes the operational surface over canonical Campaign entities and capabilities, including Discovery, Applicants, Reporting, Share and later independently owned Collaboration references.

## 5. AI-recommended Campaign journey

An AI Campaign recommendation is not a persisted Campaign Draft before final launch.

The acceptance flow remains:

1. review Campaign economics;
2. review Product;
3. review Brief;
4. Launch Campaign.

Successful launch atomically creates/accepts:

- Campaign;
- Campaign Asset/Product;
- Brief;

with `creationSource = AI_RECOMMENDED` and resulting Campaign lifecycle `LIVE` when the frozen launch conditions are satisfied.

Abandonment before launch creates no partial Campaign/Product/Brief state.

## 6. View Campaign

`View Campaign` / Campaign Details is a read-only projection of the accepted Campaign definition.

It should expose, as applicable:

- Campaign identity/name/status/creation source;
- strategy and publishing configuration;
- derived KPI display values;
- creator targeting/audience definition;
- commercial configuration and derived Campaign currency;
- lifecycle timestamps/provenance that are display-safe;
- supplied Edit and lifecycle capabilities.

The View surface never becomes an independent source of Campaign truth.

If Edit is available, the user enters the Edit Campaign workflow using the same Campaign field object.

## 7. Edit Campaign

Edit Campaign is capability-driven and backend-authoritative.

### Draft manual Campaign

Broad Campaign definition edits are allowed subject to field/step/aggregate validation.

### Published/Live/Paused manual Campaign

Editability follows the frozen field-level manual post-publish policies in `field_object_contract.yaml` and service-owned dependency checks.

### AI-recommended Campaign

Post-launch mutable Campaign fields remain limited to the already-frozen set:

- Campaign name;
- publishing window;
- creator following;
- commercial offer;
- total Campaign budget.

All other Create Campaign fields are locked unless a later canonical decision explicitly changes this rule.

### Completed/Archived Campaign

Campaign definition is view-only.

## 8. Read-after-write behavior

A successful Campaign definition edit must re-read authoritative Campaign projections rather than locally manufacture state.

Affected projections may include:

- Campaign Details;
- Campaign header;
- hydration/readiness outcome;
- Product/Brief setup focus;
- action capabilities;
- other affected summaries where a frozen dependency requires it.

## 9. Module boundaries

### Campaign owns

- Campaign definition and lifecycle;
- accepted Campaign values;
- Campaign Assets and Brief orchestration boundaries;
- Campaign Page composition/read models;
- CampaignCreator/Applications/Outreach/Share evidence;
- Campaign-facing accepted Reporting/Intelligence projections.

### Brand/other modules own

- Brand facts used as context, including country used for Campaign currency derivation;
- Product/Offering/Offer source records selected into Campaign Assets;
- Collaboration lifecycle and execution;
- Intelligence computation logic.

Campaign may consume these sources through explicit contracts but must not duplicate their ownership.

## 10. Campaign module state journey

Conceptually:

```text
MANUAL
Create/Resume Draft
      ↓
DRAFT
      ↓ Publish
PUBLISHED
      ↓
Product Setup
      ↓
Brief Setup
      ↓ execution ready
LIVE
      ↕
PAUSED
      ↓
COMPLETED
      ↓
ARCHIVED

AI RECOMMENDED
Recommendation Review
      ↓ final atomic launch
LIVE
```

Product Setup and Brief Setup are Campaign Page hydration outcomes, not new persisted lifecycle statuses.

## 11. Frontend implementation rule

The production frontend should reuse existing good Create Campaign/Add Product/Add Brief implementation where it conforms to the canonical contracts, adapting data/validation/state wiring rather than replacing mature UI without cause.

The new Campaign Page architecture may replace older crowded operational-page composition while preserving compatible production workflows/components.

The frontend must not reimplement Campaign business rules that are already represented by backend capabilities, validation or runtime services.

## 12. Phase 1C boundary

This contract completes the module-level semantic bridge. It does not yet reconcile historical executable Zod drift identified in Phase 1A. That executable reconciliation belongs to Phase 1D together with affected tests/fixtures and developer handoff.