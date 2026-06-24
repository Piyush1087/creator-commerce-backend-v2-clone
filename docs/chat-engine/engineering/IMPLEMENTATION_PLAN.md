# Chat Engine — implementation plan

**Status:** Blocked on [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) product sign-off  
**Architecture:** [ARCHITECTURE.md](./ARCHITECTURE.md)  
**Schema:** [SCHEMA_MIGRATION.md](./SCHEMA_MIGRATION.md)  
**UI:** Deferred — Aurora frontend after backend contract stable

---

## Engineering decisions (proposed lock)

| Topic | Decision |
| --- | --- |
| Module path | `src/features/co-pilot/` |
| Tenancy | `brandProfileId` from JWT (Brand Centre pattern) |
| LLM | Gemini via extended `GeminiJsonClient` + streaming wrapper |
| Platform data | Tool calling to existing feature services — not RAG in v1 |
| Quotas | `EntitlementService` + `MAX_AI_CHATS` (align tier numbers with product) |
| Response contract | Zod-validated `CoPilotChatPayload` |
| Writes | HITL only — delegate to existing REST endpoints |
| Transport | REST + SSE for stream; no Socket.io |
| Product `product-docs/` tables | Do not implement standalone Brand/Campaign/Escrow models |

---

## Module layout

```text
src/features/co-pilot/
  co-pilot.module.ts
  co-pilot.controller.ts
  co-pilot-threads.controller.ts

  services/
    co-pilot-orchestrator.service.ts      # Main agent loop
    co-pilot-scope-router.service.ts      # Tool allowlists by scope
    co-pilot-slot-session.service.ts      # Multi-turn slot state
    co-pilot-thread.service.ts            # CRUD + title generation
    co-pilot-interaction-log.service.ts   # Audit + tokens
    co-pilot-moderation.service.ts        # Input/output guard

  tools/
    co-pilot-tool.registry.ts
    brand-centre.tools.ts
    escrow.tools.ts
    uce.tools.ts
    collaboration.tools.ts
    pricing.tools.ts

  integrations/
    gemini-copilot.client.ts              # Structured + stream
    copilot-system-prompt.ts

  schemas/
    copilot-payload.schema.ts             # Product format union
    thread.schema.ts
    post-message.schema.ts

  dto/
  types.ts

  mappers/
    to-copilot-payload.mapper.ts
```

**Shared Gemini util:** Prefer importing `GeminiJsonClient` from brand-onboarding or moving to `src/shared/integrations/gemini/` if both modules need it.

**Pricing hook:**

```typescript
await this.entitlementService.checkAndIncrementUsage(
  brandProfileId,
  'MAX_AI_CHATS',
  billableIncrement,
);
```

---

## API surface (v1)

Base path: `/api/v1/co-pilot` (exact prefix TBD with existing API conventions).

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/threads` | Create thread; optional `linkedEntityType`, `linkedEntityId`, `scopeContext` |
| `GET` | `/threads` | List threads (`limit`, `cursor`, `includeArchived`) |
| `GET` | `/threads/:threadId` | Thread + recent messages |
| `PATCH` | `/threads/:threadId` | Archive, rename title |
| `POST` | `/threads/:threadId/messages` | User message → orchestrator → assistant payload |
| `GET` | `/threads/:threadId/messages` | Paginated history |
| `POST` | `/threads/:threadId/messages/stream` | SSE variant of post |
| `POST` | `/messages/:messageId/feedback` | Thumbs + reason |
| `GET` | `/usage` | Thin wrapper or redirect to pricing usage for `MAX_AI_CHATS` |

**HITL confirms** do not live under co-pilot — client calls existing feature routes (`/api/v1/...`) with `idempotencyKey` from `INTERACTIVE_EXECUTION_WIDGET`.

---

## Build slices

### Slice 0 — Product gate

- [ ] Product meeting; update [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md)
- [ ] Align `FEATURE_LIMITS.MAX_AI_CHATS` with product if numbers change
- [ ] Register migration review

### Slice 1 — Foundation

- [ ] Prisma models: `CoPilotThread`, `CoPilotMessage`, `CoPilotSlotSession`, `CoPilotInteractionLog`
- [ ] Zod schemas for payload + thread APIs
- [ ] `CoPilotThreadService` — create, list, archive
- [ ] `CoPilotModule` registered in `app.module.ts`
- [ ] Controllers: threads CRUD, message persist (echo stub without LLM)

**Exit:** Can create thread and store messages without AI.

### Slice 2 — Entitlements + logging

- [ ] Orchestrator entry: entitlement check + increment policy
- [ ] `CoPilotInteractionLogService` — write log row per run
- [ ] Quota denied → HTTP 403 + structured error for UI
- [ ] Token fields populated when Gemini returns usage metadata

**Exit:** Billable gate and audit trail work with stub orchestrator.

### Slice 3 — Gemini orchestrator (read-only)

- [ ] `gemini-copilot.client.ts` — structured `CoPilotChatPayload`
- [ ] System prompt + scope router
- [ ] Tool registry: `getUsageQuota`, `getBrandDnaSummary`, `getEscrowSnapshot`, `listLiveCampaigns` (minimum set)
- [ ] Slot filling: `CoPilotSlotSessionService` + `SLOT_FILLING_CLARIFICATION` responses
- [ ] `POST .../messages` full pipeline

**Exit:** Brand can ask read-only questions and get valid generative UI JSON.

### Slice 4 — SSE streaming

- [ ] Stream `narrativeText` via SSE
- [ ] Terminal event with full validated payload
- [ ] Timeout and error handling

**Exit:** Streaming matches product pillar; non-stream fallback remains.

### Slice 5 — HITL staging (v1.1)

- [ ] `INTERACTIVE_EXECUTION_WIDGET` generation with `idempotencyKey`
- [ ] Map `formTargetRoute` to existing controllers (planner draft first)
- [ ] Confirm/abandon logging for implicit feedback

### Slice 6 — Moderation + feedback

- [ ] Input/output moderation integration
- [ ] `CoPilotMessageFeedback` model + API
- [ ] Blocked runs policy (increment or not — per product answer)

### Slice 7 — Retention jobs (phase 2)

- [ ] Cron: expire slot sessions
- [ ] Optional: auto-archive inactive threads
- [ ] Optional: thread summarization for long context

### Slice 8 — Attachments + RAG (phase 2)

- [ ] Upload pipeline (S3), type allowlist
- [ ] Gemini multimodal for images
- [ ] Vector index for PDF/DOCX corpus

---

## Tool implementation order

1. `getUsageQuota` — pricing
2. `getEscrowSnapshot` / `getLedgerEntries` — brand-escrow
3. `getBrandDnaSummary` / `listAudiencePersonas` — brand-centre
4. `getPlannerDrafts` / `getFunnelLeakSummary` — brand-centre
5. `listLiveCampaigns` / `getCampaignSnapshot` — UCE
6. `getCollaborationPipeline` — collaboration
7. `searchCreators` — when discovery API stable
8. Write staging tools — after HITL slice

Each tool:

- Accepts `brandProfileId` + typed params
- Returns DTO safe for LLM (no internal ids/secrets unless needed for widgets)
- Unit tested without calling Gemini

---

## Testing checklist

- [ ] Thread list scoped to brand — cannot read other tenant
- [ ] Quota increment at cap returns 403
- [ ] Monthly reset via lazy `resetAt` on next message after month boundary
- [ ] Slot session: partial → complete → widget or narrative
- [ ] Invalid Gemini JSON → 502 + log `VALIDATION_ERROR`
- [ ] Interaction log row for every orchestrator attempt
- [ ] HITL widget references valid idempotency + route

---

## Frontend handoff (later)

When UI starts:

- Consume `CoPilotChatPayload` renderer by `formatType` (product `result-format-architecture.md`)
- Usage meter from `GET /api/v1/pricing/usage` — field `MAX_AI_CHATS`
- Scope chips set `scopeContext` on thread or per-message header
- Aurora components — do not port inline CSS prototypes verbatim

---

## Related docs

- `docs/pricing/` — entitlements, usage API
- `docs/brand-centre/` — DNA, planner, intelligence tools
- `docs/escrow/` — vault and ledger
- `docs/chat-engine/product-docs/` — read-only product reference
