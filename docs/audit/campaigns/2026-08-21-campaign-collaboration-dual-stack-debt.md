# Campaign + Collaboration dual-stack debt

**Date:** 2026-08-21  
**Scope:** Backend schema + services (with FE journey notes) after Campaign/Collaboration production integration  
**Status:** TRACKING ONLY — do not delete or collapse until end-to-end journeys are accepted  
**Related:** `docs/campaigns/Developer Handoff — Campaign Domain.md`, `docs/collaboration/product-docs/Collaboration Module — Developer Handoff.md`

---

## Intent

Keep a durable list of gaps and redundant schema/code found in the current Campaign + Collaboration build so we can retire dual stacks later — after create → apply → approve → collaborate works end-to-end on one coherent path.

**Not authorized by this doc:** dropping tables, removing endpoints, or rewriting Application/Provision wiring.

---

## Bottom line

The new UI and new runtime paths are real, but the system still runs:

1. **Two Campaign asset/brief models** (canonical vs legacy)
2. **Two Collaboration execution stacks** (Phase G vs older commercial/logistics/media)
3. **Two approve paths** with different outcomes (Application approve vs Pipeline approve)

That is the main gap — not missing screens.

---

## 1. Functional gaps (journey)

### 1.1 Canonical vs legacy Campaign data

| Canonical (Create Campaign / Campaign Page) | Legacy (apply / application / provision) |
|---|---|
| `UceCampaignAsset` | `UceCampaignProduct` |
| `CanonicalCampaignBrief` | `UceCampaignBrief` |
| `CanonicalBriefDeliverable` | `UceBriefDeliverable` |

Observed wiring:

- Brand UI authors **canonical** assets/briefs.
- Creator apply (`creator-uce`) still resolves **`uceCampaignBrief` / `uceCampaignProduct`**.
- `UceApplication.campaignAssetId` still FKs to **`UceCampaignProduct`** (schema notes pending Asset rename).
- Collaboration provision seeds deliverables from **`UceBriefDeliverable`**, not `CanonicalBriefDeliverable`.
- Campaign Page query hydrates **both** surfaces (`assets` + `products`).

**Cleanup later:** bridge or cut over Application / Apply / Provision to canonical IDs so Brand authoring and Creator apply share one model.

### 1.2 Application approve does not start Collaboration

| Path | Outcome |
|---|---|
| `POST .../applications/:id/approve` | Application → `APPROVED` only. No Collaboration provision. (G1R intentional.) |
| `POST .../pipeline/.../approve` | Calls `provisionFromApprovedApplication` with publishing applicability → chat/workspace. |

Campaign Page Applicants uses the applications path. Pipeline Applicants uses the pipeline path.

**Cleanup later:** either wire Application approve → provision (with explicit publishing-applicability UI), or stop presenting Approve as if it opens Collaboration.

### 1.3 What is already solid

- Create Campaign canonical wizard / draft / readiness
- Campaign Page shell + canonical asset/brief drawers
- Collaboration FE five-stage Execution Hub (desktop/mobile/context)
- New Collaboration BE stage services (negotiation → securement → fulfillment → production → publishing)
- Dual-stack is transitional coexistence, not accidental half-merge of Stitch UI alone

---

## 2. Schema redundancy (cleanup candidates)

### 2.1 Collaboration — new vs old execution tables

**Canonical (Phase G — FE command client):**

- `CollaborationCommercialAgreement`
- `CollaborationFulfillment` + issues
- `CollaborationDeliverableExecution` + submissions
- `CollaborationPublishingExecution` + evidence
- `CollaborationSettlement` / feedback / financial resolution / events / snapshot

**Legacy (still in schema; still written by `collaboration.service.ts`):**

- `CollaborationCommercial` (fixed 30/70-style fields)
- `CollaborationLogistics`
- `CollaborationMedia`
- `CollaborationFinalization`

FE hits fulfillment / deliverable / publishing / negotiation — not logistics/posting. Controller still exposes legacy routes.

**Cleanup later:** retire carefully once nothing reads/writes legacy tables.

### 2.2 Two Collaboration records for one deal

- `UceCampaignCollaboration` — pipeline / prospect / applicant row
- `Collaboration` — standalone workflow + chat

Linked via `ucePipelineCollaborationId` / `legacyPipelineCollaborationId`.

**Cleanup later:** one owner of lifecycle truth if Discovery/Applicants can sit on Application + Collaboration alone.

### 2.3 Dual stage columns on `Collaboration`

- `canonicalStage` (`NEGOTIATION` … `PUBLISHING_SETTLEMENT`)
- `currentStage` (`UceMilestoneStage`, e.g. `STAGE_4_CONTENT_REVIEW`)

Services write both.

**Cleanup later:** drop legacy stage field after pipeline consumers are gone.

### 2.4 Extra UCE collab satellites

Still on pipeline side:

- `UceCollaborationLogistics`
- `UceCollaborationContentDraft`
- `UceCollaborationLiveTelemetry`
- `UceCollaborationAuditLog`

Mostly superseded by Collaboration execution/events.

### 2.5 Campaign reporting / bridge (verify before touch)

- `UceCampaignReporting*`
- `IntegrationBridgeSignalLedger`

Older planner/reporting surfaces — confirm live consumers before any retirement.

---

## 3. Code redundancy (cleanup candidates)

| Area | Finding |
|---|---|
| `collaboration.service.ts` | Legacy commercial / logistics / media / finalization commands alongside newer stage services |
| `collaboration.controller.ts` | Mix of new + old endpoints; FE uses new ones |
| Brand UCE products vs assets | `brand-uce-product` + `brand-uce-campaign-asset` + `canonical-campaign-brief` |
| Brief services | Legacy `brand-uce-brief` **and** `canonical-campaign-brief` |
| Approve flows | Two approve APIs with different outcomes |

---

## 4. Suggested cleanup order (after E2E)

Track progress here; do not start until journeys are accepted.

- [ ] **Cut over Asset/Brief** — bridge canonical → legacy on write, or move Application/Apply/Provision to canonical IDs
- [ ] **Wire or clarify Application approve → provision** (publishing applicability explicit)
- [ ] **Retire legacy Collaboration tables/endpoints** (`Commercial` / `Logistics` / `Media` / `Finalization` + logistics/posting routes)
- [ ] **Collapse dual stage fields** on `Collaboration`
- [ ] **Evaluate retiring `UceCampaignCollaboration`** if pipeline can sit on Application + Collaboration
- [ ] **Verify reporting/bridge tables** still have live owners before any drop

---

## 5. Follow-ups (optional deeper audits)

- Exact call sites still writing legacy Collaboration tables
- Creator marketplace behaviour when only canonical briefs exist
- FE surface inventory: which Campaign Page tabs still hit legacy product/brief APIs

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-21 | Initial tracking audit after Campaign + Collaboration integration + dual-stack review |
