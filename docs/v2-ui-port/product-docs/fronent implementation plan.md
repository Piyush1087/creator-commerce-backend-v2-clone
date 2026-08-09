Yes. Once the Stitch-generated UI state is already inside Antigravity/Codex, I would **not immediately start wiring components directly to Prisma/database models**.

We should treat what we built in GitHub as the **domain/schema specification**, and create a controlled application layer between UI and persistence.

The implementation sequence I recommend is:

Frozen GitHub contracts \+ campaign\_schema.prisma v1.8  
                         ↓  
             Backend implementation  
                         ↓  
                  API contracts  
                         ↓  
              Frontend data layer  
                         ↓  
             Stitch UI components

For the Campaign Page specifically, I would work through **8 steps**.

### **Step 1 — Reconcile the imported UI against our frozen Campaign domain**

First, Codex/Antigravity should inspect the imported Stitch code and map every visible UI element/action to the frozen backend entities.

For example:

Campaign Page  
│  
├── Campaign Header  
│     → UceCampaign  
│  
├── Campaign Strategy  
│     → campaign strategy fields  
│  
├── Products  
│     → CampaignAsset  
│  
├── Briefs  
│     → Brief  
│  
├── Discovery  
│     → CampaignCreator  
│  
├── Outreach  
│     → UceOutreach  
│  
├── Applicants  
│     → UceApplication  
│  
├── Reporting Card  
│     → UceCampaignReport  
│  
├── Share  
│     → UceCampaignShare  
│  
└── Collaborations  
      → separate module / mapped into Campaign UI

This prevents Stitch's component structure from accidentally becoming our data architecture.

**Output:** `campaign_page_ui_backend_mapping.md`

No code wiring yet.

---

### **Step 2 — Turn `campaign_schema.prisma v1.8` into the real database layer**

Right now `campaign_schema.prisma` is our frozen working schema/specification.

Before the frontend can consume it, Codex needs to reconcile it against the application's **actual Prisma schema/database**.

That means:

campaign\_schema.prisma v1.8  
          ↓  
compare against production schema.prisma  
          ↓  
resolve naming / existing relations  
          ↓  
merge required models/enums  
          ↓  
Prisma migration  
          ↓  
generate Prisma client

This is important: **don't simply copy `campaign_schema.prisma` wholesale into production** if the repository already has existing User, Brand, Creator, Product, authentication, etc. models.

We reconcile it.

**Output:** actual DB migration \+ updated production Prisma schema.

---

### **Step 3 — Build the backend service/domain layer**

Then implement services around the schema.

For example:

campaign.service  
campaignAsset.service  
brief.service

discovery.service  
outreach.service  
application.service

reporting.service  
share.service

These services enforce the runtime rules that Prisma cannot.

Example from Share:

executeShare()  
    ↓  
validate Campaign is shareable  
    ↓  
generate tracking token  
    ↓  
create CampaignShare

Example from Applicants:

createApplication()  
    ↓  
validate creator  
    ↓  
validate max 2 applications / Campaign  
    ↓  
validate max 5 applications / Brand  
    ↓  
validate Product \+ Brief  
    ↓  
create Application

This is where all the **frozen invariants from our GitHub contracts become executable rules**.

That is a critical step.

---

### **Step 4 — Define the Campaign Page API contract**

I would **not expose Prisma objects directly to the frontend**.

Instead create explicit API DTOs/contracts.

For the initial Campaign Page load, for example:

GET /campaigns/:campaignId

could return a Campaign Page projection:

{  
  "campaign": {},  
  "strategy": {},  
  "products": \[\],  
  "briefs": \[\],  
  "discoverySummary": {},  
  "applicantsSummary": {},  
  "reporting": {},  
  "permissions": {}  
}

Then separate workspace endpoints handle heavier collections/actions:

GET /campaigns/:id/discovery  
GET /campaigns/:id/applications  
GET /campaigns/:id/report

POST /campaigns/:id/share

POST /campaign-creators/:id/outreach  
POST /applications/:id/approve  
POST /applications/:id/reject

We should decide **what belongs in the initial Campaign Page payload versus lazy-loaded workspace data**.

Otherwise the frontend will gradually become coupled to the database.

**Output:** `campaign_page_api_contract.md`

---

### **Step 5 — Build the frontend data/access layer**

Now we connect frontend code to those APIs.

The Stitch components should **not contain fetch/database logic directly**.

Instead:

Stitch component  
      ↓  
Campaign frontend hook/service  
      ↓  
API  
      ↓  
Backend service  
      ↓  
Prisma

For example:

useCampaign(campaignId)

useCampaignDiscovery(campaignId)

useCampaignApplicants(campaignId)

useCampaignReport(campaignId)

shareCampaign(campaignId, channel)

Then the Stitch-generated component becomes mostly:

data  
loading  
error  
actions

rather than knowing anything about backend architecture.

---

### **Step 6 — Build all UI states against the real contracts**

This is where your proposed **“build the rest of the states inside Antigravity/Codex”** fits best.

Once the API types/contracts exist, Codex can convert the single Stitch visual into the complete state machine.

For example, Applicants may need:

Loading  
↓  
Empty  
↓  
Applications available  
↓  
Application selected  
↓  
Approved  
↓  
Rejected  
↓  
Withdrawn  
↓  
Error

Discovery similarly has its own frozen states.

Reporting:

No Report yet  
Partial  
Available  
Stale last-known-good

Share:

Closed  
↓  
Open  
↓  
Channel selected  
↓  
Composed  
↓  
Share initiated / copied  
↓  
Closed

The important change from your original sequence is subtle:

> **Don't build all UI states first and connect the backend afterward.**

Instead:

1 Stitch reference state  
        ↓  
domain mapping  
        ↓  
API contract  
        ↓  
frontend types  
        ↓  
build remaining states

Then every new state is being built against reality rather than mocked assumptions.

---

### **Step 7 — Wire mutations/actions**

After reads work, wire actions one domain at a time.

I would do:

Campaign basic actions  
        ↓  
Products / Briefs  
        ↓  
Discovery  
        ↓  
Outreach  
        ↓  
Applicants  
        ↓  
Share  
        ↓  
Reporting reads

For each mutation:

User action  
    ↓  
frontend validation  
    ↓  
API request  
    ↓  
backend/domain validation  
    ↓  
transaction  
    ↓  
response  
    ↓  
frontend cache/state update

Frontend validation improves UX.

**Backend validation remains authoritative.**

For example, the frontend may disable `Withdraw Application`, but the backend must still reject withdrawal if the Brand has already approved/rejected that Application.

---

### **Step 8 — End-to-end contract validation**

Finally, run scenario tests based on the contracts we've frozen.

Not merely:

> Does the button work?

But:

CampaignCreator manually added  
→ Marketplace enrichment occurs  
→ Recommendation becomes available  
→ Outreach Email selected  
→ tracking URL generated  
→ click occurs  
→ creator applies  
→ Application appears  
→ Match Score arrives from Intelligence  
→ Brand approves  
→ Application becomes immutable

And edge cases:

Campaign paused  
→ Outreach blocked

Campaign has no active Product+Brief  
→ Outreach blocked

Creator reaches 2 Campaign applications  
→ third application blocked

Application withdrawn  
→ historical card remains

Report refresh fails  
→ last-known-good Report remains

Share copied  
→ CampaignShare created  
→ click recorded

This validates **the product contract**, not just individual APIs.

---

## **So I would slightly modify your proposed implementation flow**

Instead of:

1\. Stitch UI  
2\. Import into Codex  
3\. Build every remaining UI state  
4\. Connect backend

I recommend:

1\. Design 1–2 canonical states in Stitch

2\. Import into Codex / Antigravity

3\. UI ↔ frozen-domain reconciliation  
   → map components/actions to backend entities

4\. Production DB reconciliation  
   → v1.8 → actual Prisma schema  
   → migration

5\. Implement backend services  
   → frozen business rules become executable

6\. Freeze API contracts  
   → frontend-facing DTOs/actions

7\. Build frontend data layer  
   → hooks/services/API client

8\. Build remaining UI states in Codex  
   → now using actual API types/contracts

9\. Wire reads

10\. Wire mutations/actions

11\. Connect Intelligence-owned outputs  
    → Discovery recommendation  
    → Applicant AI Match Score  
    → Reporting  
    etc.

12\. End-to-end scenario validation

The key architectural rule I'd keep throughout is:

> **Stitch owns visual reference. Frontend owns interaction/state. API owns the frontend/backend contract. Domain services own business rules. Prisma owns persistence shape. Intelligence Engine owns intelligence calculations.**

That separation is especially important for this Campaign Page because we have spent substantial effort freezing the domain rules. If we let Codex wire Stitch components straight to Prisma, a lot of that work gets bypassed.

When you have the **first Stitch Campaign Page state imported into the repo**, I suggest we start with **Step 1: UI ↔ Frozen Domain Reconciliation** before asking Codex to modify anything. That can become the implementation bridge between all the frozen artifacts we've created and the actual frontend code.

