# Campaign Backend — Canonical Implementation Map

Status: CANONICAL / FROZEN THROUGH STEP 5B
Version: 1.1

This file maps the frozen Campaign domain into backend implementation responsibilities. It does not duplicate field-level Prisma or Zod definitions.

## 1. Authority

Use this order when artifacts overlap:

1. `backend/campaign_schema.prisma` — persisted Campaign truth (v1.9).
2. `backend/validation/**/*.schema.ts` — executable request/boundary validation.
3. This file — service ownership, lifecycle, transactions, concurrency, orchestration and integrations.
4. Focused frozen module contracts — detailed domain/runtime behavior.
5. `*_schema_reconciliation.*` and `backend/reconciliation/*` — historical reconciliation only.

A conflict is a reconciliation issue; do not silently implement a lower-authority artifact.

## 2. Aggregate and ownership

Campaign evolves the existing `UceCampaign` aggregate. Do not create a parallel AI Campaign aggregate.

Campaign owns accepted Campaign values, lifecycle, Campaign strategy/targeting/commercial configuration, Campaign Assets, Briefs, CampaignCreator workflow identity, Applications/Snapshots, Campaign-facing Outreach evidence, Share evidence/tracking and Campaign-facing Reporting/Intelligence projections.

Brand-owned facts remain Brand context. Deliverables belong to Brief. Readiness/capabilities/Active Opportunity are derived unless explicitly persisted in Prisma.

Collaboration is a separate independent module. Campaign does not own Collaboration workflow, deliverable execution, product dispatch, content approval, creator payment or posting completion. Campaign Page may map/render the same Collaboration entity in its workspace, but no duplicate Collaboration aggregate or placeholder Campaign FK should be introduced now.

## 3. Campaign lifecycle

Canonical lifecycle:

`DRAFT -> PUBLISHED -> LIVE <-> PAUSED -> COMPLETED -> ARCHIVED`

`PUBLISHED` is intentional: Campaign definition is published but execution readiness is not yet satisfied. `LIVE` requires the frozen execution-readiness conditions. AI-recommended Campaign acceptance may land directly in LIVE when Campaign + Asset + Brief are accepted coherently.

`publishedAt` and `liveAt` are distinct facts. `liveAt` represents first transition to LIVE and is not rewritten on resume.

Services enforce legal transitions with authoritative current-state checks/conditional writes. UI disabling is never the enforcement boundary.

## 4. Core service boundaries

Logical code boundaries, not separate deployable services:

- `CampaignService` — Campaign creation/edit/lifecycle.
- `OpportunityService` — Campaign Asset + Brief operations and Active Opportunity derivation.
- `CampaignCreatorService` — Campaign-level creator identity/manual add/import/archive.
- `RecommendationService` — Campaign-facing Discovery context/run/result orchestration.
- `OutreachService` — Outreach eligibility, channel resolution, quota, composition and accepted evidence.
- `PriorityDmScheduler` — already-accepted Priority DM execution pacing.
- `ApplicationService` — submit/withdraw/approve/reject/supersede/expire and Snapshot orchestration.
- `ApplicantIntelligenceService` — Campaign-facing AI Match projection acceptance.
- `ShareService` — Share action/message/tracked-link evidence.
- `ReportingService` — stable Report + immutable Calculation acceptance/latest pointer.
- `CampaignTrackingService` — opaque tracked Campaign URLs and click attribution.
- `CampaignQueryService` — Campaign Page/workspace read composition.

## 5. Validation split

Zod owns request shape, enum/range/object validation and frozen cross-field rules represented in executable schemas.

Services own authorization, ownership, eligibility, lifecycle, current-state rules, derived readiness, cross-record limits, channel resolution and orchestration.

Prisma/PostgreSQL owns durable relations, uniqueness/referential integrity and transaction/concurrency enforcement.

Frontend must not reproduce backend authority.

## 6. Campaign Page / read architecture

Campaign Page is a read/write surface over canonical entities, not a separate aggregate.

`CampaignQueryService` may compose Campaign, Assets, Briefs, Discovery, Outreach, Applicants, Collaboration references, Reporting and Intelligence projections into view DTOs. UI-only state is not persisted merely because a screen needs it.

The future Stitch/Codex integration should map UI states to query/view DTOs and commands after the frontend reference state is imported; it must not redesign Campaign domain rules.

## 7. Discovery / creator identity

`UceCampaignCreator` is the Campaign-level normalized creator identity used across Discovery, Outreach and Applicants.

Manual creator add/import must resolve against Campaign creator identity and reject/resolve duplicate creator identity rather than creating a second CampaignCreator for the same Campaign.

Recommendation Context -> Run -> Recommendation preserves Campaign-facing recommendation history. Detailed scans, reusable intelligence, processor execution, caches and computation remain Intelligence-owned.

## 8. Outreach

Backend resolves the canonical Outreach channel; frontend does not choose Email vs Priority DM.

Brand free-form instruction is accepted for composition. Email and Priority DM have separate deterministic composition because channel behavior differs. Both include a tracked Campaign URL.

Email MVP semantics:

- Creator Shop opens/hands off a Gmail compose; it does not send the email.
- strongest Campaign-owned truth is `COMPOSE_INITIATED`, never SENT/DELIVERED/OPENED;
- maximum 3 Brand clicks/compose attempts;
- Email attempts #2/#3 do not consume additional Campaign daily Outreach quota;
- Email follow-up happens in Gmail and is outside the MVP Campaign workflow.

Campaign daily Outreach capacity is max 50 first Outreach initiations per Campaign/day.

Priority DM semantics:

- accepted Outreach is persisted before scheduler execution;
- scheduler pacing is max 12 Priority DMs per Brand Meta account/hour;
- there is no 4/Campaign/hour rule;
- Campaign lifecycle changes after acceptance do not cancel the already-accepted DM;
- provider execution is normalized behind a Meta adapter.

`requestId` on Outreach Attempt protects replay of one command; deliberate Email attempts use new request IDs.

## 9. Applications

Application submission creates Application + immutable `UceApplicationSnapshot` atomically. Applicant Intelligence evaluates the submission-time Snapshot, not later mutable Campaign state.

Limits exclude WITHDRAWN and are concurrency-safe service/database invariants:

- max 2 Applications per creator per Campaign;
- max 5 Applications per creator per Brand.

Submission must serialize/protect both logical scopes: Creator x Campaign and Creator x Brand.

`requestId` protects replay of one Apply command; it does not prevent a legitimate second Application.

Approval is atomic with sibling supersession in the frozen approval scope. Completion expires remaining PENDING Applications. Competing terminal transitions use authoritative transactional state checks so commit order determines the valid winner.

Applicant Intelligence states are `PROCESSING`, `READY`, `UNAVAILABLE`; Intelligence must never gate Brand Approve/Reject.

## 10. Share

Share is Campaign-owned action evidence, not delivery evidence.

MVP channels are the frozen Share channels represented in Prisma/Zod. Each deliberate Share action gets its own tracking identity. `requestId` prevents technical replay of the same Share command while allowing unlimited intentional Shares.

Backend owns deterministic message composition and tracked Campaign URL. Browser/platform handoff does not imply delivery/read status.

Preview metadata may resolve a Campaign/Product visual, then Brand logo, then a default Campaign visual; this is rendering/resolution behavior and does not require a new persistence aggregate.

## 11. Tracking

Tracked URLs use an opaque server-resolved token. Do not trust mutable client query parameters as attribution truth.

Tracking identity survives Campaign PAUSED/COMPLETED/ARCHIVED states. A historical link records its click and then resolves current Campaign availability/state.

Outreach and Share share tracking infrastructure while retaining explicit origin attribution.

## 12. Reporting

Intelligence owns calculation. Campaign owns the stable Report identity, immutable successful Calculation history and `latestCalculationId` pointer.

Accepting a new successful Calculation and advancing the latest pointer is atomic. Campaign does not invent report metrics.

Running/failed/retry execution evidence remains Intelligence-owned. Campaign must not add a Reporting job table merely to make itself self-contained.

## 13. Intelligence boundary

Campaign-side adapter capabilities:

- request creator recommendations;
- request Applicant Match;
- request Report calculation.

Campaign owns WHEN work is required, authoritative Campaign/Application context, Campaign-facing context/run/projection identity and validation/persistence of accepted results.

Intelligence owns HOW recommendations/scores/reports are calculated, processor/model/tool selection, reusable intelligence, artifacts, detailed execution telemetry, retry/failure state and computation lineage.

Every required asynchronous Intelligence operation must eventually have durable Intelligence-owned execution evidence so a post-commit dispatch failure cannot silently lose required work. The current `backend/intelligence_schema.prisma` has not yet fully implemented that generic runtime persistence layer; do not solve that by adding Campaign job tables.

Inbound Intelligence results must be context/version bound, replay-safe and unable to overwrite a newer accepted result merely because an older run finishes later.

## 14. Collaboration boundary

Application APPROVED is the Campaign-side handoff point.

Campaign may expose approved Campaign/Application/Snapshot context through a future Collaboration handoff adapter, but Collaboration remains independently owned. Do not create Collaboration rows, snapshots or workflow transitions inside Campaign transactions until the Collaboration module itself is designed and its relation ownership is reconciled.

## 15. Transactions

Required atomic boundaries include:

- Application + Snapshot creation;
- Application limit enforcement under protected Creator x Campaign and Creator x Brand scopes;
- Application approval + sibling supersession;
- Campaign completion + remaining PENDING -> EXPIRED consequences;
- Campaign/Asset/Brief lifecycle state-conditioned transitions where races matter;
- Outreach quota consumption together with accepted Outreach action;
- Priority DM acceptance before scheduler execution;
- Report Calculation creation + latest pointer update.

Do not keep a database transaction open while calling Meta, Gmail handoff, Intelligence or other external systems.

## 16. Concurrency and request replay

Use targeted protection rather than making the whole Campaign backend SERIALIZABLE.

Critical scopes:

- Creator x Campaign Application limit;
- Creator x Brand Application limit;
- Application approval sibling scope;
- Campaign daily Outreach capacity;
- Campaign/Asset/Brief lifecycle transitions.

Lifecycle commands should use current-state/conditional transition semantics so stale writes cannot resurrect terminal states.

Durable `requestId` is persisted on Application, Outreach Attempt and Campaign Share. Same request replay resolves to existing command evidence; a deliberate repeated business action uses a new requestId.

Do not add a generic Campaign command-execution/idempotency table for MVP.

## 17. Async execution rule

Required async consequences execute externally only after Campaign-domain commit.

Durable evidence of pending work must exist in the owning domain before/with the triggering transaction so work can be recovered. Prefer existing domain records as recoverable work sources rather than introducing a generic Campaign event/outbox platform for MVP.

Priority DM scheduler reads accepted unsent Attempts. Campaign-facing Intelligence context/run/projection records remain separate from Intelligence-owned processor execution evidence.

## 18. Integration adapters

Provider/independent-system details sit behind logical adapters:

- `IntelligenceAdapter` — Recommendations, Applicant Match, Reporting requests/results.
- `PriorityDmProvider` — Meta authentication/request/response/error normalization only.
- `EmailHandoffAdapter` — Gmail compose handoff only; never fabricates send evidence.
- `CollaborationHandoff` — future boundary only; no Campaign-owned Collaboration aggregate.

Provider credentials and raw provider errors must not leak into Campaign DTOs/domain logic.

## 19. Error normalization

Adapters normalize provider failures into internal categories such as authentication required, rate limited, retryable failure, permanent failure, provider unavailable or invalid response. Domain services decide consequences.

External execution failure does not roll back already-committed Campaign truth. Example: a Meta failure updates Attempt execution evidence; it does not erase accepted Outreach/quota history.

## 20. Canonical implementation status

Current executable/persistence artifacts:

- `backend/campaign_schema.prisma` v1.9;
- `backend/validation/shared/`;
- `backend/validation/campaign/`;
- `backend/validation/assets-briefs/`;
- `backend/validation/discovery/`;
- `backend/validation/outreach/`;
- `backend/validation/applicants/`;
- `backend/validation/share/`;
- `backend/validation/intelligence/`.

Reconciliation artifacts are SUPERSEDED FOR IMPLEMENTATION once represented in these canonical layers. Focused frozen domain/runtime contracts remain useful detailed specifications.

## 21. Explicit non-goals for Campaign MVP

Do not introduce without a new frozen decision:

- duplicate Campaign aggregate;
- Campaign-level deliverables;
- persisted Active Opportunity/readiness/capability flags;
- generic Campaign event bus/outbox platform;
- generic Campaign idempotency table;
- Campaign Reporting job table;
- Campaign-level Priority-DM hourly quota bucket;
- AI Brief provenance fields beyond the frozen `creationSource` contract;
- placeholder/duplicate Collaboration aggregate;
- Gmail delivery/open truth in MVP;
- Intelligence scoring/calculation algorithms inside Campaign.

## 22. Developer integration rule

This repository is a handoff/reference repository, not automatically the production application repository. Integrate these frozen semantics into the production backend deliberately; do not mechanically replace production models merely because this repository uses a working representation.
