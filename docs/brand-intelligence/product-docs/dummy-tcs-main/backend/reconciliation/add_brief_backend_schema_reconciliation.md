# Add Brief — Backend Schema Reconciliation

Version: 1.0  
Status: FROZEN RECONCILIATION CONTRACT  
Module: Campaign / Add Brief

## 1. Purpose

This artifact defines the persistence changes required to support the frozen Add Brief domain, UI, runtime, lifecycle and validation contracts.

It reconciles Add Brief against the existing Creator Shop production backend model, `backend/campaign_schema.prisma`, the frozen Campaign lifecycle/readiness model, the frozen Campaign Asset domain, and the frozen Add Brief product/UI contract.

This document is a migration and integration guide. It does NOT define a standalone replacement Prisma schema. The canonical Campaign working schema remains `backend/campaign_schema.prisma`. The Add Brief schema must extend that Campaign aggregate.

## 2. Existing Campaign Persistence Boundary

The reconciled Campaign hierarchy currently ends at:

```text
UceCampaign
└── UceCampaignAsset
```

`UceCampaignAsset` represents the Campaign-owned link to one authoritative Brand Centre entity.

Add Brief extends this hierarchy to:

```text
UceCampaign
└── UceCampaignAsset
    └── UceBrief
        └── UceBriefDeliverable
```

No separate Campaign aggregate is introduced.

## 3. Canonical Ownership

### Campaign owns

- Campaign objective
- KPIs
- publishing window
- enabled platforms
- creator archetypes
- audience targeting
- follower eligibility
- Campaign commercial
- total Campaign budget
- payment terms
- brand support / pre-content consideration
- Campaign creation source

These values MUST NOT be duplicated into Brief persistence.

### CampaignAsset owns

- Campaign ↔ Brand Centre entity association
- Campaign Asset status
- Brand / Offering / Offer identity

Brief does not duplicate Product/Offering identity. Its parent `campaignAssetId` provides this context.

### Brief owns

- Brief lifecycle
- Brief creation source
- Brief name
- Creative Intent
- Creator Brief
- Brief Type
- Platform
- Brief-level content guidance
- reference content
- Usage Rights
- Mandatory Creator Requirements
- Deliverables

### Deliverable owns

- Deliverable Format
- display order
- format-specific configuration
- format/type-specific Creative Guidance
- optional Story → Reel amplification reference

A Deliverable does NOT independently own Campaign, Campaign Asset, Platform, Brief Type, commercial, lifecycle status, Usage Rights, or creator requirements. These are inherited from their canonical parent objects.

## 4. Required New Enums

Add `UceBriefStatus`:
- DRAFT
- PUBLISHED
- PAUSED

Add `UceBriefCreationSource`:
- MANUAL
- AI_RECOMMENDED

Add `UceBriefType`:
- CREATOR_LED
- BRAND_LED

Deliverable Format must represent the frozen Instagram MVP library via `UceDeliverableFormat`:
- REEL_VIDEO
- STORY
- PHOTOSHOOT
- BANNER_CAROUSEL

Platform MUST reuse the existing canonical Campaign platform enum where technically possible: `UceMediaPlatform`.

Do NOT create a second competing Brief platform taxonomy unless production Prisma integration makes reuse technically impossible.

Current Campaign platform enum already includes INSTAGRAM, TIKTOK and YOUTUBE. For MVP, Add Brief resolves to INSTAGRAM.

## 5. UceCampaignAsset Extension

Add relation:

```text
briefs UceBrief[]
```

Do not persist `hasBrief`, `executionReady`, `briefCount`, or `publishedBriefCount`. These remain derived.

## 6. New UceBrief Model

Introduce `UceBrief`.

Required structural fields:
- id
- campaignAssetId
- status
- creationSource
- briefName
- creativeIntent
- creatorBrief
- briefType
- platform
- deliverables relation
- createdAt
- updatedAt

Lifecycle timestamps:
- publishedAt
- pausedAt

`campaignAssetId` is the authoritative parent relation. Do NOT duplicate `campaignId`.

Campaign is derived through Brief → CampaignAsset → Campaign.

## 7. Brief Creation Source

`creationSource` distinguishes MANUAL from AI_RECOMMENDED. This is canonical domain context because creation source affects manual mutability.

MANUAL Brief: normal lifecycle-based mutation rules apply.

AI_RECOMMENDED Brief: content structure is manually immutable; operational Pause / Resume remains permitted.

Do NOT encode this behavior only in frontend state. Backend service/domain validation must enforce it.

## 8. Brief Lifecycle

Persist only DRAFT, PUBLISHED and PAUSED.

Do NOT introduce ACTIVE, LIVE, READY or EXECUTION_READY.

Brief execution availability is derived from Campaign operational state + CampaignAsset status + Brief status.

Canonical effective availability:

```text
Campaign = LIVE
AND CampaignAsset = ACTIVE
AND Brief = PUBLISHED
```

## 9. Brief-Owned Authoring Fields

Persist:
- briefName
- creativeIntent
- creatorBrief
- briefType
- platform

Do NOT persist legacy/redundant Brief fields for Purpose, Campaign Objective, Target Influencer Archetype, Campaign KPIs, Campaign Audience, Campaign Commercial, or Campaign Publishing Window.

## 10. Brief-Level Content Guidance

The frozen Add Brief UI contains Brief-level guidance separate from Deliverable Creative Guidance.

Persist the UI-defined Brief-level guidance without moving it into Deliverables. Where the exact UI shape is naturally structured and does not require independent querying/lifecycle, structured JSON may be used.

Do NOT normalize the frozen UI into a different generic content guidance product model.

## 11. Reference Content

Reference Content remains Brief-owned. MVP persistence may use structured JSON. No separate media/reference aggregate is required for Add Brief MVP.

If URLs are the current UI input, persistence must preserve those values without introducing a new upload/media system.

## 12. Mandatory Creator Requirements

Mandatory Creator Requirements remain Brief-owned. Persist according to the frozen UI field shape.

Do NOT automatically decompose the field into hashtags, mentions, disclosures, or other categories unless the frozen frontend contract itself does so.

## 13. Usage Rights

Usage Rights remain Brief-owned and apply across all Deliverables inside the Brief.

Frozen concepts include:
1. Link-in-Bio Requirement — enabled; duration days when enabled.
2. Partnership / Spark Ads — enabled; authorization duration when enabled.
3. Organic Reposting Rights — enabled; usage duration when enabled.
4. Branded Collaboration — enabled.

MVP persistence decision: store Usage Rights as structured JSON on `UceBrief`.

Reason: rights are one Brief-owned value object; fields contain conditional payloads; no independent lifecycle exists; no current requirement exists to independently query each right; preserving the frozen UI structure is preferable to premature relational normalization.

Usage Rights MUST still be validated through the canonical Zod/domain contract before persistence. JSON does NOT mean arbitrary/unvalidated JSON.

## 14. Organic Reposting Copy Conflict

The frozen UI contains a semantic copy conflict: the UI collects a usage duration while supporting tooltip copy refers to indefinite usage.

Schema reconciliation does NOT resolve this product-copy conflict. Persistence must support the explicit duration value because the current frozen UI captures it. The tooltip may be corrected later without requiring schema migration.

## 15. New UceBriefDeliverable Model

Introduce `UceBriefDeliverable`.

Each independently guided creator output is represented as an independent Deliverable record.

Required structural fields:
- id
- briefId
- format
- displayOrder
- configuration
- creativeGuidance
- createdAt
- updatedAt

A Brief may contain REEL, REEL, STORY. There MUST NOT be a uniqueness constraint on `(briefId, format)` because two Reels may contain completely different creative guidance.

## 16. Deliverable Multiplicity

Do NOT model 2 Reels as one generic Deliverable with `quantity = 2` when those Reels contain different guidance.

Canonical representation is two independent REEL_VIDEO Deliverables. Each owns its own Creative Guidance.

Format-specific Quantity may still exist where the frozen UI explicitly defines Quantity as configuration, e.g. Photoshoot. That is different from Deliverable multiplicity.

## 17. Deliverable Format Configuration

`configuration` may be stored as structured JSON. It is NOT arbitrary JSON. It must validate against the canonical Format contract.

Frozen MVP examples:
- REEL_VIDEO: dimension, duration
- STORY: intent
- PHOTOSHOOT: quantity
- BANNER_CAROUSEL: dimension, slide count

The schema should not create columns for every profile-specific configuration field unless independent relational querying becomes necessary.

## 18. Creative Guidance Persistence

`creativeGuidance` may be stored as structured JSON on `UceBriefDeliverable`.

Creative Guidance varies according to the frozen Add Brief profiles:
- CREATOR_LED × REEL_VIDEO
- CREATOR_LED × STORY
- CREATOR_LED × PHOTOSHOOT
- CREATOR_LED × BANNER_CAROUSEL
- BRAND_LED × REEL_VIDEO
- BRAND_LED × STORY
- BRAND_LED × PHOTOSHOOT
- BRAND_LED × BANNER_CAROUSEL

Story Intent may further alter the resolved profile. These structures include format-specific repeaters such as Scene[], Frame[], Slide[], and Shot[].

Normalizing every creative unit into separate relational models during MVP would introduce persistence complexity without a current domain requirement. Therefore Creative Guidance uses validated structured JSON.

## 19. Creative Guidance Validation Boundary

JSON persistence MUST NOT result in `creativeGuidance: Json<any>` at the domain boundary.

Before persistence, backend validation resolves Brief Type + Deliverable Format + conditional Format state to the canonical Creative Guidance profile. The payload must validate against that profile.

The canonical profile registry is authoritative. Persistence representation and domain validation are separate concerns.

## 20. Nested Creative Units

Scenes, Frames, Slides and Shots remain nested inside `creativeGuidance` for MVP.

Do NOT introduce `UceBriefScene`, `UceBriefFrame`, `UceBriefSlide`, or `UceBriefShot` at this stage.

Their meaningful ordering is persisted inside the validated structured payload.

This decision can be revisited if future requirements need independent lifecycle, creator submission, analytics, approval, or querying. None are currently frozen.

## 21. Story AMPLIFY_REEL Relation

Story Intent `AMPLIFY_REEL` creates a real dependency between Deliverables. This relationship SHOULD NOT exist only inside creativeGuidance JSON.

Add nullable `amplifyTargetDeliverableId` to `UceBriefDeliverable` and the corresponding self-relation.

Domain validation must enforce:
1. source Deliverable format = STORY;
2. Story intent = AMPLIFY_REEL;
3. target exists;
4. target belongs to the same Brief;
5. target format = REEL_VIDEO;
6. source cannot target itself.

The database FK establishes referential integrity. Service/domain validation establishes semantic validity.

## 22. Amplification Delete Behavior

A Reel referenced by an AMPLIFY_REEL Story must not disappear while the dependency remains valid. The implementation must not silently retarget the Story.

During editable Draft/manual mutation, removing the target Reel makes the dependent Story unresolved and Publish validation must fail until repaired.

No automatic selection of another Reel is allowed.

## 23. Display Ordering

Deliverables require deterministic order. Persist `displayOrder`.

Do NOT use database creation time as UI ordering. Backend should normalize ordering after add, remove, or reorder.

Nested creative-unit ordering remains inside validated Creative Guidance payloads for MVP.

## 24. Parent Delete Behavior

Brief belongs to CampaignAsset. CampaignAsset belongs to Campaign.

Working schema may use cascading relational behavior consistent with the existing Campaign aggregate. However, production migration must preserve the frozen lifecycle rule that Published/Paused Briefs are not deletable through normal product operations.

Database cascade behavior for aggregate deletion and application-level Brief deletion permissions are separate concerns.

## 25. Brief Deletion

Normal product behavior:
- MANUAL + DRAFT → delete allowed
- PUBLISHED → delete prohibited
- PAUSED → delete prohibited
- AI_RECOMMENDED → normal manual delete prohibited

This rule belongs to the service/domain layer. Do NOT attempt to encode lifecycle deletion permission entirely through Prisma relations.

## 26. Brief Mutability

Do NOT persist `isEditable`, `isLocked`, or `hasInstantiatedExecution`. These are derived runtime concerns.

Manual Brief mutation rule: `creationSource = MANUAL` AND creator execution has not been instantiated → content may be editable according to lifecycle rules.

PUBLISHED manual Brief remains editable until creator execution is instantiated. Application existence alone does NOT lock the Brief.

Once creator execution is instantiated, Brief + Deliverables + Creative Guidance + Usage Rights + Creator Requirements become content-immutable.

The authoritative execution signal will be reconciled with the Collaboration module later.

## 27. AI-Recommended Brief Persistence

AI recommendations do not require a second Brief schema. Once accepted, an AI-recommended Brief persists into the same `UceBrief → UceBriefDeliverable` aggregate.

Set `creationSource = AI_RECOMMENDED`.

The Intelligence Framework must produce values conforming to the same canonical Brief and Deliverable contracts.

Do NOT create `AiBrief`, `AiDeliverable`, or `RecommendedBrief` as parallel canonical Campaign-domain models.

Recommendation/proposal state remains outside the launched Campaign aggregate until the complete AI Campaign recommendation is accepted.

## 28. AI Recommendation Acceptance

The accepted AI Campaign package contains Campaign + CampaignAsset + Brief + Deliverables. Acceptance is orchestrated atomically.

Canonical resulting state:
- Campaign.status = LIVE
- CampaignAsset.status = ACTIVE
- Brief.status = PUBLISHED
- Brief.creationSource = AI_RECOMMENDED

Unaccepted recommendations must not leave partially launched Campaign domain records.

## 29. Campaign Readiness

Do NOT persist readiness on Brief, CampaignAsset or Campaign.

CampaignAsset execution readiness:

```text
CampaignAsset.status = ACTIVE
AND exists Brief where status = PUBLISHED
```

Campaign execution readiness: exists execution-ready CampaignAsset.

Publishing the first valid Brief may transition Campaign.PUBLISHED → Campaign.LIVE.

Once Campaign is LIVE, later loss of execution readiness does NOT demote it back to PUBLISHED. `LIVE + execution_ready=false` is valid.

## 30. Campaign Page Projection

After Brief Publish, Pause or Resume, backend orchestration recalculates Campaign Page projection. This may affect execution readiness, Share availability, workspace hydration, primary Campaign Page action, and blocking readiness presentation.

None of these values are persisted on `UceBrief`.

## 31. Draft Persistence

Draft Briefs may be incomplete. Database nullability and service validation must distinguish DRAFT-valid from PUBLISH-valid.

Required-for-publish fields do not automatically need to be database NOT NULL if doing so would prevent legitimate incremental autosave. Exact nullability must follow the Add Brief autosave implementation.

Backend publish validation remains authoritative for completeness.

## 32. Field Validation vs Database Nullability

Do NOT use database NOT NULL as a substitute for Publish validation.

A newly autosaved Draft may legitimately exist before Creative Intent, Creator Brief, Deliverables, or Usage Rights are complete.

Where autosave requires partial persistence, schema nullability must permit that Draft state. Publish service then enforces the complete canonical contract.

## 33. No Campaign-Owned Duplication

The following MUST NOT be introduced into `UceBrief`:
- campaignObjective
- primaryKpi
- supportingKpis
- creatorArchetypes
- minimumFollowers
- maximumFollowers
- audienceAge
- audienceGender
- audienceGeographies
- commercialOffer
- totalCampaignBudget
- currency
- payoutTerms
- publishingWindow

Step 3 Final Review reads these values from canonical Campaign state. It does not copy them into Brief persistence.

## 34. No Step-3 Review Persistence

The Add Brief Final Review screen is a projection. It introduces no independent persistence model.

Do NOT create `BriefTerms`, `BriefCampaignTerms`, `BriefReview`, or `BriefCommercialSnapshot` for the current MVP.

Campaign-owned values are read directly from Campaign. Brief-owned values are read from the current Brief Draft.

## 35. Platform Reuse

`UceCampaignStrategy.platforms` already uses `UceMediaPlatform`.

`UceBrief.platform` SHOULD reuse `UceMediaPlatform` rather than introduce `UceBriefPlatform`.

Backend validation must enforce:

```text
Brief.platform ∈ Campaign.strategy.platforms
```

For current MVP, INSTAGRAM is the only operational Brief platform.

## 36. Referential Hierarchy

Canonical persistence path:

```text
UceCampaign
    1
    │
    N
UceCampaignAsset
    1
    │
    N
UceBrief
    1
    │
    N
UceBriefDeliverable
```

A Brief belongs to exactly one CampaignAsset. A Deliverable belongs to exactly one Brief. Campaign identity is resolved transitively and should not be duplicated downstream.

## 37. Recommended Prisma Working Shape

Conceptually:

```text
UceCampaignAsset
  briefs UceBrief[]

UceBrief
  id
  campaignAssetId
  status
  creationSource
  briefName
  creativeIntent
  creatorBrief
  briefType
  platform
  briefLevelGuidance
  referenceContent
  usageRights
  creatorRequirements
  publishedAt
  pausedAt
  campaignAsset
  deliverables[]
  createdAt
  updatedAt

UceBriefDeliverable
  id
  briefId
  format
  displayOrder
  configuration
  creativeGuidance
  amplifyTargetDeliverableId?
  brief
  amplifyTargetDeliverable?
  amplifiedBy[]
  createdAt
  updatedAt
```

Exact Prisma field nullability must respect Draft autosave behavior.

## 38. JSON Persistence Boundary

Approved MVP JSON boundaries:
1. Brief-level structured Content Guidance
2. Reference Content where structurally appropriate
3. Usage Rights
4. Deliverable configuration
5. Deliverable Creative Guidance

JSON is approved because these are bounded value objects, validated before persistence, not independently lifecycle-managed, and tightly coupled to frozen UI profiles.

JSON MUST NOT be used for CampaignAsset relation, Brief relation, Deliverable identity, Brief lifecycle, Brief creation source, Deliverable Format, Deliverable ordering, or AMPLIFY_REEL target relation. These require explicit relational/schema representation.

## 39. Explicitly Derived / Non-Persisted Values

Do NOT persist:
- hasBrief
- hasPublishedBrief
- executionReady
- effectiveAvailability
- isEditable
- isLocked
- hasApplications
- hasCollaborations
- hasInstantiatedExecution
- workspaceVisibility
- shareEnabled
- Campaign Page hydration state
- Reporting state
- Intelligence output

These are resolved from canonical state or downstream modules.

## 40. Cross-Module Dependencies

Add Brief consumes but does not own:

Campaign — lifecycle, enabled platforms, Campaign terms, creation context.

CampaignAsset — identity, operational status.

Collaboration — whether creator execution has been instantiated.

Applicants — application existence.

Canonical Libraries — Deliverable Format availability and Creative Guidance profile registry.

Intelligence Framework — AI recommendation payload.

Campaign Page Orchestration — readiness and hydration projection.

These dependencies must not be duplicated as Brief persistence fields.

## 41. Production Merge Requirements

Developer integration must:
1. extend the existing production UCE Campaign aggregate;
2. preserve existing production IDs and relations;
3. add the CampaignAsset → Brief relation;
4. add Brief persistence;
5. add Deliverable persistence;
6. add the Deliverable self-reference for AMPLIFY_REEL;
7. reuse the canonical Campaign platform enum where possible;
8. preserve Draft autosave nullability;
9. implement semantic validation in service/Zod layers;
10. avoid persisting derived Campaign Page/readiness state.

The working Prisma file remains an integration specification, not an automatic production migration.

## 42. Migration / Legacy Reconciliation

Any existing production Brief/Deliverable implementation must be mapped by semantic ownership rather than copied mechanically.

Potential legacy concepts must be checked for Campaign-owned deliverables, campaign-level platformDeliverables, Brief Objective, Brief Archetype, duplicated Campaign terms, generic quantity-based Deliverables, arbitrary creativeGuidance JSON, ACTIVE Brief lifecycle states, and Product IDs directly stored on Brief.

Where these exist, migration must map them into the reconciled CampaignAsset → Brief → Deliverable hierarchy.

No legacy field should be retained solely for backward compatibility without an explicit integration requirement.

## 43. Deferred Until Later Modules

The following are intentionally NOT solved by Add Brief schema:
- Applicant schema
- Collaboration schema
- creator execution snapshot/versioning
- Brief performance analytics
- AI match score
- Reporting intelligence
- Marketplace section score
- creator submission/review lifecycle
- Deliverable approval lifecycle

These will be reconciled by their owning modules. Add Brief only establishes the canonical creator requirement structure they will reference.

## 44. Frozen Schema Decisions

- **AB-SCHEMA-01** Brief extends UceCampaignAsset.
- **AB-SCHEMA-02** Brief does not duplicate campaignId.
- **AB-SCHEMA-03** UceBrief is a first-class relational model.
- **AB-SCHEMA-04** UceBriefDeliverable is a first-class relational model.
- **AB-SCHEMA-05** Multiple Deliverables of the same Format are valid.
- **AB-SCHEMA-06** Deliverable multiplicity is represented by independent Deliverable records when guidance differs.
- **AB-SCHEMA-07** Brief lifecycle persists only DRAFT / PUBLISHED / PAUSED.
- **AB-SCHEMA-08** Brief creation source persists MANUAL / AI_RECOMMENDED.
- **AB-SCHEMA-09** Brief Platform reuses the Campaign media platform taxonomy.
- **AB-SCHEMA-10** Brief Type persists CREATOR_LED / BRAND_LED.
- **AB-SCHEMA-11** Usage Rights use validated structured JSON for MVP.
- **AB-SCHEMA-12** Deliverable configuration uses validated structured JSON for MVP.
- **AB-SCHEMA-13** Creative Guidance uses validated structured JSON for MVP.
- **AB-SCHEMA-14** Scenes/Frames/Slides/Shots remain nested inside Creative Guidance for MVP.
- **AB-SCHEMA-15** Creative Guidance JSON must validate against the canonical profile registry before persistence.
- **AB-SCHEMA-16** AMPLIFY_REEL target is an explicit Deliverable self-relation.
- **AB-SCHEMA-17** AMPLIFY_REEL semantic constraints belong to domain validation.
- **AB-SCHEMA-18** Deliverable display order is explicitly persisted.
- **AB-SCHEMA-19** Purpose is not a Brief persistence field.
- **AB-SCHEMA-20** Campaign Objective and Archetypes are not Brief persistence fields.
- **AB-SCHEMA-21** Campaign Commercial and Campaign Terms are not duplicated into Brief.
- **AB-SCHEMA-22** Final Review creates no persistence object.
- **AB-SCHEMA-23** Readiness and effective availability remain derived.
- **AB-SCHEMA-24** Mutability/lock state remains derived.
- **AB-SCHEMA-25** Application existence is not persisted on Brief.
- **AB-SCHEMA-26** Creator execution state is owned by Collaboration.
- **AB-SCHEMA-27** AI and Manual Briefs resolve to the same canonical persistence models.
- **AB-SCHEMA-28** AI recommendation proposal state remains outside the launched Campaign aggregate until acceptance.
- **AB-SCHEMA-29** Draft schema nullability must support incomplete autosaved Drafts.
- **AB-SCHEMA-30** Publish completeness is enforced by service/domain validation rather than database nullability alone.
- **AB-SCHEMA-31** The Campaign Page consumes Brief state but does not duplicate it.
- **AB-SCHEMA-32** The Add Brief schema remains additive to `backend/campaign_schema.prisma` and separate from `backend/intelligence_schema.prisma`.
