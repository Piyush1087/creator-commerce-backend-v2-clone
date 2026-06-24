# Chat Engine — schema migration notes

**Rule:** Add **co-pilot session tables only**. Do not duplicate `BrandProfile`, UCE campaigns, `BrandEscrowVault`, or subscription tables from product prototypes (`product-docs/prisma-models.md`, `technical-doc.md`).

Tenancy anchor: **`brandProfileId`** → `brand_profiles.id` (same as Brand Centre, Pricing, Escrow).

---

## 1. New enums

```prisma
enum CoPilotScopeContext {
  GLOBAL
  BRAND_CENTRE
  ANALYTICS
  ESCROW
}

enum CoPilotMessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum CoPilotFormatType {
  CONVERSATIONAL_NARRATIVE
  METRIC_HIGHLIGHT_GRID
  TABULAR_AUDIT_DATA
  POLYMORPHIC_ENTITY_CAROUSEL
  INTERACTIVE_EXECUTION_WIDGET
  SLOT_FILLING_CLARIFICATION
}

enum CoPilotInteractionStatus {
  SUCCESS
  QUOTA_DENIED
  MODERATION_BLOCKED
  VALIDATION_ERROR
  ERROR
}

enum CoPilotLinkedEntityType {
  CAMPAIGN
  COLLABORATION
  PLANNER_CARD
  NONE
}
```

Align `CoPilotFormatType` with product `result-format-architecture.md`. Resolve enum naming drift with UCE/Brand Centre before migration.

---

## 2. Core models (proposed)

### `CoPilotThread`

Conversation container (sidebar row).

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `brandProfileId` | UUID | FK → `brand_profiles`, indexed |
| `createdByUserId` | UUID | FK → user |
| `title` | String | Auto-generated from first turn or LLM |
| `scopeContext` | `CoPilotScopeContext` | Default GLOBAL |
| `linkedEntityType` | `CoPilotLinkedEntityType` | Optional |
| `linkedEntityId` | UUID? | e.g. campaign id |
| `archivedAt` | DateTime? | User or system archive |
| `lastMessageAt` | DateTime | Sidebar sort |
| `createdAt` / `updatedAt` | DateTime | |

Indexes: `(brandProfileId, lastMessageAt DESC)`, `(brandProfileId, archivedAt)`.

### `CoPilotMessage`

Immutable message stream (user + assistant).

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `threadId` | UUID | FK cascade |
| `role` | `CoPilotMessageRole` | |
| `textContent` | Text? | Plain user text or narrative backbone |
| `payloadJson` | Json? | Full `CoPilotChatPayload` for assistant turns |
| `formatType` | `CoPilotFormatType?` | Denormalized for queries |
| `createdAt` | DateTime | |

Indexes: `(threadId, createdAt)`.

**Size control:** large widgets stay in `payloadJson`; consider compression or S3 offload if payloads exceed ~16KB routinely.

### `CoPilotSlotSession`

Multi-turn slot filling state (product `stagedPayload` + `missingSlots`).

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `threadId` | UUID | FK unique active per thread |
| `intentWorkspaceContext` | String | e.g. `CAMPAIGN_LAUNCH` |
| `stagedPayload` | Json | Accumulated fields |
| `missingSlots` | Json | Slot definitions from last assistant turn |
| `expiresAt` | DateTime | TTL default 24h |
| `createdAt` / `updatedAt` | DateTime | |

### `CoPilotInteractionLog`

Audit + token/cost tracking (product `ai_interaction_logs`).

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `brandProfileId` | UUID | Indexed |
| `userId` | UUID | |
| `threadId` | UUID? | |
| `messageId` | UUID? | Assistant message id |
| `scopeContext` | `CoPilotScopeContext` | |
| `intentKey` | String? | |
| `modelId` | String | |
| `inputTokens` | Int? | |
| `outputTokens` | Int? | |
| `estimatedCostMinor` | Int? | Optional fixed-point |
| `toolsInvoked` | String[] | Tool names |
| `status` | `CoPilotInteractionStatus` | |
| `latencyMs` | Int? | |
| `idempotencyKey` | String? | HITL staging |
| `errorCode` | String? | |
| `createdAt` | DateTime | Indexed for admin rollups |

**Retention:** recommend **≥ 13 months** for finance/support even if thread messages are trimmed (product to confirm).

### `CoPilotMessageFeedback` (optional v1)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | |
| `messageId` | UUID | FK |
| `userId` | UUID | |
| `rating` | Enum UP / DOWN | |
| `reason` | String? | Product enum: Inaccurate, Unhelpful, Hallucination |
| `createdAt` | DateTime | |

---

## 3. Existing tables (read/write via tools — no duplication)

| Product prototype | v2 model / module |
| --- | --- |
| `brands` | `BrandProfile` |
| `brand_audience_personas` | `BrandAudiencePersona` |
| `campaigns` | UCE campaign tables / `BrandPlannerCard` |
| `escrow_wallets` | `BrandEscrowVault` |
| `wallet_transactions` | Escrow ledger models in brand-escrow feature |
| `brand_subscriptions` / usage | `BrandSubscription`, `FeatureUsage` |

---

## 4. Retention and DB impact

**MVP (proposed):**

- No hard delete of threads
- Sidebar API: `LIMIT 30` ordered by `lastMessageAt`
- List all: cursor pagination

**Scale (phase 2):**

| Policy | Trigger |
| --- | --- |
| Auto-archive threads inactive > 90 days | Nightly cron |
| Cap active threads per brand (e.g. 500) | Archive oldest |
| Summarize thread when message count > 500 | Background job → `threadSummary` text column (optional) |

**Rough sizing:** 1k brands × 100 threads × 50 messages × ~2KB ≈ 10GB payload+text — acceptable; monitor `payloadJson` bloat.

---

## 5. Migration checklist

- [ ] Product answers retention in [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md)
- [ ] Prisma models reviewed — no duplicate domain tables
- [ ] FK cascade: deleting brand profile cascades co-pilot threads
- [ ] `npm run db:migrate:dev` locally
- [ ] Document in `docs/database/` if team convention requires

---

## 6. Zod alignment

Shared package or feature-local schemas:

- `copilot-payload.schema.ts` — mirrors product `CoPilotChatPayloadSchema`
- `create-thread.schema.ts`, `post-message.schema.ts`
- Widget execution payloads reference existing feature DTOs by `requiredZodValidationSchemaName` (string registry) or explicit route map in orchestrator

Do not fork `CreateCampaignSchema` from product docs if UCE/Brand Centre already owns campaign creation validation — **wrap or import** existing schemas.
