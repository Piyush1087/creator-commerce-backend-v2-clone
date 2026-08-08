# Add Brief — Runtime Contract

Version: 1.0
Status: FROZEN

## Lifecycle

DRAFT → PUBLISHED ↔ PAUSED.

No Brief ACTIVE state. Effective availability is derived: Campaign LIVE + CampaignAsset ACTIVE + Brief PUBLISHED.

## Manual creation

Manual Add Brief starts under a selected ACTIVE CampaignAsset with `status=DRAFT` and `creationSource=MANUAL`. Parent association is fixed. Draft authoring autosaves and may be incomplete. Leaving midway preserves the Draft.

Publishing performs full authoritative validation and sets `publishedAt`. Publishing the first executable Brief under an ACTIVE CampaignAsset may transition Campaign PUBLISHED → LIVE and set Campaign.liveAt once. Subsequent Briefs do not rewrite liveAt.

## Editing

A MANUAL PUBLISHED Brief remains editable until creator execution is instantiated. Application existence alone does not lock it. Once execution is instantiated, Brief content, Deliverables, Creative Guidance, Usage Rights and Creator Requirements become immutable. The authoritative execution signal is owned by Collaboration and will be reconciled there.

PAUSED manual Briefs may also be edited if execution has not been instantiated.

## Pause / Resume

PUBLISHED → PAUSED blocks new creator acquisition/application through that Brief while preserving existing Applications, Collaborations and execution. It does not cascade status changes to Deliverables, CampaignAsset or Campaign.

PAUSED → PUBLISHED requires authoritative parent/lifecycle validation. Parent CampaignAsset must be ACTIVE.

Campaign or CampaignAsset Pause does not mutate Brief status. Local Brief status survives parent Pause/Resume.

Pausing the last executable Brief can yield Campaign LIVE + execution_ready=false; Campaign is not demoted to PUBLISHED.

## Draft behavior under parent Pause

Existing Drafts survive Campaign/CampaignAsset Pause and remain editable/autosaved. Publish is blocked until the parent hierarchy permits publication.

## Delete

Only MANUAL DRAFT is normally deletable. PUBLISHED and PAUSED are not deleted; withdrawal uses Pause. AI_RECOMMENDED is not manually deleted through normal Add Brief behavior.

## AI recommendation flow

AI Campaign recommendation contains Campaign + CampaignAsset + Brief + Deliverables as one recommendation package. Unaccepted recommendation state remains outside the launched Campaign aggregate.

On full acceptance, the package is created/activated coherently: Campaign LIVE, CampaignAsset ACTIVE, Brief PUBLISHED, creationSource AI_RECOMMENDED. The review itself is publication approval; no normal Draft authoring flow is required.

AI-owned Brief content is manually immutable after acceptance, but Pause/Resume remain available.

## Projection refresh

Publish/Pause/Resume trigger Campaign readiness/page projection recalculation. Readiness is derived and not persisted. Draft field edits do not affect execution readiness.
