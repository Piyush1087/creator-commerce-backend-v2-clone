# Chat Engine — open questions / decisions

**Status:** Block implementation until product answers items marked **Blocker**.  
**Meeting goal:** One session → locked answers → update this file with **Answered** sections.

---

## 1. Quota model (Blocker)

Product docs (`core-functionality.md`) specify **daily** prompt limits: 50 (Starter) / 500 (Pro) / unlimited (Enterprise).

v2 pricing code (`FEATURE_LIMITS`) already defines **`MAX_AI_CHATS`** with **monthly** lazy reset:

| Tier | `MAX_AI_CHATS` (code today) | Reset |
| --- | --- | --- |
| Founders Beta | 50 | Monthly (`feature_usages.resetAt`) |
| Growth Starter | 150 | Monthly |
| Professional | 1,000 | Monthly |
| Enterprise | ~unlimited | N/A |

**Questions for product**

1. **Period:** Daily or monthly (or align to billing cycle)?
2. **Numbers:** Adopt product 50/500/unlimited, keep engineering table, or new table?
3. **Billing unit:** What counts as one use?
   - **Option A — User turn:** each submit that triggers the orchestrator (+1)
   - **Option B — Agent run:** one user message through full response (+1)
   - **Option C — Completed task:** slot-filling chain counts as one until intent resolves
4. **Slot-filling:** If user says *"Launch retinol campaign"* then fills budget + objective — is that **1** or **3** against quota?
5. **Enterprise:** Truly unlimited for customers, or internal fair-use / soft token cap?

**Engineering recommendation (pending approval):**

- Customer-facing limit: **orchestrator runs per billing period** (monthly, reuse `MAX_AI_CHATS`)
- Slot-filling steps in the **same** `intentWorkspaceContext`: count as **one** run when intent completes (or first turn only — product pick)
- **Tokens:** track for cost/admin only; not primary brand-facing limit in v1
- Technical guardrails: max input size, max context per thread, attachment caps (engineering-owned)

---

## 2. Usage visibility (Blocker for UX; API shape needed early)

Product wants warning at **80%** and hard stop at **100%**.

**Questions**

1. Copy: "prompts", "co-pilot turns", or "AI messages"?
2. Show meter in chat only, Settings billing only, or both?
3. Expose **token usage** to brands or turns only?

**Engineering recommendation:**

- Reuse `EntitlementService.getUsageSnapshot()` + extend response with `MAX_AI_CHATS`
- Brand UI (later): progress bar / "X of Y remaining · resets {date}"
- No separate chat quota counter

---

## 3. Reset mechanics (Answered — engineering default)

| Approach | Use when |
| --- | --- |
| **Lazy reset** on increment (current `EntitlementService`) | Monthly quotas — **no cron required** |
| **Daily quota** | Needs event log or daily counter — **not** monthly `feature_usages` alone |
| **Cron** | Optional for archival, admin rollups, stale row cleanup — not for monthly reset correctness |

**Question for product:** If daily limits are required, confirm calendar day (UTC vs brand timezone).

---

## 4. Threads vs tasks (Blocker)

Product models **thread history** (Gemini/ChatGPT style) but does **not** split billing or UX by task.

**Questions**

1. Is one long thread with many tasks **intended**? (Assumption: yes.)
2. Should we **auto-suggest** "New conversation" when scope changes (e.g. campaign → escrow)?
3. **Auto-split** threads on new intent — required or nice-to-have?
4. **Entity-bound threads:** MVP required? (e.g. chat opened from campaign page → `campaignId` on thread)

**Engineering recommendation:**

- Threads = continuity; **quota = orchestrator runs**, not thread count
- Optional `scopeContext` + `linkedEntityType` / `linkedEntityId` on thread
- No automatic task-based thread splitting in v1

---

## 5. Thread retention & sidebar limits (Blocker)

Product shows left-rail history with no retention policy.

**Questions**

1. **Retention:** Keep forever, 12 months, or tier-based?
2. **Sidebar display:** How many recent threads (e.g. 20–30) before "View all"?
3. **Per-brand cap:** Max active threads before auto-archive (e.g. 500)?
4. **Per-thread message cap:** Summarize or block after N messages (e.g. 500)?
5. **Delete:** Can brand delete threads (GDPR)? Hard delete vs soft archive?
6. **Compliance:** Is history audit evidence (keep longer) or UX convenience (trim ok)?

**Engineering recommendation (MVP):**

- Store all threads while account active; sidebar loads **last 30** paginated
- `archivedAt` optional user archive
- Phase 2: retention job + cold archive
- Context for LLM: summarize older messages when over token budget (engineering)

---

## 6. AI provider & RAG (Answered — engineering proposal)

**Questions for product**

1. Confirm **Gemini** as sole v1 provider (already used in Brand Centre / onboarding)?
2. **Attachments in MVP?** Images / PDF / CSV — which types and max size?
3. **RAG scope:** Unstructured uploads only, or also platform docs?

**Engineering decision (proposed lock):**

| Layer | Approach |
| --- | --- |
| LLM | Gemini (`GEMINI_MODEL`, default `gemini-2.5-flash`) |
| Platform data | **Tool calling** → existing NestJS services + Prisma (no SQL to LLM) |
| RAG | **Phase 2** — vector index for brand-uploaded documents only |
| Secrets | Never in LLM context (per product guardrails) |

---

## 7. MVP write scope (Blocker)

Product matrix covers writes across Brand Centre, UCE, Collaboration, Escrow, Settings.

**Questions**

1. **v1 read-only modules** — which summaries are must-have?
2. **v1 HITL writes** — which actions? (e.g. planner draft only vs escrow lock)
3. **Moderation:** Block only, or warn + log? Provider: Gemini safety vs OpenAI Moderation?

**Engineering recommendation — phased writes:**

- **v1:** Read tools + slot-filling + stage drafts (Campaign planner / DNA draft cards)
- **v1.1:** HITL confirm → existing REST endpoints (idempotency keys)
- **Later:** Escrow lock/release, collab approvals via chat widgets

---

## 8. Auditing & admin cost monitoring (Answered — engineering owns design)

Product mentions `ai_interaction_logs` without schema.

**Questions**

1. Admin panel in MVP or data-only?
2. Retention for interaction logs (same as threads or longer)?
3. Store full prompt text for support, or redacted?

**Engineering decision (proposed lock):**

- New `CoPilotInteractionLog` per orchestrator run: tokens, model, tools, latency, status, cost estimate
- Separate from `feature_usages` entitlement counter
- Prompt storage: truncated + PII policy TBD with product/legal

---

## 9. Response contract (Mostly answered in product docs)

Product defines `CoPilotChatPayload` / `formatType` enum in `result-format-architecture.md`.

**Remaining questions**

1. Enum drift: align `FUNNEL_LEAK_MITIGATION` vs `FUNNEL_LEAK_REPAIR` across docs
2. Streaming: SSE for narrative only, or stream partial JSON widget assembly?
3. Failed quota mid slot-fill: preserve `CoPilotSlotSession` state or discard?

---

## 10. Naming & scope (Answered)

| Topic | Decision |
| --- | --- |
| Module name | `co-pilot` (code), "Chat Engine" (product) |
| Audience v1 | Brand admins only |
| Not in scope v1 | Influencer co-pilot, Chat V3 messaging |

---

## 11. DNA edit limits via co-pilot (Deferred — not a blocker for manual testing)

Brand Centre already enforces edit limits on some DNA fields (e.g. budget modifications: **2 edits per 30 days** per `BrandBudgetModificationLog`). Co-pilot can stage DNA identity, offering, and persona writes through HITL today **without** checking those limits.

**Before production DNA write rollout:**

1. Map each HITL write intent to the same validation used by Brand Centre REST APIs.
2. Return a clear narrative when limit exceeded (e.g. “You’ve used your DNA edit allowance for this period — try again after {date} or edit in Brand Centre.”).
3. Decide whether co-pilot counts as one “edit” per HITL confirm or per field changed.

**Status:** Documented only; implementation deferred.

---

## Meeting checklist

Copy for product agenda:

- [ ] Quota: unit + period + tier numbers
- [ ] Slot-filling counting rule
- [ ] Thread retention + delete policy
- [ ] MVP: read modules + allowed writes
- [ ] Attachments in MVP?
- [ ] Brand-facing meter: turns only vs tokens
- [ ] Entity-bound threads required?
- [ ] Daily vs monthly alignment with pricing page copy

After the meeting, move each section to **Answered** with the decision and date.
