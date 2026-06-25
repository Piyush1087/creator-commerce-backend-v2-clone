# Brand Co-Pilot Phase 1 — Product vs Code Audit

**Date:** 2026-06-11  
**Scope:** Brand Centre Tabs 1–3, planner pipeline, UCE DRAFT paths, HITL rules  
**Repos:** `creator-commerce-backend-v2`, `creator-commerce-frontend-v2`

Compared against:

- `docs/chat-engine/product-docs/platform-use-case-matrix.md`
- `docs/brand-journey/BRAND_CENTRE.md`, `BRIDGE_TO_UCE.md`, `FLOW_OVERVIEW.md`, `UCE.md`
- `docs/chat-engine/engineering/MODULE_ACCESS_GUIDE.md`
- `docs/chat-engine/testing/PHASE_1_MANUAL_UI_TESTS.md`

---

## Summary

Phase 1 is **shippable for demo** with documented deferrals. Core read/HITL/DRAFT paths align with product intent. Six issues were **fixed in this pass**; remaining gaps are **deferrals** or **post-Phase-1** hardening.

---

## Fixed in this audit pass

| Issue | Severity | Fix |
|-------|----------|-----|
| Failed `PLANNER_AGGREGATE` stranded leaks at `PUSHED_TO_PLANNER` | Blocker | Worker `failJob` reverts leak to `PENDING_USER_REVIEW` when no card linked |
| Slot session regenerated new HITL widget on every message | Blocker | Reuse staged key; skip re-stage when session complete; block new writes while pending |
| Duplicate UCE launch on re-confirm of approved planner card | Blocker | Reject if `workflowStatus === PROCEEDED_TO_PIPELINE` |
| Bridge timeline forced ISO deadlines to `evergreen` | Blocker | Pass planner deadline through to bridge unchanged |
| Async follow-up referenced wrong planner card | Gap | Resolve card by `sourceLeakId` from job payload |
| Double HITL confirm could re-run writes | Blocker | Reject confirm when message resolution already `CONFIRMED` / `DISCARDED` |
| Draft edit always required objective | Gap | Objective slot optional when budget provided; auto-select single DRAFT |

---

## Aligned (OK for Phase 1)

| Rule | Evidence |
|------|----------|
| No silent writes | Mutations only via `POST /hitl/confirm` (+ stream for async planner) |
| HITL widget carries `idempotencyKey` | `executionWidget.idempotencyKey`; confirm matches session |
| Resolution persisted on thread message | `persistHitlResolution` + frontend `hitl-message-state` |
| Tab 2 move → async job → follow-up | `INTELLIGENCE_MOVE_TO_PLANNER` + SSE poll + narrative append |
| Tab 2 already-pushed guard | `moveToPlanner` throws; `listMovableLeaks` excludes pushed |
| Tab 3 green card → bridge → UCE DRAFT | `PLANNER_LAUNCH_DRAFT` → approve → launch + inject |
| `AUTO_PAUSE_LOG` not launchable | Excluded from `listLaunchablePlannerCards`; approve throws |
| DRAFT-only UCE edits from chat | `updateDraftWizard` rejects non-DRAFT; intent lists DRAFT only |
| ACTIVE/PAUSED ops denied | No chat intent; contract marks live ops future |
| Budget DNA write denied | `BrandBudgetModificationLog: WRITE_DENIED` in contract |
| Shortcut `CAMPAIGN_LAUNCH` → wizard DRAFT | Unchanged Path B |
| Collab/escrow deep dives deferred | Out of Phase 1 scope per PROGRESS.md |

---

## Documented deferrals (not blockers for Phase 1 demo)

| Topic | Product doc | Phase 1 status |
|-------|-------------|----------------|
| Tab 3 **Confirm Purge** HITL | `BRAND_CENTRE.md` | Not implemented; UI discard disabled |
| Tab 2 **competitor scan** trigger | Tab 2 writes | Not in co-pilot |
| **SUGGESTED_UPDATE** amber cards | `BRIDGE_TO_UCE.md` | Only `NEW_CAMPAIGN` green path in chat |
| **Active Focus** UI collapse | `platform-use-case-matrix.md` §Active Focus | Backend blocks new writes while pending; frontend does not collapse older widgets |
| Circuit breaker **live spend** | `BRIDGE_TO_UCE.md`, REQ-T3-004 | `activeCommitted = 0` in planner approve (v1 note) |
| DNA **rate limits** | `OPEN_QUESTIONS.md` §11 | Not enforced in co-pilot HITL |
| DNA **do-not-say** on writes | `core-functionality.md` | Regex moderation only; compliance read route exists |
| Stale objective enums in `technical-doc.md` | `DIRECT_CONVERSIONS`, etc. | Docs drift; code uses UCE + planner enums + bridge mapping |
| Bridge inject partial failure | — | No compensating transaction if inject fails after launch |
| Full confirm **idempotency registry** | Matrix idempotency signatures | Resolution check on message; no cached result replay |

---

## Objective enum layers (intentional)

| Layer | Values |
|-------|--------|
| Planner / Brand Centre | `PULSE`, `PROOF`, `PUSH`, `PRODUCTION` |
| UCE / shortcut launch | `BRAND_AWARENESS`, `TRAFFIC_CLICKS`, `SALES_CONVERSIONS` |
| Bridge mapping | Production→Sales, Pulse→Traffic, Proof→Awareness |

Shortcut path speaks UCE enums. Planner path uses bridge mapping. No code change required unless product wants unified vocabulary in chat.

---

## Recommended post-Phase-1 order

1. **SUGGESTED_UPDATE** path for amber planner cards (inject into existing campaign).
2. **Active Focus** frontend — collapse non-focused HITL widgets to read-only headers.
3. **Circuit breaker** — sum ACTIVE campaign committed spend into `remainingFloat`.
4. **Slot Zod validation** at merge completion (`leak_id`, `planner_card_id`, budget bounds).
5. **Bridge saga** — rollback DRAFT campaign if inject batch fails.
6. **DNA quotas** when product defines limits.
7. **Stale doc cleanup** — `technical-doc.md` campaign objective examples.

---

## Manual test focus after fixes

Re-run `PHASE_1_MANUAL_UI_TESTS.md` §6 smoke with emphasis on:

1. Move leak → kill planner job (or simulate failure) → leak movable again.
2. Stage HITL → send read query → should get pending-action reminder, not new widget.
3. Launch planner card twice → second confirm rejected.
4. Planner card with fixed deadline → UCE strategy shows correct end date.
5. Single DRAFT budget edit without objective slot.
