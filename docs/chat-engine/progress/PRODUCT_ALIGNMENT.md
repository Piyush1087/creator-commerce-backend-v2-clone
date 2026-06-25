# Chat Engine — product doc alignment (current journey)

**Last updated:** 2026-06-11  
**Product source:** [`product-docs/`](../product-docs/) (read-only reference)  
**Shipped scope:** [`PROGRESS.md`](./PROGRESS.md) · Phase 1 Brand Centre + escrow/collab reads + UCE DRAFT paths

Legend: **Done** · **Partial** (core behaviour, not full product UI widget) · **Deferred** (later journey) · **N/A** (out of brand co-pilot v1)

---

## Core platform pillars (`core-functionality.md`)

| Pillar | Product | Implementation |
| --- | --- | --- |
| Summarization & queries | Automated reads + generative UI | **Done** — deterministic routes + Gemini fallback |
| Workflow execution (HITL) | Confirm before writes | **Done** — `INTERACTIVE_EXECUTION_WIDGET` + `/hitl/confirm` |
| Thread history rail | Left drawer, temporal groups | **Done** — `CoPilotThreadRail` |
| Auto thread titles | From first prompt | **Done** — `deriveTitleFromPrompt` |
| Entity-bound threads | Linked to campaign_id | **Deferred** |
| Moderation / guardrails | Input block + output sanitize | **Partial** — regex layer; no external moderation API |
| Explicit feedback | Thumbs up/down per response | **Done** — `CoPilotMessageFeedback` + API |
| Regenerate | Re-run last response | **Deferred** |
| Usage quotas | 80% warning, block at 100% | **Done** — `CoPilotUsageBanner` + `MAX_AI_CHATS` |
| Attachments (image/PDF/CSV) | Multimodal intake | **Deferred** — Phase 2 |
| SSE streaming | Token/narrative stream | **Done** |
| Generative UI (not markdown-only) | Structured payloads | **Done** — 5 of 6 format types |

---

## Result formats (`result-format-architecture.md`)

| `formatType` | Product | Backend | Frontend |
| --- | --- | --- | --- |
| `CONVERSATIONAL_NARRATIVE` | Yes | **Done** | **Done** |
| `METRIC_HIGHLIGHT_GRID` | Yes | **Done** | **Done** |
| `TABULAR_AUDIT_DATA` | Yes | **Done** | **Done** |
| `SLOT_FILLING_CLARIFICATION` | Yes | **Done** | **Done** |
| `INTERACTIVE_EXECUTION_WIDGET` | Yes | **Done** | **Done** |
| `POLYMORPHIC_ENTITY_CAROUSEL` | Yes | **Deferred** | **Deferred** |

Slot-filling state machine: **Done** — `CoPilotSlotSession` + merge on follow-up messages.

---

## Use-case matrix (`platform-use-case-matrix.md`)

### §1 Brand DNA (Tab 1)

| Use case | Status | Notes |
| --- | --- | --- |
| Brand positioning synthesis | **Partial** | Overview narrative + metric grid; no PillGroup typography widget |
| Audience persona breakdown | **Done** | `BRAND_CENTRE_PERSONAS` → table |
| Compliance do-not-say audit | **Done** | `DNA_COMPLIANCE` |
| Visual identity read | **Done** | `BRAND_CENTRE_VISUAL_IDENTITY` |
| DNA blocks / completeness | **Done** | `BRAND_CENTRE_DNA_BLOCKS`, `BRAND_CENTRE_COMPLETENESS` |
| Dynamic identity mutation (HITL) | **Done** | `DNA_IDENTITY_UPDATE` |
| Persona creation (HITL) | **Done** | `DNA_PERSONA_CREATE` |
| Offering description update (HITL) | **Done** | `DNA_OFFERING_UPDATE` |
| Inventory add/remove | **N/A** | Product example maps to description-only update |

### §2 Intelligence & Gaps (Tab 2)

| Use case | Status | Notes |
| --- | --- | --- |
| Funnel leak auditing | **Done** | `BRAND_CENTRE_LEAKS` → table (bucket, priority, planner status) |
| Competitor streaks summary | **Done** | `BRAND_CENTRE_COMPETITOR_INSIGHTS` narrative |
| Metric lift / ROAS projections | **Deferred** | No lift model in v1 intelligence API |
| On-demand competitor scan (write) | **Deferred** | Not in co-pilot |
| Move leak to planner (HITL) | **Done** | `INTELLIGENCE_MOVE_TO_PLANNER` + async SSE |

### §3 Campaign Planner (Tab 3)

| Use case | Status | Notes |
| --- | --- | --- |
| Draft pipeline status | **Done** | `PLANNER_PIPELINE` table |
| Strategic match inquiry (“why micro+nano”) | **Partial** | Gemini may answer; no dedicated deterministic route |
| Conversational brief generation | **Partial** | Via move-to-planner job, not inline accordion |
| Launch planner card → UCE DRAFT (HITL) | **Done** | `PLANNER_LAUNCH_DRAFT` + bridge |
| Mass purge expired cards | **Deferred** | Tab 3 purge HITL not built |

### §4 Universal Campaign Engine

| Use case | Status | Notes |
| --- | --- | --- |
| Active campaign portfolio snapshot | **Deferred** | DRAFT list only in Phase 1 |
| Polymorphic metric breakdown | **Deferred** | |
| Launch campaign shortcut (HITL) | **Done** | `CAMPAIGN_LAUNCH` → wizard DRAFT |
| Edit DRAFT campaign (HITL) | **Done** | `CAMPAIGN_EDIT_DRAFT` |
| Extend deadline / phase upgrade / pause | **Deferred** | Correctly denied for ACTIVE/PAUSED |

### §5 Influencer discovery

| Use case | Status | Notes |
| --- | --- | --- |
| Multi-criteria discovery | **Deferred** | Needs `POLYMORPHIC_ENTITY_CAROUSEL` |
| Visual aesthetic matching | **Deferred** | |
| Outreach / roster writes | **Deferred** | |

### §6 Collaboration

| Use case | Status | Notes |
| --- | --- | --- |
| Pipeline status audit | **Done** | `COLLAB_PIPELINE` table |
| Fulfillment / rejection issues | **Done** | `COLLAB_ISSUES` table |
| Counter-offer, shipment, media review writes | **Deferred** | |

### §7 Escrow

| Use case | Status | Notes |
| --- | --- | --- |
| Ledger audit | **Done** | `ESCROW_AUDIT` table + vault metrics |
| TDS buffer lookup | **Done** | `ESCROW_TDS` |
| Escrow setup guidance | **Done** | `ESCROW_SETUP` narrative |
| Lock / release / refund writes | **Deferred** | |

### §8 Settings & billing

| Use case | Status | Notes |
| --- | --- | --- |
| Usage quota introspection | **Done** | `/co-pilot/usage` + banner |
| Integration health | **Deferred** | |
| Tier upgrade / credential writes | **Deferred** | |

---

## UX rules (`platform-use-case-matrix.md` UI layer)

| Rule | Status | Notes |
| --- | --- | --- |
| Active Focus (one open action widget) | **Partial** | Backend blocks new writes while HITL pending; frontend does not collapse older widgets |
| Confirm right / discard left | **Done** | HITL action bar layout |
| Aurora design tokens | **Done** | Aurora primitives in v2 frontend |

---

## Engineering contract alignment

| Artifact | Status |
| --- | --- |
| `data-access.contract.ts` | **Done** — matches shipped modules |
| `MODULE_ACCESS_GUIDE.md` | **Done** — plain-language mirror |
| `PHASE_1_PRODUCT_AUDIT.md` | **Done** — blocker fixes logged |
| Stale enums in `technical-doc.md` | **Known drift** — do not implement `DIRECT_CONVERSIONS`; use UCE + planner enums |

---

## What “current journey complete” means

For **Brand Co-Pilot Phase 1** (`/brand/dashboard`), every **read** and **write** called out in PROGRESS.md is implemented and mapped above. Remaining matrix rows are **intentionally deferred** to later slices (live UCE, creator carousel, collab/escrow writes, attachments, entity threads).

**QA:** Run [PHASE_1_MANUAL_UI_TESTS.md](../testing/PHASE_1_MANUAL_UI_TESTS.md) and new persona/leaks/competitor chips in [brand-co-pilot-config.ts](../../../src/features/co-pilot/brand/brand-co-pilot-config.ts).
