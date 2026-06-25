# Chat Engine — progress tracker

**Last updated:** June 2026  
**UI tests:** [testing/MANUAL_UI_TESTS.md](../testing/MANUAL_UI_TESTS.md) · [Phase 1 checklist](../testing/PHASE_1_MANUAL_UI_TESTS.md)  
**Product alignment:** [progress/PRODUCT_ALIGNMENT.md](./PRODUCT_ALIGNMENT.md) · [testing/PHASE_1_PRODUCT_AUDIT.md](../testing/PHASE_1_PRODUCT_AUDIT.md)  
**Data access contract:** [engineering/DATA_ACCESS_CONTRACT.md](../engineering/DATA_ACCESS_CONTRACT.md) · [MODULE_ACCESS_GUIDE.md](../engineering/MODULE_ACCESS_GUIDE.md) · [`data-access.contract.ts`](../../../src/features/co-pilot/contracts/data-access.contract.ts)

---

## Shipped in this slice

| Area | Status |
| --- | --- |
| Brand Centre read (Tab 1+2) | Done |
| Brand Centre follow-up reads (DNA blocks, leaks table, personas table, competitor insights, visual identity) | Done |
| Escrow read (vault + ledger table) | Done |
| Collaboration read (pipeline table) | Done |
| DNA compliance read (do-not-say list) | Done |
| DNA HITL writes (identity, offering description, persona create) | Done |
| Campaign launch HITL (UCE draft) | Done |
| HITL resolution persisted on message (reopen thread shows saved/discard) | Done |
| Thread soft-delete (archive) in sidebar | Done |
| SSE streaming | Done |
| Slot filling + execution widget | Done |
| Moderation / guardrails (input block + output sanitize) | Done |
| Usage tracking + warnings (`MAX_AI_CHATS`) | Done |
| Feedback API + trial UI | Done |
| Thumbs feedback on agent messages in feed | Done |
| Thread temporal grouping + view all | Done |
| Welcome message on new chat | Done |
| Hello / test replies + gibberish fallback | Done |
| `TABULAR_AUDIT_DATA` renderer | Done |
| Data access contract (TS + markdown) | Done |
| Docs folder layout | Done |

---

## Deferred / not yet enforced

| Item | Notes |
| --- | --- |
| DNA edit rate limits in co-pilot | Brand Centre DNA has service-level edit limits (e.g. budget 2 edits / 30 days). Co-pilot HITL DNA writes should **reuse the same limits** and return friendly errors — **not wired yet**; track before production DNA write rollout. |
| Escrow / collab HITL writes | See module table below |

## In progress / next modules

| Module | Read | Write HITL | Notes |
| --- | --- | --- | --- |
| Brand Centre Tab 2 move-to-planner HITL | Done | — | Async SSE follow-up on confirm/stream |
| Brand Centre Tab 3 planner read + launch HITL | Done | Done | Table read; bridge → UCE DRAFT |
| UCE draft list + edit (DRAFT only) | Done | — | CAMPAIGN_EDIT_DRAFT HITL |
| UCE read | Not started | — | Live campaigns grid / carousel |
| Escrow writes | Read done | Not started | Lock, release, refund widgets |
| Collaboration writes | Read done | Not started | Counter-offer, shipment, media review |
| Analytics scope | Not started | — | Funnel charts |
| Attachments | Not started | — | Phase 2; track only |
| Creator carousel | Not started | — | `POLYMORPHIC_ENTITY_CAROUSEL` |
| Entity-bound threads | Not started | — | Open from campaign page |

---

## Result formats

| `formatType` | Backend | Frontend |
| --- | --- | --- |
| `CONVERSATIONAL_NARRATIVE` | Yes | Yes |
| `METRIC_HIGHLIGHT_GRID` | Yes | Yes |
| `TABULAR_AUDIT_DATA` | Yes (escrow, collab) | Yes |
| `SLOT_FILLING_CLARIFICATION` | Yes | Yes |
| `INTERACTIVE_EXECUTION_WIDGET` | Yes | Yes |
| `POLYMORPHIC_ENTITY_CAROUSEL` | Not yet | Not yet |

---

## Product decisions still open

See [product-questions/OPEN_QUESTIONS.md](../product-questions/OPEN_QUESTIONS.md):

- Slot-fill vs multi-turn billing unit
- Daily vs monthly quota copy alignment
- Thread retention / delete policy

---

## Migrations

```powershell
npx prisma migrate deploy
npx prisma generate
```

New: `20260611140000_co_pilot_feedback` (`CoPilotMessageFeedback`)
