# Campaign Backend — Create/Edit/View Module Runtime Bridge

**Status:** CANONICAL / PHASE 1C

This artifact supplements `campaign/backend/implementation_map.md` with the module-level Campaign-definition flow. It does not replace service ownership, transactions, concurrency, or focused Campaign contracts.

## 1. CampaignService ownership

`CampaignService` owns:

- manual Campaign Draft create/resume/update;
- Campaign definition publication;
- Campaign definition edits after publish where capability permits;
- Campaign lifecycle transitions owned by Campaign;
- authoritative Campaign definition read inputs supplied to `CampaignQueryService`.

`CampaignService` must enforce creation-source/lifecycle editability from the frozen Create/Edit runtime contract. Frontend field disabling is not the enforcement boundary.

## 2. Manual Draft behavior

A Draft may be incomplete.

Accepted persisted Campaign field values must satisfy the relevant canonical field validation. Invalid local form input should not overwrite the last accepted canonical value merely because autosave is active.

Draft updates may be partial. Step-completion validation is a frontend/application interaction boundary, while publish readiness is backend-authoritative aggregate validation.

## 3. Derived Campaign-definition values

Campaign owns deterministic resolution of fields frozen as system-derived, including:

- primary/supporting KPI resolution from Campaign objective using the canonical KPI framework;
- Campaign commercial currency from Brand country under the frozen Campaign policy.

These values may be returned to the frontend but must not become independent Brand-authored source fields.

Brand country remains Brand-owned context.

## 4. Publish and setup handoff

Manual publish validates the complete Campaign definition and transitions `DRAFT -> PUBLISHED` atomically.

Product and Brief are not required for manual Campaign publication.

After publication, `CampaignQueryService` resolves the existing Campaign Page hydration outcome. Product/Brief setup remains owned by Campaign Page hydration + `OpportunityService`; `CampaignService` must not create a duplicate setup state model.

When frozen execution-readiness conditions become true, downstream Campaign runtime owns `PUBLISHED -> LIVE`.

## 5. Edit Campaign

Post-publish Edit accepts only fields permitted by the authoritative creation-source/lifecycle policy.

For manual Campaigns, use the field-level policies in `field_object_contract.yaml`, including dependency checks such as archetype removal affecting dependent Briefs.

For AI-recommended Campaigns after launch, mutable Campaign-definition fields remain limited to:

- Campaign name;
- publishing window;
- creator following;
- commercial offer;
- total Campaign budget.

Completed/Archived Campaign definitions are read-only.

A successful edit returns or triggers re-read of authoritative Campaign projections/capabilities. Do not make the frontend infer resulting readiness or action legality.

## 6. View Campaign

Campaign Details/View is a query/read projection, not a separate aggregate or mutation model.

`CampaignQueryService` composes display-safe accepted Campaign definition values, lifecycle/provenance and server-derived capabilities. Edit is offered only when backend capability permits it.

## 7. AI-recommended launch

The existing AI-recommended Campaign review/launch semantics remain unchanged: no Campaign Draft is persisted before final launch; launch atomically creates/accepts Campaign + Product + Brief and preserves recommendation provenance. Partial creation is forbidden.

## 8. Executable reconciliation boundary

Historical Zod drift identified in Phase 1A must be reconciled in Phase 1D. In particular, executable contracts must stop treating system-derived KPI/currency as Brand-owned authority and must enforce the frozen field constraints without breaking the verified Campaign Page staging package.

No Prisma structural migration is implied solely by this module bridge; storage enum names may remain where explicit translation is sufficient.