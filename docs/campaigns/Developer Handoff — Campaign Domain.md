# Developer Handoff — Campaign Domain
## Production Integration Status After Phase G / G2.2

### Purpose

This handoff explains the current implementation state of the three connected Campaign-domain modules:

1. **Create Campaign**
2. **Campaign Page**
3. **Collaboration**

The modules are at different frontend maturity stages.

The key distinction is:

**canonical/domain implementation → Phase G validation → Stitch/design reconciliation → final frontend implementation**

A module that has completed Stitch reconciliation has a final frontend implementation suitable for production reconciliation.

A module that has completed Phase G but **has not yet completed Stitch reconciliation** has valid domain/runtime/backend authority, but its current frontend should not automatically be treated as the final production UI.

No Stitch source artifacts need to be handed over to the production developer.

---

# 1. Current Status Summary

| Module | Phase G / G2.2 | Backend | Frontend | Stitch Reconciliation | Production Status |
|---|---|---|---|---|---|
| **Create Campaign** | Complete | Complete | Complete | **Complete** | Ready for production integration |
| **Campaign Page** | Complete through current Phase G authority | Substantial canonical runtime exists | Pre-Stitch frontend exists | **Not yet complete** | Backend/domain can be prepared; final frontend should wait |
| **Collaboration** | Handoff already completed through G2.2 | G2.2 handoff exists | G2.2 frontend exists | **Not yet started/completed** | Existing handoff remains valid; frontend will receive later reconciliation |

---

# 2. CREATE CAMPAIGN

## Status

**POST-STITCH RECONCILIATION**

Create Campaign has completed the full sequence:

**canonical Campaign definition  
→ frontend/backend implementation  
→ Phase G validation  
→ Stitch design work  
→ Codex frontend reconciliation  
→ G2 frontend refinement/acceptance  
→ final accepted implementation**

Therefore, unlike Campaign Page and Collaboration, the current Create Campaign frontend is the frontend that should be handed to the production developer.

---

## 2.1 Final Frontend Source

Repository:

`Piyush1087/creator-commerce-frontend-v2-clone`

Final implementation branch:

`feature/create-campaign-g2-ux`

Accepted final SHA:

`e9233cb3edec1aafdf2eabb56c130c06bc311baa`

This branch was subsequently fast-forwarded into the clone:

`development`

### Developer instruction

For Create Campaign frontend, use:

**`feature/create-campaign-g2-ux @ e9233cb3...`**

as the clean implementation boundary.

Do not use earlier Create Campaign frontend branches as the final implementation.

Do not use Stitch artifacts as implementation inputs.

---

## 2.2 Final Create Campaign Frontend Areas

The final implementation is primarily under:

`src/features/uce/`

The important final areas are:

### Canonical Campaign model

`src/features/uce/schemas/canonical-campaign-wizard-schema.ts`

`src/features/uce/types/campaign-wizard.ts`

`src/features/uce/contracts/brand-uce.contracts.ts`

### Canonical mapping

`src/features/uce/mappers/canonical-campaign-draft.ts`

`src/features/uce/mappers/map-wizard-to-canonical-payload.ts`

`src/features/uce/mappers/phase1-campaign-adapters.ts`

### Draft / autosave / readiness

`src/features/uce/api/canonical-campaign-draft-client.ts`

`src/features/uce/autosave/canonical-campaign-autosave-controller.ts`

`src/features/uce/readiness/canonical-campaign-readiness-controller.ts`

### Final wizard

`src/features/uce/components/CreateCampaignWizard.tsx`

`src/features/uce/components/create-campaign-frame/`

### Step 1 — Campaign Strategy

`src/features/uce/components/campaign-strategy/`

### Step 2 — Creator Strategy

`src/features/uce/components/creator-strategy/`

### Step 3 — Commercial Strategy

`src/features/uce/components/commercial-strategy/`

### Shared canonical selectors

`src/features/uce/components/AudienceAffinityPicker.tsx`

`src/features/uce/components/AudienceGeographyPicker.tsx`

`src/features/uce/canonical/audience-affinities.ts`

### Route integration

`src/pages/brand/uce/BrandUceCampaignCreatePage.tsx`

---

## 2.3 Final Backend Source

Repository:

`Piyush1087/creator-commerce-backend-v2-clone`

Final Campaign backend branch:

`feature/create-campaign-g2-readiness`

Accepted SHA:

`5d15fb5926ee981e945522b1eadcce70c0d1d7fe`

This implementation was subsequently incorporated into backend:

`development`

### Important backend areas

Canonical Campaign creation:

`src/features/brand-uce/canonical-campaign-create.controller.ts`

`src/features/brand-uce/services/canonical-campaign-create.service.ts`

Canonical schemas:

`src/features/brand-uce/schemas/canonical-campaign-wizard.schema.ts`

`src/features/brand-uce/schemas/canonical-campaign-draft.schema.ts`

`src/features/brand-uce/schemas/canonical-campaign-taxonomy.ts`

Readiness:

`src/features/brand-uce/services/canonical-campaign-readiness.resolver.ts`

`src/features/brand-uce/services/canonical-campaign-readiness.service.ts`

Draft read:

`src/features/brand-uce/services/canonical-campaign-draft-read.service.ts`

Shared Campaign controller/module:

`src/features/brand-uce/brand-uce.controller.ts`

`src/features/brand-uce/brand-uce.module.ts`

---

## 2.4 Database Changes

Production integration must also reconcile the Campaign Prisma changes.

Relevant migrations include:

`20260810120000_uce_campaign_status_published_live`

`20260810120100_uce_campaign_status_drop_active`

`20260811120000_uce_application_and_share`

`20260812170000_uce_campaign_canonical_definition`

and the Campaign-related changes in:

`prisma/schema.prisma`

Do not replace the production Prisma schema wholesale.

Reconcile these changes against the current production schema.

---

## 2.5 Additional Authority Required?

The production developer does **not** need another frontend implementation branch for Create Campaign.

However, if domain ambiguity arises during integration, canonical Campaign contracts are available in:

Repository:

`Piyush1087/dummy_tcs`

Relevant canonical areas:

`campaign/create_campaign/`

`campaign/canonical/`

`campaign/backend/`

These are **reference/authority documents**, not frontend code to merge.

---

# 3. CAMPAIGN PAGE

## Status

**PRE-STITCH RECONCILIATION**

Campaign Page has progressed substantially through canonical definition, backend/runtime work and Phase G reconciliation.

However:

**the current Campaign Page frontend has not yet gone through the same final Stitch → Codex reconciliation cycle that Create Campaign has completed.**

This distinction is important for production integration.

---

# 3.1 What Already Exists — Campaign Page Domain Authority

Canonical Campaign Page authority exists in `dummy_tcs`, including:

`campaign/campaign_page/shell_domain_contract.yaml`

`campaign/campaign_page/orchestration_contract.yaml`

`campaign/campaign_page/hydration_state_machine.yaml`

`campaign/campaign_page/lifecycle_readiness_contract.yaml`

`campaign/campaign_page/backend_schema_reconciliation.yaml`

`campaign/campaign_page/intelligence_reporting_contract.yaml`

`campaign/campaign_page/responsive_runtime_contract.yaml`

These define the intended Campaign Page domain/runtime behavior.

They remain useful after the later visual reconciliation.

---

# 3.2 What Already Exists — Campaign Page Frontend

A functional/canonical Campaign Page frontend already exists in:

Repository:

`Piyush1087/creator-commerce-frontend-v2-clone`

Current Campaign Page implementation areas include:

`src/features/uce/campaign-page/CanonicalCampaignPage.tsx`

`src/features/uce/campaign-page/types.ts`

`src/features/uce/campaign-page/campaign-page.css`

and:

`CampaignDetailsDrawer.tsx`

`CreatorCard.tsx`

`CreatorProfileDrawer.tsx`

`OutreachComposerDrawer.tsx`

`ReportingDrawer.tsx`

with route integration through:

`src/pages/brand/uce/BrandUceCampaignDetailPage.tsx`

`src/pages/brand/uce/BrandUceCampaignDetailPage.css`

### Important

These files represent the **current pre-Stitch Campaign Page implementation**.

They are useful for:

- understanding runtime behavior;
- API integration;
- Campaign Page state;
- domain boundaries;
- backend integration;
- preparing production reconciliation.

They should **not yet be treated as the final Campaign Page UI pickup**.

---

# 3.3 Campaign Page Backend

Unlike the frontend visual layer, significant Campaign Page backend/runtime work already exists and is shared with the canonical Campaign architecture.

Relevant backend implementation is in:

`Piyush1087/creator-commerce-backend-v2-clone`

primarily:

`src/features/brand-uce/services/campaign-query.service.ts`

`src/features/brand-uce/services/campaign-query.hydration.ts`

`src/features/brand-uce/services/campaign-command.service.ts`

`src/features/brand-uce/services/campaign-application.service.ts`

plus:

`brand-uce.controller.ts`

`brand-uce.module.ts`

and Campaign validation/schema infrastructure.

This backend work should not be discarded when Campaign Page later undergoes Stitch reconciliation.

The expected later work is primarily a **frontend reconciliation against the already-established Campaign authority/runtime**, not a restart of the Campaign Page domain.

---

# 3.4 Phase G Campaign Page Reconciliation

There is also a frontend clone branch:

`phase-g/campaign-page-reconciliation`

This contains the later Phase G Campaign Page authority/reconciliation work.

It should be treated as:

**authority/history**

rather than the final production UI branch.

Do not merge this branch wholesale into production.

---

# 3.5 What Happens After Campaign Page Stitch Reconciliation?

Campaign Page will undergo the same general pattern already completed for Create Campaign:

**existing canonical/runtime implementation  
+ approved design output  
→ Codex reconciliation  
→ validation  
→ final frontend implementation**

When that happens, the developer should expect a **new identifiable frontend integration node**.

That node may be either:

- a dedicated reconciliation branch; or
- a dedicated accepted commit/SHA subsequently fast-forwarded into `development`.

The important requirement is not the branch name itself.

The requirement is that we freeze an explicit:

**repository + branch + accepted SHA**

for the post-Stitch Campaign Page frontend.

That new accepted node will supersede the current pre-Stitch Campaign Page frontend as the production UI pickup source.

The existing backend/domain authority should remain substantially reusable.

---

# 4. COLLABORATION

## Status

**PHASE G / G2.2 HANDOFF COMPLETE**

**STITCH RECONCILIATION NOT YET COMPLETED**

Collaboration has already received its separate developer handoff through G2.2.

That handoff remains the current authority for:

- Collaboration domain;
- backend;
- workflow;
- state;
- integration contracts;
- current frontend implementation.

Do not replace that handoff with this Campaign handoff.

---

# 4.1 What Is Still Pending for Collaboration?

The remaining major frontend stage is:

**Stitch/design reconciliation → Codex frontend reconciliation**

Therefore the current G2.2 Collaboration frontend should be understood as:

**functionally/canonically accepted, but pre-final-design-reconciliation.**

---

# 4.2 What Happens After Collaboration Stitch Reconciliation?

As with Campaign Page, once Collaboration is reconciled against the approved design, we should freeze a **new frontend integration node**.

The developer should then receive:

**frontend repository  
+ reconciliation branch  
+ accepted SHA  
+ final changed-file manifest**

That post-reconciliation frontend node will become the final UI source for production integration.

The existing G2.2 Collaboration handoff remains useful because the underlying:

- domain;
- backend;
- state machine;
- workflow;
- API boundaries;
- validation;
- financial/commercial boundaries

should not be recreated during visual reconciliation.

---

# 5. Expected Frontend Node Strategy

For clarity going forward, production handoff should follow this convention.

## Create Campaign

Final node already exists:

`creator-commerce-frontend-v2-clone`

→ `feature/create-campaign-g2-ux`

→ `e9233cb3edec1aafdf2eabb56c130c06bc311baa`

**Status: FINAL POST-RECONCILIATION FRONTEND**

---

## Campaign Page

Current implementation:

`creator-commerce-frontend-v2-clone`

→ current Campaign Page implementation / Phase G authority

**Status: PRE-STITCH FRONTEND**

After reconciliation we will freeze a new explicit node, conceptually:

`creator-commerce-frontend-v2-clone`

→ `[campaign-page post-Stitch reconciliation branch]`

→ `[accepted SHA]`

**Status after that: FINAL POST-RECONCILIATION FRONTEND**

---

## Collaboration

Current G2.2 implementation:

existing Collaboration handoff

**Status: PRE-STITCH FRONTEND**

After reconciliation we will similarly freeze:

`[Collaboration frontend repository]`

→ `[Collaboration post-Stitch reconciliation branch]`

→ `[accepted SHA]`

**Status after that: FINAL POST-RECONCILIATION FRONTEND**

---

# 6. What the Developer Should Integrate Now

### Create Campaign

**Yes — frontend + backend can now be taken forward for production reconciliation.**

Frontend source:

`creator-commerce-frontend-v2-clone`
→ `feature/create-campaign-g2-ux`
→ `e9233cb3...`

Backend source:

`creator-commerce-backend-v2-clone`
→ `feature/create-campaign-g2-readiness`
→ `5d15fb5...`

Also reconcile the required Prisma migrations and Campaign compatibility changes.

---

### Campaign Page

**Do not freeze the current frontend as the final production UI yet.**

The developer may review/prepare:

- backend;
- schema;
- API;
- query;
- command;
- domain integration.

But the final frontend pickup should be supplied after Campaign Page Stitch reconciliation.

---

### Collaboration

Use the **existing G2.2 handoff** for the current domain/backend/runtime state.

Do not treat its current frontend as the final post-design-reconciliation UI.

A later frontend reconciliation node will be supplied after Collaboration Stitch reconciliation.

---

# 7. Key Rule for Production

The three modules should therefore be understood as:

**Create Campaign**
→ final domain  
→ final backend  
→ **final post-Stitch frontend**

**Campaign Page**
→ final/reconciled domain authority  
→ substantial backend/runtime  
→ **current pre-Stitch frontend**  
→ post-Stitch frontend still pending

**Collaboration**
→ G2.2 domain/backend/runtime handoff complete  
→ **current pre-Stitch frontend**  
→ post-Stitch frontend still pending

This distinction prevents production from integrating an intermediate Campaign Page or Collaboration frontend and later mistaking it for the final reconciled implementation.