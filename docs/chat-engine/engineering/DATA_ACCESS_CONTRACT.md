# Co-Pilot data access contract

**Version:** 2026-06-11  
**Machine-readable source:** [`src/features/co-pilot/contracts/data-access.contract.ts`](../../src/features/co-pilot/contracts/data-access.contract.ts)

This file is the **technical** mirror of the TypeScript contract. For plain-language summaries per module, see **[MODULE_ACCESS_GUIDE.md](./MODULE_ACCESS_GUIDE.md)**. Use this file when troubleshooting “why can’t co-pilot write X?” or reviewing security scope.

---

## Access modes

| Mode | Meaning |
| --- | --- |
| **READ** | Co-pilot tools may query via feature services only (no direct SQL / no LLM-side writes). |
| **WRITE_VIA_HITL** | Mutation only after user confirms an `INTERACTIVE_EXECUTION_WIDGET` with matching `idempotencyKey`. |
| **WRITE_DENIED** | Co-pilot must not mutate in the current release. |
| **CO_PILOT_OWN** | Tables owned by the co-pilot module (threads, messages, slot sessions, logs). |

---

## Active scopes (today)

- **BRAND_CENTRE** — read DNA + Intelligence & Gaps; campaign launch via HITL only.

## Deferred scopes

- **ANALYTICS**, **ESCROW**, **GLOBAL** — no tools wired yet.

---

## Module matrix

### Brand Centre — Tab 1 (Brand DNA)

| Prisma model | Access |
| --- | --- |
| `BrandProfile` | READ |
| `BrandAudiencePersona` | READ |
| `Offering` | READ |
| `Competitor` | READ |
| `BrandOffer` | READ |
| `BrandBudgetConfiguration` | READ |
| `BrandBudgetModificationLog` | WRITE_DENIED |

**Read routes:** `GET /api/v1/brand-centre/dna`, personas, offerings  
**Write (future HITL):** DNA patch routes — not wired  
**Notes:** Tab 1 aggregates only; DNA edits need future HITL widgets.

---

### Brand Centre — Tab 2 (Intelligence & Gaps)

| Prisma model | Access |
| --- | --- |
| `BrandIntelligenceBaseline` | READ |
| `BrandPerformanceLeak` | READ |
| `BrandCentreJob` | READ |

**Read routes:** `GET /api/v1/brand-centre/intelligence`, leaks  
**Write (future HITL):** move-to-planner — not wired  
**Notes:** Full intelligence reads expect deep scan `READY`.

---

### Brand Centre — Tab 3 (Planner)

| Prisma model | Access |
| --- | --- |
| `BrandPlannerCard` | READ |

**Read routes:** `GET /api/v1/brand-centre/planner`  
**Write (future HITL):** approve card — not wired

---

### UCE campaigns

| Prisma model | Access |
| --- | --- |
| `UceCampaign` | WRITE_VIA_HITL |
| `UceCampaignStrategy` | WRITE_VIA_HITL |
| `UceCampaignTargeting` | WRITE_VIA_HITL |
| `UceCampaignCommercials` | WRITE_VIA_HITL |

**Read routes:** `GET /api/v1/brand-uce/campaigns` (not exposed as co-pilot tool yet)  
**Write route:** `POST /api/v1/co-pilot/hitl/confirm` → delegates `POST /api/v1/brand-uce/campaigns/wizard`  
**Flow:** `CAMPAIGN_LAUNCH` intent → slot fill → execution widget → confirm creates **DRAFT** campaign.

---

### Escrow (deferred)

| Prisma model | Access |
| --- | --- |
| `BrandEscrowVault` | WRITE_DENIED |

No co-pilot tools.

---

### Collaboration (deferred)

| Prisma model | Access |
| --- | --- |
| `Collaboration` | WRITE_DENIED |

---

### Pricing / entitlements

| Prisma model | Access |
| --- | --- |
| `FeatureUsage` | READ |
| `BrandSubscription` | READ |

**Read routes:** `GET /api/v1/pricing/usage`  
**Notes:** `MAX_AI_CHATS` enforcement deferred to final slice.

---

### Co-pilot session (owned tables)

| Prisma model | Access |
| --- | --- |
| `CoPilotThread` | CO_PILOT_OWN |
| `CoPilotMessage` | CO_PILOT_OWN |
| `CoPilotSlotSession` | CO_PILOT_OWN |
| `CoPilotInteractionLog` | CO_PILOT_OWN |

Conversation state only — not brand domain data.

---

## Troubleshooting checklist

1. **Read answer is empty or generic** — check Brand Centre data + intelligence scan status; co-pilot only reads what exists.
2. **Slot form keeps reappearing** — required fields: `product_name` (if not parsed), `budget_allocation`, `marketing_objective`. Submit via form **Continue**, not composer alone.
3. **HITL confirm fails** — verify active `CoPilotSlotSession` for thread, matching `idempotencyKey`, budget &gt; 0, valid objective enum.
4. **Unexpected write** — search codebase for `CO_PILOT_DATA_ACCESS_CONTRACT`; writes outside `WRITE_VIA_HITL` paths are bugs.
5. **Quota / limit** — not enforced yet; see [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md).

When updating access, change **both** the TypeScript contract and this doc.
