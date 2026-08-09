# Campaign Frontend View DTO and Command Contract

**Status:** CANONICAL / STEP 4 — frontend-backend boundary definition  
**Scope:** Campaign feature content rendered inside `frontend/layout/app_shell/` Content Area.  
**Non-goals:** API route names, controllers, Prisma exposure, database changes, service implementation, Collaboration behavior, or Intelligence calculations.

## 1. Authority and boundary

This contract is subordinate to `campaign/README.md`, `backend/campaign_schema.prisma`, `backend/validation/**`, `campaign/backend/implementation_map.md`, `campaign/frontend/state_map.md`, and `frontend/layout/app_shell/**`.

A projection is an application read model, not a serialized Prisma model. It exposes only display-safe fields, IDs needed for a supported command or lazy read, state/status, and server-derived capabilities. It must not require the frontend to derive lifecycle legality, execution readiness, permission, Outreach channel, quota, tracking identity, applicant eligibility, or Intelligence meaning.

The Campaign feature receives these projections inside the shell Content Area. It never supplies global desktop/mobile navigation or shell chrome.

### Common projection conventions

Every asynchronously loaded surface returns a surface state: `READY`, `EMPTY`, `UNAVAILABLE`, or `ERROR`. Initial skeleton state is frontend-local before a read settles.

- `EMPTY`: successfully queried, no applicable content.
- `UNAVAILABLE`: domain/capability says the surface cannot currently supply content; include a presentation-safe reason category, never provider credentials/raw errors.
- `ERROR`: recoverable/non-recoverable read failure; include a machine-readable category and retry capability.
- `READY`: include content; bounded summaries may be empty while their surface remains READY.

Every actionable projection uses a server-derived capability record:
- `available` — whether the command may currently be offered;
- `presentation` — `ENABLED`, `DISABLED`, or `HIDDEN`;
- `reasonCategory` when not enabled/visible;
- `requiresConfirmation` only where the canonical action already needs it.

The frontend owns loading, focus, selected filters, drawer/modal visibility, internal scrolling, and in-flight presentation. It does not make capability decisions.

## 2. Initial Campaign Page read model

**Read purpose:** render the Campaign shell/steady state, deterministic hydration outcome, compact Products & Briefs context, bounded Copilot/Performance content, and workspace summaries without waiting for large lists or drawer data.

**Initial payload: `CampaignPageView`**

| Projection | Required fields | Owner |
| --- | --- | --- |
| `campaign` | `id`, `name`, `lifecycleStatus`, `creationSource`; Products/Briefs counts; header capabilities for View, Edit, Share, Pause, Resume, Complete, Archive | Campaign / CampaignService / CampaignQueryService |
| `hydration` | resolved hydration outcome from the frozen resolver; `executionReady`; primary focus; post-live-readiness-block indicator; instantiated/visible workspace summary; never raw resolver inputs as a replacement for this result | CampaignQueryService |
| `productsBriefsSummary` | surface state; Product rows with `campaignAssetId`, display name, active/historical status, associated Brief summaries (`briefId`, name, display status); Add Product/Add Brief capabilities | OpportunityService / CampaignQueryService |
| `copilotSummary` | surface state; concise summary when supplied; at most the Campaign-page priority actions with `id`, short label/context, target surface/action token, capability; no model/provider internals | Campaign-facing accepted Intelligence projection / CampaignQueryService |
| `performanceSummary` | surface state; supplied metric chips (`metricId`, label, formatted value, semantic tone); reporting availability; View Report capability | Report/Calculation projection / ReportingService / CampaignQueryService |
| `workspaces` | per workspace: `DISCOVERY`, `APPLICANTS`, `COLLABORATIONS`; instantiated/visible status, compact count/label, expand capability, surface state, and lazy-read availability. Collaboration carries references only when independently supplied. | CampaignQueryService; independent Collaboration owner for Collaboration values |
| `share` | Share capability and, if presentation requires it, supported channel identifiers; no tracking token/link before deliberate Share execution | ShareService / CampaignQueryService |

**Initial-payload semantics**

- It must contain the resolved hydration/capability outcome, not leave the frontend to reconstruct it from Prisma-shaped counts or statuses.
- Discovery and Applicants item collections are not required in the initial payload. Their summaries support the collapsed approved UI; collection reads begin when their workspace is opened.
- A bounded Copilot/Performance projection belongs initially so the steady-state shell can render without a second page-level layout decision. Its independent state can be `UNAVAILABLE` or `ERROR` without failing Campaign Page hydration.
- Products & Briefs inline names belong initially. Detailed product/brief content does not.
- The payload never contains shell navigation/header/bottom-nav data.

## 3. Lazy-loaded read models

| Read surface | Purpose and minimum projection | Owner | State semantics and consumed capabilities |
| --- | --- | --- | --- |
| Campaign Details | Populate Campaign Details Drawer: Campaign identity, accepted strategy, targeting, commercials, published/live/completed/archived timestamps, creation provenance where displayable, and supplied edit/lifecycle capabilities. | CampaignService / CampaignQueryService | Lazy on **View**. READY, ERROR. Drawer edit controls only follow supplied capabilities. |
| Product Details | Product Drawer: selected Campaign Asset identity/display context, active/paused/historical display state, associated Brief summaries, and supplied product/brief capabilities. | OpportunityService / CampaignQueryService | Lazy on product selection. READY, ERROR, NOT_FOUND-equivalent failure category. |
| Brief Details | Brief Drawer: Brief identity, status, creation source, display-safe guidance/deliverable projection, and edit/pause capability. | OpportunityService / CampaignQueryService | Lazy on brief selection. READY, ERROR, NOT_FOUND-equivalent failure category. |
| Discovery workspace | Paginated/filterable Creator Card projection: `campaignCreatorId`, creator display identity/avatar/category, selected supplied quick metrics/context, recommendation/match label only where supplied, source/review/outreach summary, Creator Profile capability and Outreach capability. Include collection cursor/page state and server-applied filter summary. | CampaignCreatorService, RecommendationService, OutreachService / CampaignQueryService | Lazy on expansion/Quick Discovery. READY, EMPTY (first-time acquisition), EMPTY/no-results (filter result), UNAVAILABLE (for example integration capability), ERROR. Meta/outreach capabilities are supplied; UI never selects the canonical channel. |
| Creator Profile | Creator Drawer: CampaignCreator display identity plus composed Campaign-context detail from Discovery/Applications/Outreach. Include only display-safe supplied projections and action capabilities. | CampaignCreatorService / CampaignQueryService; source services own evidence | Lazy on creator selection. READY, ERROR, unavailable related subprojection states. This is the detailed-information boundary; cards remain concise. |
| Outreach composer | Focused composer read: selected `campaignCreatorId`, server-resolved available/not-available state, presentation-safe channel/result state when composition is available, editable fields permitted for that state, attempt/retry capability, and confirmation requirement. | OutreachService | Lazy when starting outreach. READY, UNAVAILABLE, ERROR. Do not return quota arithmetic, raw provider data, or a frontend-selectable channel rule. |
| Applicants workspace | Paginated/filterable Applicant Card projection: `applicationId`, `campaignCreatorId`, concise creator card data, application status/source/submission timestamp where displayable, Applicant Intelligence projection, and Approve/Reject/Profile capabilities. Include cursor/page and server-applied filter summary. | ApplicationService, ApplicantIntelligenceService / CampaignQueryService | Lazy on expansion/Quick Applicants. READY, EMPTY (no pending while workspace remains instantiated), ERROR. Terminal/conflict outcomes are not inferred from card state. |
| Applicant Intelligence | Nested per applicant or independently refreshable projection: `PROCESSING`, `READY`, or `UNAVAILABLE`; READY may include supplied score, concise strengths/weaknesses/breakdown, version/evaluated time where displayable. | ApplicantIntelligenceService; Intelligence owns calculation | Must not block Approve/Reject. It may refresh independently with READY/UNAVAILABLE/ERROR presentation. |
| Reporting detail | Campaign Report surface: report availability, selected/latest calculation identity/version/time range, supplied metrics, insights, provenance display projection where approved, finality, and View capability. | ReportingService / CampaignQueryService; Intelligence owns calculation | Lazy on View Report. READY, EMPTY/no publishable calculation, UNAVAILABLE/degraded, ERROR. No client calculation. |
| Share preparation/result | Share modal gets supported channels/capability from initial page; deliberate execution returns the prepared message/link/handoff data and accepted Share evidence safe for presentation. | ShareService / CampaignTrackingService | There is no ambient tracking-token read. Result is command output. READY/UNAVAILABLE/ERROR as command feedback. |
| Collaboration references | Only independently owned reference ID, display label/status/count, and Open capability when an independent Collaboration query supplies them. | Collaboration module; CampaignQueryService composes reference only | Lazy only if independently instantiated. EMPTY/UNAVAILABLE/ERROR from Collaboration owner. No inferred application-to-collaboration conversion. |

## 4. Command contract

Command names below are application-boundary names, not HTTP routes. Inputs use existing executable Zod contracts wherever one is frozen. All success results return the updated affected summary/projection and relevant capabilities so the frontend does not locally manufacture state.

### Shared failure contract

Each failed command returns a stable machine-readable category plus a presentation-safe message and, where valid, the refreshed affected projection/capabilities. The frontend needs these category families:

- `VALIDATION` — input fails executable boundary validation;
- `AUTHENTICATION` or `AUTHORIZATION`;
- `NOT_FOUND`;
- `STATE_CONFLICT` — stale/competing lifecycle or terminal action won;
- `CAPABILITY_UNAVAILABLE` — current lifecycle/readiness/integration prevents action;
- `ELIGIBILITY` or `LIMIT` — server-owned application/outreach constraint;
- `DUPLICATE` — duplicate creator identity or replay resolution where applicable;
- `QUOTA` or `PACING` — server-owned Outreach capacity/scheduler constraint;
- `INTELLIGENCE_UNAVAILABLE`;
- `INTEGRATION_UNAVAILABLE` or `PROVIDER_FAILURE`;
- `RETRYABLE` or `INTERNAL`.

These are presentation categories, not a promise to expose service internals or raw provider errors. Exact transport status/route conventions remain production-architecture decisions.

| Command surface | Input DTO | Owner / existing validation | Success result | Request identity |
| --- | --- | --- | --- | --- |
| View Campaign / Product / Brief / Creator / Report | Selected projection ID only; this is a lazy read, not a mutation. | CampaignQueryService / relevant owner | Requested detail projection. | No |
| Edit Campaign | `campaignId` plus permitted changed Campaign fields; Draft uses `updateDraftCampaignInputSchema`; Live/Paused uses `updateLiveCampaignInputSchema`. | CampaignService; `backend/validation/campaign/campaign.schema.ts` | Updated Campaign header/details/hydration/capabilities. | No frozen requestId requirement |
| Publish, Pause, Resume, Complete, Archive Campaign | `campaignId`. | CampaignService; `publishCampaignInputSchema`, `pauseCampaignInputSchema`, `resumeCampaignInputSchema`, `completeCampaignInputSchema`, `archiveCampaignInputSchema`. | Updated lifecycle/header/hydration/workspace and capability projection. | No frozen requestId requirement |
| Add Product | One discriminated asset input: `campaignId` plus exactly one supported source reference for `BRAND`, `OFFERING`, or `OFFER`. | OpportunityService; `addCampaignAssetInputSchema`. | New Product summary plus refreshed Products & Briefs/hydration capability projection. | No frozen requestId requirement |
| Deactivate Product | `campaignId`, `campaignAssetId`. | OpportunityService; `deactivateCampaignAssetInputSchema`. | Refreshed Product/Brief and hydration/capability projection. | No frozen requestId requirement |
| Add/Edit/Publish/Pause Brief | Create: `campaignAssetId` and allowed draft fields; update: `briefId` and allowed fields; publish uses required published Brief fields; pause: `briefId`. | OpportunityService; `createBriefDraftInputSchema`, `updateBriefDraftInputSchema`, `publishBriefInputSchema`, `updatePublishedBriefInputSchema`, `pauseBriefInputSchema`. | Refreshed Brief/Product summary and readiness/hydration capabilities. | No frozen requestId requirement |
| Manual creator add | `campaignId`, `platform`, `socialHandle`, `email`. | CampaignCreatorService; `manualCreatorInputSchema`. | Added/refreshed Creator Card and Discovery summary. | No frozen requestId requirement |
| Creator CSV import | `campaignId`, rows using the canonical manual-creator fields. | CampaignCreatorService; `importCreatorsCsvInputSchema`. | Import progress/result projection and refreshed Discovery summary. | No frozen requestId requirement |
| Archive Campaign creator | `campaignCreatorId`. | CampaignCreatorService; `archiveCampaignCreatorInputSchema`. | Refreshed Discovery collection/summary. | No frozen requestId requirement |
| Compose Outreach | `campaignCreatorId`, optional `brandFreeFormInstruction`. | OutreachService; `composeOutreachInputSchema`. | Composer projection with backend-resolved channel/path and permitted final editable fields. | No |
| Initiate Email Outreach | `campaignCreatorId`, `requestId`, `finalSubject`, `finalBody`. | OutreachService; `initiateEmailOutreachInputSchema`. | Accepted compose-handoff/evidence projection and refreshed Creator/Outreach summary; never fabricated send/delivery truth. | **Required** |
| Confirm Priority DM Outreach | `campaignCreatorId`, `requestId`, `finalBody`. | OutreachService / PriorityDmScheduler; `confirmPriorityDmOutreachInputSchema`. | Accepted/scheduled attempt projection and refreshed Creator/Outreach summary. | **Required** |
| Retry Email compose | `campaignCreatorId`, `requestId`. | OutreachService; `retryEmailComposeInputSchema`. | New eligible compose/handoff projection or relevant limit/capability result. | **Required** |
| Approve / Reject Applicant | `applicationId`. | ApplicationService; `approveApplicationInputSchema`, `rejectApplicationInputSchema`. | Updated Applicant Card/workspace summary plus refreshed capabilities; approval may include only an independent Collaboration reference if already returned by its owner. | No frozen requestId requirement |
| Share Campaign | `campaignId`, supported `channel`, `requestId`. | ShareService / CampaignTrackingService; `executeCampaignShareInputSchema`. | Per-intent accepted Share evidence and prepared message/tracked-link/handoff projection. | **Required** |

### Commands intentionally absent from this contract

- No frontend command publishes creator recommendations, applicant intelligence, or report calculations. The executable `publish*Intelligence` schemas are inbound Intelligence-to-Campaign acceptance contracts, not Brand UI commands.
- No collaboration create/update/transition command.
- No raw tracking, provider, scheduler, quota, report-calculation, or Intelligence-execution command.
- No frontend command for a Copilot calculation; Copilot actions resolve to an already-owned Campaign command or lazy read.

## 5. Read/command composition rules

- The initial page read is the only page-level composition boundary. Each lazy read remains owned by the service/domain that supplies it.
- A command response refreshes only the affected projections plus the authoritative Campaign hydration/capability summary when it may change. It does not force frontend reconstruction from entities.
- Drawer/modal state is not persisted in Campaign data.
- Filters and pagination are query inputs; their exact vocabulary/cursor encoding belongs to the production read implementation, not Prisma or this persistence model.
- Campaign frontend must map `UNAVAILABLE`, `ERROR`, `EMPTY`, and supplied capabilities to Aurora shared loading/empty/error/disabled patterns and the approved Stitch states.

## 6. Implementation blockers / open decisions

1. **Production integration boundary:** this reference repository has no production controller/route/auth/session conventions. Transport shape, authorization context wiring, and exact route placement must be reconciled in the production application.
2. **Service/query implementation:** the listed Campaign services and `CampaignQueryService` are canonical ownership specifications, not executable implementations.
3. **Read query mechanics:** pagination/cursor/filter/sort vocabulary for Discovery and Applicants is not frozen; it cannot be inferred from the visual filters.
4. **Campaign Intelligence runtime:** recommendation, applicant-match, and reporting execution/acceptance adapters and durable generic Intelligence runtime persistence are not implemented. The frontend may consume only supplied projection/status until they exist.
5. **Product selection source:** Add Product’s valid discriminated references are frozen, but the production source/picker read contract for Brand/Offering/Offer selection is not defined here.
6. **Collaboration read contract:** Campaign can compose independently owned references only after the Collaboration module exposes an owned projection.

None of these authorize the frontend to substitute mock domain rules, Prisma access, or locally calculated Intelligence.
