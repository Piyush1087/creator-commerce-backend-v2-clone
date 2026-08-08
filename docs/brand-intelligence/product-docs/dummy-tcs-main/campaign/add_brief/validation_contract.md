# Add Brief — Validation Contract

Version: 1.0
Status: FROZEN

## Validation layers

Frontend performs immediate field/conditional validation. Backend performs authoritative domain validation. Database enforces structural/referential invariants. Frontend state never authorizes an otherwise-invalid write.

Draft-valid means populated values are structurally valid; Draft may be incomplete. Publish-valid means the complete Brief graph and current parent state satisfy all requirements.

## Parent validation

Brief → CampaignAsset → Campaign is resolved authoritatively. Brief creation requires Campaign state permitting creation and ACTIVE CampaignAsset. Existing Drafts may survive later parent Pause.

## Platform / ownership

Brief.platform must use canonical Campaign platform taxonomy and be enabled by Campaign. Campaign-owned fields such as objective, KPIs, archetypes, audience, followers, commercial, budget and publishing window are non-writable at the Brief boundary.

## Deliverables

Publish requires at least one Deliverable. Same-format Deliverables are valid. Every Deliverable independently validates format configuration and Creative Guidance against the canonical profile registry.

Nested Scene/Frame/Slide/Shot structures validate according to the resolved frozen profile; there is no universal generic scene schema replacing those profiles.

## AMPLIFY_REEL

A STORY with intent AMPLIFY_REEL requires a target Deliverable that exists, belongs to the same Brief, is REEL_VIDEO, and is not self. Removing a target must not silently retarget; the dependent Story becomes unresolved/unpublishable until repaired.

## Usage Rights

Conditional durations are required and >0 when their corresponding right is enabled. Branded Collaboration is boolean. Usage Rights remain Brief-level.

## Mutation lock

Application existence alone does not block manual Brief edits. Instantiated creator execution does. This check is authoritative on every mutation to protect against stale frontend state/concurrency.

AI_RECOMMENDED rejects normal manual content mutation while permitting lifecycle-valid Pause/Resume.

## Publish validation

Publish revalidates current persisted Brief, parent CampaignAsset/Campaign state, required Brief fields, platform, Deliverables, format configuration, Creative Guidance, nested units, cross-deliverable references, Usage Rights and lifecycle/concurrency state before DRAFT → PUBLISHED.

## Pause / Resume / Delete

Pause does not fail because Applications/Collaborations exist. Resume requires valid current parent state and ACTIVE CampaignAsset. Published/Paused Briefs cannot be normally deleted; only MANUAL DRAFT is normally deletable.

## Semantic error taxonomy

Recommended stable errors include:
- BRIEF_NOT_FOUND
- BRIEF_CREATION_NOT_ALLOWED
- BRIEF_PUBLISH_NOT_ALLOWED
- BRIEF_EDIT_NOT_ALLOWED
- BRIEF_PAUSE_NOT_ALLOWED
- BRIEF_RESUME_NOT_ALLOWED
- BRIEF_DELETE_NOT_ALLOWED
- BRIEF_EXECUTION_ALREADY_INSTANTIATED
- BRIEF_CREATION_SOURCE_DISALLOWS_MUTATION
- BRIEF_PLATFORM_NOT_SUPPORTED
- BRIEF_REQUIRED_FIELD_MISSING
- BRIEF_DELIVERABLE_REQUIRED
- DELIVERABLE_NOT_FOUND
- DELIVERABLE_FORMAT_NOT_SUPPORTED
- DELIVERABLE_CONFIGURATION_INVALID
- DELIVERABLE_GUIDANCE_INVALID
- CREATIVE_UNIT_INVALID
- CREATIVE_UNIT_ORDER_INVALID
- AMPLIFY_REEL_TARGET_REQUIRED
- AMPLIFY_REEL_TARGET_INVALID
- USAGE_RIGHTS_INVALID
- CAMPAIGN_ASSET_NOT_FOUND
- CAMPAIGN_ASSET_NOT_ACTIVE
- CAMPAIGN_STATE_DISALLOWS_BRIEF_OPERATION
- CONCURRENT_BRIEF_MUTATION

Campaign readiness is recalculated after valid lifecycle mutation but is not persisted by Brief validation.
