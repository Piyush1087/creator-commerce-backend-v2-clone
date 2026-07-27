# Co-Pilot module access guide (natural language)

**Audience:** Product, QA, support, engineering  
**Purpose:** Plain-language summary of what the brand co-pilot can **read** vs **change** in each platform module.  
**Technical matrix:** [DATA_ACCESS_CONTRACT.md](./DATA_ACCESS_CONTRACT.md) · [`data-access.contract.ts`](../../../src/features/co-pilot/contracts/data-access.contract.ts)

---

## How to read this guide

- **Read** — The co-pilot may answer questions using live data from that module. Nothing is saved unless stated otherwise.
- **Write (confirm required)** — The co-pilot may **stage** a change in chat. The user must review an on-screen confirmation card and click approve. Nothing is saved until they confirm.
- **Not allowed** — The co-pilot must not change this data in chat (today). It may still **read** where noted.
- **Planned** — Product docs describe it; engineering has not wired it yet.

The co-pilot never moves money, edits DNA, or creates campaigns **silently**. All allowed writes go through **confirm / discard** in the chat.

---

## Brand Centre — Tab 1: Brand DNA

**Scope in chat:** Brand Centre  
**Status:** Read live · limited writes live

### What you can read

- Brand name, tagline, tone, audience summary, offering counts, scan status
- Profile completeness and overview metrics (often shown as a metric grid)
- **Compliance “do-not-say” words** — phrases the brand must avoid in marketing copy
- Personas, products, competitors, and offers **as summaries** (persona table on request; not full admin CRUD in chat)

Example questions: *“Give me a Brand Centre overview”*, *“What are our do-not-say words?”*, *“What is incomplete in our profile?”*

### What you can write (confirm required)

| Action | What happens after confirm |
| --- | --- |
| **Update visual identity** | Adds/updates aesthetic styles and primary font (e.g. “modern minimalist”, “Inter”) |
| **Update a product short description** | Changes the **description** field on one existing offering (must match product name in Brand DNA) |
| **Create a new persona** | Creates a new audience persona with name, age range, and interest focus |

### What you cannot write via co-pilot

- Brand name, handles, website, industry, or lifecycle stage
- Full narrative rewrites (USPs, tone lists, do-not-say list edits)
- Competitor or offer create/delete
- Budget ceiling or budget mix changes
- Bulk “replace entire Brand DNA” operations

---

## Brand Centre — Tab 2: Intelligence & Gaps

**Scope in chat:** Brand Centre (bundled with Tab 1 reads)  
**Status:** Read live · move-to-planner HITL live

### What you can read

- Intelligence scan availability (pending vs ready)
- Active performance leaks / gaps as a **table** (title, bucket, priority, planner status)
- Audience **persona breakdown** table (age range, interests, psychographics)
- **Competitor creative streaks** and share-of-voice summary
- Launch readiness narrative combining DNA completeness + intelligence gaps

Example questions: *“What should we fix before UCE launch?”*, *“What funnel leaks do we have?”*

### What you can write (confirm required)

- **Send leak to Campaign Planner** — HITL confirm → `move-to-planner` → async `PLANNER_AGGREGATE` job; SSE status on `hitl/confirm/stream`

### Planned (not live)

- Trigger an on-demand competitor deep-scan

---

## Brand Centre — Tab 3: Campaign Planner

**Scope in chat:** Brand Centre  
**Status:** Read + launch HITL live

### What you can read

- Draft pipeline table (card hook, type, status, objective, tier)
- Pending vs approved counts

Example: *“How many campaign blueprints are pending in my planner?”*

### What you can write (confirm required)

- **Approve & create draft campaign** — HITL confirm → planner approve + bridge → UCE **DRAFT** with products/briefs

### Planned

- Purge expired planner cards (UI discard disabled today)

---

## Universal Campaign Engine (UCE)

**Scope in chat:** Campaign List module (`uce-campaign-list`) + draft launch paths  
**Status:** Campaign List reads live · lifecycle HITL live · create/edit DRAFT live

### What you can read

- **All campaigns** — list / search / filter / sort as a table
- **Campaign summary, performance, financials** — metric grids
- **Compare campaigns** — side-by-side table
- **DRAFT campaigns only** — still available via “list my drafts”

### What you can write (confirm required)

| Action | What happens after confirm |
| --- | --- |
| **Launch a campaign** (slot fill) | Creates a **DRAFT** via UCE wizard |
| **Launch planner card** | Approve planner + bridge → UCE **DRAFT** |
| **Edit draft campaign** | Name/budget/objective on **DRAFT** only |
| **Pause / Resume** | Status ACTIVE↔PAUSED (resume re-checks activation checklist) |
| **Archive** | Sets status to **ARCHIVED** |
| **Duplicate** | Clones strategy/targeting/commercials/products/briefs into a new **DRAFT** |
| **Bulk pause/resume/archive** | Runs the action across selected campaign ids |

### What you cannot write via co-pilot

- Promote campaign phase (Cold Start → Self-Healing)
- Escrow lock/refund from Campaign List chat (separate module, deferred)

---

## Escrow & ledger

**Scope in chat:** Escrow (intent chip or escrow/ledger wording)  
**Status:** Read live · financial writes planned

### What you can read

- Vault balances: available, locked campaign funds, total pooled, **TDS tax buffer**
- Recent **ledger entries** (transaction type, amount, status, reference) in a table
- Financial audit-style summaries

Example questions: *“Give me a full financial audit report for my campaign ledger”*, *“How much is in our TDS buffer?”*

Requires an initialized escrow vault for full data; otherwise the co-pilot explains that the vault is not set up.

### What you can write (confirm required)

**None wired today.**

### Planned (product docs)

- Authorize escrow lock for a contract
- Release milestone tranche to creator
- Process contract cancellation / refund

These will use the same **review → confirm** pattern when built.

---

## Collaborations (creator contracts)

**Scope in chat:** Global / collaboration wording  
**Status:** Read live · workflow writes planned

### What you can read

- Active collaborations in a pipeline table (creator, campaign, stage, fulfillment issues)
- Counts stuck in logistics or content review stages
- Collaborations with fulfillment issues flagged

Example questions: *“Show creators stuck in Logistics or Production”*, *“List collaborations with fulfillment issues”*

### What you can write (confirm required)

**None wired today.**

### Planned (product docs)

- Submit counter-offer during negotiation
- Mark shipment / tracking for logistics
- Approve or reject submitted creator content (with revision limits)

---

## Pricing & co-pilot usage

**Scope in chat:** Automatic (not a user-facing “module”)  
**Status:** Read live · enforces limits

### What you can read

- How many co-pilot turns remain this billing period
- Warning when usage crosses **80%** and **95%** of plan limit
- Plan tier (via usage API)

The dashboard shows a usage banner; at **100%** the composer is disabled until the period resets or the plan is upgraded.

### What you can write (confirm required)

**None** — co-pilot does not change subscription or billing from chat.

---

## Co-pilot session (chat itself)

**Scope:** Internal to the chat feature  
**Status:** Live

### What you can read

- Your own thread history (grouped by Today / Previous 7 days / Last month / Older)
- Past messages and generated UI in each thread

### What the system writes (not “brand data”)

- New threads and messages when you send prompts
- Temporary **slot-fill** state while you complete a staged action (e.g. campaign budget)
- **Thumbs up / thumbs down** feedback on assistant replies (you submit; stored for quality tracking)

### What you cannot do

- Read another brand’s threads
- Edit or delete individual messages after send (archive/thread APIs are limited today)

---

## Analytics (deferred scope)

**Status:** Not wired

### What you can read

**Nothing via co-pilot today.**

### What you can write

**Nothing.**

Planned for a later module slice (funnel charts, ROAS projections, etc.).

---

## Always blocked (all modules)

Regardless of module, the co-pilot **must refuse** to:

- Explain internal matching weights, backend architecture, or secret fee formulas
- Answer off-domain topics (general coding, politics, weather, etc.)
- Execute any write **without** a confirmation step
- Bypass plan usage limits (`MAX_AI_CHATS`)

Moderation blocks are logged; they do **not** consume a co-pilot turn.

---

## Quick reference table

| Module | Read in chat | Write in chat (confirm required) |
| --- | --- | --- |
| Brand DNA (Tab 1) | Yes | Visual identity, one offering description, new persona |
| Intelligence (Tab 2) | Yes | Move leak to planner (HITL + async SSE) |
| Planner (Tab 3) | Yes | Approve + bridge → UCE DRAFT |
| UCE campaigns | DRAFT list | Draft create (shortcut or planner), edit DRAFT only |
| Escrow | Yes | — (planned: lock, release, refund) |
| Collaborations | Yes | — (planned: counter-offer, shipment, review) |
| Pricing / usage | Yes (meter) | — |
| Chat session | Yes (history) | Feedback only |
| Analytics | — | — |

---

## Keeping this doc accurate

When access changes, update **all three**:

1. [`data-access.contract.ts`](../../../src/features/co-pilot/contracts/data-access.contract.ts)
2. [DATA_ACCESS_CONTRACT.md](./DATA_ACCESS_CONTRACT.md) (technical)
3. This file (natural language)

See [progress/PROGRESS.md](../progress/PROGRESS.md) for what shipped vs in progress.
