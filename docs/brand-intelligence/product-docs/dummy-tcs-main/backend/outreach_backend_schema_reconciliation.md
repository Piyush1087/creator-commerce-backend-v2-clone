# Creator Shop — Outreach Backend Schema Reconciliation

**Status:** FROZEN  
**Schema baseline:** `backend/campaign_schema.prisma` v1.5  
**Target schema:** v1.6  
**Scope:** Discovery → Outreach → Applicants bridge

## 1. Canonical domain position

Outreach is the Campaign-level contact lifecycle for a `UceCampaignCreator`. It does not target a CampaignAsset/Product or Brief. Product and Brief enter only when the creator independently creates an Application.

Canonical topology:

```text
UceCampaign
  └─ UceCampaignCreator
       ├─ UceCampaignCreatorRecommendation[]
       ├─ UceOutreach?                  // max 1 per CampaignCreator
       │    ├─ UceOutreachAttempt[]
       │    └─ UceOutreachTrackingEvent[]
       └─ UceApplication[]
```

`UceCampaignCreator` remains the durable Campaign↔Creator continuity identity across Discovery, Outreach and Applicants.

## 2. Channel resolution

`UceOutreach.channel` is resolved once, at first Outreach initiation, and is immutable for that Outreach.

- Marketplace creator → `PRIORITY_DM`.
- Manual/CSV creator with Marketplace capability available at Outreach initiation → `PRIORITY_DM`.
- Manual/CSV creator without Marketplace capability at Outreach initiation, including enrichment not yet run → `EMAIL`.
- If Email Outreach has already begun and Marketplace enrichment later resolves the creator, the existing Outreach remains Email.
- The Brand sees only one Outreach action per creator card; channel choice is system-resolved.

## 3. Outreach cardinality

- `UceCampaignCreator` → `UceOutreach?` is 0..1.
- `campaignCreatorId` on `UceOutreach` is unique.
- Priority DM permits one attempt in MVP.
- Email permits up to three `COMPOSE_INITIATED` attempts in MVP. These are repeated Gmail compose launches because Creator Shop cannot confirm an external Gmail send; they are not follow-up emails.
- Attempt-count limits are runtime policy and are not duplicated as persisted `maxAttempts` counters.

## 4. Message persistence

MVP uses a channel-specific composer to create the initial draft, but the Brand may freely edit it before confirming Outreach. Persist both system-composed and Brand-approved final content so the product can learn from Brand edits.

`UceOutreach` owns message evidence:

- `composerVersion?`
- `composedSubject?` — Email only
- `finalSubject?` — Email only
- `composedBody`
- `finalBody`

Priority DM and Email use separate composition contracts. Email attempts #2/#3 reuse the same Outreach content.

Composer preview/edit state is ephemeral. `UceOutreach` is created only when the first Outreach execution is successfully initiated/accepted, not when the preview is opened.

## 5. Tracking

Every Outreach contains one stable, opaque, unique tracking token. The tracking URL resolves to the Campaign through `Outreach → CampaignCreator → Campaign`; it does not encode Product/Brief targeting.

Raw click evidence is append-oriented through `UceOutreachTrackingEvent` with MVP event type `LINK_CLICKED`.

`hasClicked`, `firstClickedAt`, `lastClickedAt` and `clickCount` are derived projections and are not persisted on `UceOutreach`.

The tracking link does not expire merely because Outreach leaves the active workspace. Current Campaign accessibility determines the destination experience.

## 6. Attempt semantics

`UceOutreachAttempt` records execution evidence, not a second Outreach identity.

### Email

MVP only knows `COMPOSE_INITIATED`. Creator Shop must not infer `SENT`, `DELIVERED`, `OPENED` or provider failure from the Gmail handoff.

The actual destination email used by each compose initiation is preserved as `destinationRef`.

### Priority DM

Internal attempt lifecycle:

```text
ACCEPTED → SCHEDULED → EXECUTED
                    ↘ FAILED
                    ↘ CANCELLED
```

- `ACCEPTED`: Brand confirmation passed final eligibility/quota validation and the scheduler accepted the immutable payload.
- `SCHEDULED`: an execution time has been assigned.
- `EXECUTED`: Creator Shop successfully executed the Meta Priority DM action; this does not imply delivery/read/click.
- `FAILED`: execution was valid but failed operationally/provider-side.
- `CANCELLED`: execution was suppressed because current domain eligibility no longer permitted it.

`failureCode?` and `cancellationCode?` preserve machine-readable operational reasons without freezing provider-specific payloads into Campaign persistence.

`destinationRef?` preserves the actual execution destination used at attempt time; its interpretation is channel-specific.

## 7. No top-level Outreach status

Do not add `UceOutreachStatus` in v1.6. Active/Completed workspace placement and execution outcomes are derived from authoritative CampaignCreator, Outreach, Attempt and Application evidence.

In the UI, a creator leaves the default active Outreach view after:

- Priority DM: Brand Send is accepted into the scheduler.
- Email: first Gmail compose initiation succeeds.

The creator remains accessible under Outreach Completed. Rejected and Archived remain distinct operational buckets.

## 8. CampaignCreator archive evidence

Archive is orthogonal to Discovery review state. Do not add `ARCHIVED` to `UceCampaignCreatorReviewState`.

Add nullable `archivedAt` to `UceCampaignCreator`:

- `archivedAt != null` blocks Outreach and projects to Archived.
- Existing review/recommendation/history is preserved.
- A future explicit restore can clear the archive timestamp if product policy permits it.

## 9. Application attribution

Replace provisional `UceApplication.source String?` with typed `UceApplicationSource`:

- `DIRECT`
- `OUTREACH`

Default is `DIRECT`.

`OUTREACH` is assigned only when the creator's Application entry/session is attributable to the Outreach tracking path. Mere existence of an Outreach record does not imply Outreach attribution.

Application remains structurally independent from Outreach; no `outreachId` FK is added to `UceApplication` in MVP.

## 10. Outreach eligibility invariants

Before first Outreach initiation, runtime validates current Campaign and CampaignCreator eligibility, including:

- Campaign is creator-accessible and operationally eligible.
- At least one active CampaignAsset + published/active Brief path exists.
- Campaign remains within the applicable Outreach runway.
- CampaignCreator is not rejected or archived.
- CampaignCreator has no prior valid Application for the Campaign.
- No Outreach already exists for the CampaignCreator.
- Channel-specific capability exists.
- Tracking URL/token can be created.

A valid Application permanently suppresses future Campaign Outreach, even if that Application is later rejected, withdrawn, expired or superseded.

## 11. Quota and scheduler policy

MVP business cap:

- Maximum **50 new CampaignCreators / Campaign / day** entering Outreach.
- The first successful Outreach initiation consumes one Campaign daily slot.
- Email compose clicks #2/#3 consume no additional Campaign daily slot.
- A later cancelled/failed Priority DM does not refund historical daily quota.
- Scheduler spillover into the next day does not consume the next day's Campaign quota again.

Priority DM execution pacing:

- Maximum **4 actual Priority DMs / Campaign / hour**.
- Maximum **12 actual Priority DMs / Brand Meta account / hour**.
- Both constraints apply simultaneously.
- These are runtime/scheduler configuration, not Campaign schema fields.
- The Brand sees `Priority DM sent` when the send action is accepted; internal scheduling remains hidden.
- Immediately before actual Meta execution, runtime revalidates current Campaign/creator eligibility.

No daily quota table, hourly bucket model or scheduler queue model is added to the Campaign working schema in v1.6.

`UceOutreach.initiatedAt` is the business timestamp used for Campaign daily Outreach accounting; `createdAt` remains persistence provenance.

## 12. Discovery → Outreach orchestration

- Marketplace recommendations remain Campaign-level and ordered by Intelligence-owned Recommendation Score.
- Outreach does not own or recalculate Recommendation Score.
- Manual/CSV CampaignCreators participate in the same Outreach pipeline and may be contacted without waiting for Marketplace enrichment.
- Manual ingestion never bypasses the 50/Campaign/day Outreach cap.
- Duplicate CampaignCreators remain prevented by Campaign + platform + normalized social handle uniqueness; duplicate manual/CSV ingestion resolves/skips the existing CampaignCreator rather than creating a new one.
- Discovery maintains demand-driven rolling replenishment before actionable supply is exhausted.
- Exact buffer thresholds remain configurable/deferred.
- Replenishment reuses the deepest valid Intelligence stage (L3 → L2 → L1 → Marketplace acquisition as needed); raw/reusable pools remain Intelligence-owned.
- Campaign edits do not retroactively recompute already-published recommendations in MVP; new replenishment uses the latest Campaign context.

## 13. v1.6 schema patch surface

### New enums

```prisma
enum UceOutreachChannel { PRIORITY_DM EMAIL }
enum UceOutreachAttemptStatus { COMPOSE_INITIATED ACCEPTED SCHEDULED EXECUTED FAILED CANCELLED }
enum UceOutreachTrackingEventType { LINK_CLICKED }
enum UceApplicationSource { DIRECT OUTREACH }
```

### New models

- `UceOutreach`
- `UceOutreachAttempt`
- `UceOutreachTrackingEvent`

### `UceCampaignCreator`

Add:

```prisma
outreach   UceOutreach?
archivedAt DateTime? @map("archived_at")
```

### `UceApplication`

Replace:

```prisma
source String?
```

with:

```prisma
source UceApplicationSource @default(DIRECT)
```

## 14. Explicitly not persisted in v1.6

- Top-level Outreach status.
- UI workspace bucket.
- `maxAttempts` or mutable attempt counters.
- Click aggregates.
- Daily Campaign quota rows/counters.
- Priority DM hourly Campaign/Brand counters.
- Scheduler queue/bucket infrastructure.
- Composer/template library.
- Raw Meta/Gmail provider payloads.
- Product/Brief Outreach targeting.
- Outreach-owned Recommendation Score.
- Intelligence L1/L2/L3 pools/caches/scans.
- Application → Outreach ownership FK.

## 15. Production/runtime enforcement notes

The production merge/runtime must enforce transactionally:

- one Outreach per CampaignCreator;
- CampaignCreator/Campaign ancestry consistency;
- max 50 first Outreach initiations per Campaign/day;
- max one Priority DM attempt per Outreach;
- max three Email `COMPOSE_INITIATED` attempts per Outreach;
- valid channel × attempt-status combinations;
- idempotent Brand Send/Continue-to-Gmail actions;
- idempotent Priority DM scheduler execution;
- current Campaign/creator eligibility before scheduled Meta execution;
- Priority DM pacing at 4/Campaign/hour and 12/Brand-Meta-account/hour;
- application suppression of future Outreach;
- opaque/unpredictable tracking token generation;
- correct `DIRECT` vs `OUTREACH` Application attribution from entry evidence.

## 16. Frozen persistence boundary

Outreach persistence owns the CampaignCreator-level Outreach identity, resolved channel, composer/final message evidence, opaque tracking identity, execution-attempt evidence and raw tracking-click events.

Workspace projections, quota calculations, pacing, scheduler queues, delivery infrastructure and Intelligence computation remain derived/runtime/infrastructure concerns.

This reconciliation plan is **FROZEN** and is the canonical basis for `campaign_schema.prisma` v1.5 → v1.6.