# Chat Engine — architecture

Backend-focused view of the Brand Co-Pilot. UI prototypes in `product-docs/` are reference only; frontend will use Aurora later.

---

## 1. High-level flow

```text
Client                    NestJS                           Platform
──────                    ──────                           ────────
POST .../messages  →  CoPilotController
                           │
                           ├─ Auth + brandProfileId scope
                           ├─ EntitlementService.checkAndIncrement(MAX_AI_CHATS)
                           ├─ Input moderation
                           ├─ CoPilotOrchestratorService
                           │     ├─ Load thread + slot session
                           │     ├─ Scope router (GLOBAL | BRAND_CENTRE | ANALYTICS | ESCROW)
                           │     ├─ Intent + Zod slot validation
                           │     ├─ Tool loop (read existing feature services)
                           │     └─ Gemini → structured CoPilotChatPayload
                           ├─ Persist user + assistant messages
                           ├─ CoPilotInteractionLog (tokens, tools, cost)
                           ├─ Output moderation
                           └─ SSE stream (narrative) or JSON response
```

**Principles**

1. **Backend owns response shape** — frontend renders `formatType`; no workflow conditionals by role in UI for v1 backend contract.
2. **Human-in-the-loop** — financial and destructive writes only via `INTERACTIVE_EXECUTION_WIDGET` → user confirm → existing API with `idempotencyKey`.
3. **No LLM SQL** — database access only through typed tools calling feature services.
4. **Multi-tenant** — every query scoped by `brandProfileId` from JWT; never trust client `brandId` body alone.

---

## 2. Orchestrator design

### 2.1 Scope routing

Product defines **Stateful Scope Context Anchors**:

| Scope | Tool / data boundary |
| --- | --- |
| `GLOBAL` | Cross-module; intent classifier picks tools |
| `BRAND_CENTRE` | DNA, personas, intelligence, planner |
| `ANALYTICS` | Funnel leaks, baselines, performance |
| `ESCROW` | Vault balances, ledger, TDS buffer (read); locks/releases via HITL only |

Scope is stored on the thread (and sent per message). Router **narrows** the tool allowlist before calling Gemini.

### 2.2 Intent and slot filling

When user input implies a write or structured action:

1. Map to `intentWorkspaceContext` (e.g. `CAMPAIGN_LAUNCH`)
2. Validate against domain Zod schema (reuse or wrap UCE / Brand Centre schemas)
3. If fields missing → return `SLOT_FILLING_CLARIFICATION` with `stagedPayload` + `missingSlots`
4. Persist partial state in `CoPilotSlotSession` (DB row keyed by `threadId`)
5. On complete validation → return `INTERACTIVE_EXECUTION_WIDGET` or execute read-only narrative

Slot session TTL: engineering default **24h** inactive (configurable); product may override.

### 2.3 Tool registry (v1 target)

Read tools (implement first):

| Tool | Delegates to |
| --- | --- |
| `getBrandDnaSummary` | Brand Centre DNA service |
| `listAudiencePersonas` | Brand Centre |
| `getPlannerDrafts` | Brand Centre planner |
| `getFunnelLeakSummary` | Brand Centre intelligence |
| `listLiveCampaigns` | UCE / campaigns service |
| `getCampaignSnapshot` | UCE |
| `searchCreators` | Discovery service (when available) |
| `getEscrowSnapshot` | Brand escrow service |
| `getLedgerEntries` | Brand escrow ledger |
| `getCollaborationPipeline` | Collaboration service |
| `getUsageQuota` | Pricing `EntitlementService.getUsageSnapshot` |

Write tools (HITL only — v1.1):

| Tool | Stages widget → API |
| --- | --- |
| `stageCampaignDraft` | Brand Centre / UCE create draft |
| `stageDnaUpdate` | Brand Centre DNA patch preview |
| `stageEscrowLock` | Escrow lock endpoint |

Tools return **structured JSON** for the LLM to compose `CoPilotChatPayload`, not raw Prisma rows with internal fields.

---

## 3. Gemini integration

Reuse and extend `GeminiJsonClient` pattern from brand-onboarding:

| Concern | Approach |
| --- | --- |
| Model | `GEMINI_MODEL` env (default `gemini-2.5-flash`) |
| Structured replies | `responseSchema` from Zod → `zodToGeminiResponseSchema` (existing util in brand-centre) |
| System prompt | Co-pilot persona + scope + tool manifest + guardrails (no algo weights, domain-only) |
| Streaming | Add `GeminiStreamClient` or extend client for SSE token stream on `narrativeText` |
| Multimodal | Phase 2 — attachment URLs as `fileData` parts |
| Timeouts | `GEMINI_REQUEST_TIMEOUT_MS` (existing pattern) |

**Token usage:** read `usageMetadata` from Gemini response; persist on `CoPilotInteractionLog`.

---

## 4. RAG strategy

| Data type | v1 | Later |
| --- | --- | --- |
| Campaign, escrow, collab, DNA rows | Tools (SQL via services) | — |
| Brand-uploaded PDF/DOCX/images | Not in v1 unless product mandates | pgvector / external index; chunk + embed |
| Platform source code / fee formulas | **Never** | — |
| Long thread history | Summarization job compresses old turns | Optional summary store |

Product RAG boundary: feed LLM **query results**, not raw matching weights or infrastructure details.

---

## 5. Quotas and entitlements

**Customer limit:** `EntitlementService.checkAndIncrementUsage(brandProfileId, 'MAX_AI_CHATS', incrementBy)`

Call site: **start of orchestrator run** (after auth, before Gemini), unless product chooses "completed task" counting.

**Increment rules (proposed):**

- `incrementBy = 1` per billable orchestrator invocation
- Slot-filling continuation on same `slotSessionId`: `incrementBy = 0` until intent completes (product must confirm)
- Blocked runs (moderation, validation only with no LLM): `incrementBy = 0`

**Technical limits (engineering, not tier marketing):**

- Max user message length (chars / tokens)
- Max tools per run (e.g. 5)
- Max thread messages loaded into context (then summarize)

**Reset:** monthly lazy reset via existing `CYCLIC_FEATURE_KEYS` including `MAX_AI_CHATS`. Daily limits require product decision + separate mechanism (see [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md)).

---

## 6. Auditing and observability

### 6.1 `CoPilotInteractionLog` (per run)

- Identity: `brandProfileId`, `userId`, `threadId`, `messageId`
- Routing: `scopeContext`, `intentKey`, `toolsInvoked[]`
- Model: `modelId`, `inputTokens`, `outputTokens`, `estimatedCost`
- Outcome: `status` (success | quota_denied | moderation_blocked | error), `latencyMs`
- HITL: `idempotencyKey` when widget staged

### 6.2 Admin aggregates (later)

- Daily cost by tier / brand
- Token percentiles, error rates
- Quota exhaustion events

### 6.3 Feedback (product pillar)

- `CoPilotMessageFeedback` — thumbs, reason enum, links to `messageId`
- Implicit signals: widget confirm/abandon events logged on interaction log

---

## 7. Moderation and guardrails

Pipeline (order):

1. Input length / attachment policy check
2. Moderation API (provider TBD — see open questions)
3. System prompt domain restriction
4. Tool allowlist enforcement (scope)
5. Output moderation before persist

On failure: return safe `CONVERSATIONAL_NARRATIVE` refusal; log `moderation_blocked`; do not increment quota if blocked before orchestrator (product decision).

---

## 8. Real-time transport

| Mechanism | Use |
| --- | --- |
| **REST** | Create thread, list threads, post message (non-streaming fallback) |
| **SSE** | Stream `narrativeText` tokens; final message includes full `CoPilotChatPayload` event |
| **Socket.io** | Not used for co-pilot (Chat V3 only in legacy) |

---

## 9. Security

- JWT org scope → `brandProfileId`
- Interaction logs: redact PAN, secrets, full webhook keys
- Attachments: virus scan + type allowlist (phase 2)
- Rate limit: entitlement + optional IP burst limit at gateway

---

## 10. Product doc → engineering mapping

| Product concept | Engineering artifact |
| --- | --- |
| `CoPilotChatPayload` | `src/features/co-pilot/schemas/copilot-payload.schema.ts` |
| `ai_interaction_logs` | `CoPilotInteractionLog` model |
| Thread left rail | `CoPilotThread` + list API |
| `MAX_AI_CHATS` / tiers | Existing `FEATURE_LIMITS` — align numbers with product |
| Campaign initialize prototype | UCE / Brand Centre APIs — not new `campaigns` table |
| Escrow wallet prototype | `BrandEscrowVault` + brand-escrow services |
