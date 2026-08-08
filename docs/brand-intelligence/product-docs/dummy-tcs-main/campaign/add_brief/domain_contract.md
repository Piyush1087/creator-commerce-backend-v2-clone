# Add Brief — Domain Contract

Version: 1.0
Status: FROZEN

## Canonical hierarchy

Campaign → CampaignAsset → Brief → Deliverable.

A Brief belongs to exactly one CampaignAsset. A Deliverable belongs to exactly one Brief. Campaign identity is derived through CampaignAsset and is not duplicated on Brief.

## Brief ownership

Brief owns: lifecycle, creation source, brief name, creative intent, creator brief, brief type, platform, brief-level guidance/reference content, usage rights, mandatory creator requirements, and Deliverables.

Brief does not own Campaign objective, KPIs, archetypes, audience, follower eligibility, Campaign commercial, total budget, payment terms, publishing window, or Campaign Asset identity.

## Deliverable ownership

Each independently guided creator output is an independent Deliverable. Multiple Deliverables may use the same format; two Reels with different guidance are two Deliverables.

Frozen formats: REEL_VIDEO, STORY, PHOTOSHOOT, BANNER_CAROUSEL.

Step-1 format configuration:
- REEL_VIDEO: dimension + duration
- STORY: intent (CUSTOM_CONTENT / AMPLIFY_REEL)
- PHOTOSHOOT: quantity
- BANNER_CAROUSEL: dimension + slide count

Step-2 Creative Guidance is resolved by Brief Type × Deliverable Format × conditional Story Intent. Creator-led and Brand-led profiles remain distinct. Nested semantic units remain profile-specific: Scene[], Frame[], Slide[], Shot[].

AMPLIFY_REEL Story references another REEL_VIDEO Deliverable in the same Brief.

## Usage rights

Usage Rights are Brief-level and apply across its Deliverables: Link-in-Bio, Partnership/Spark Ads, Organic Reposting Rights, Branded Collaboration. Conditional duration fields follow the frozen UI. Mandatory Creator Requirements are also Brief-level.

## Creation source

MANUAL and AI_RECOMMENDED use the same canonical Brief/Deliverable domain. AI-recommended content is manually immutable; operational Pause/Resume remains allowed.

Manual Add Brief provides no AI authoring assistance.

## Domain invariants

- Brief is single-platform.
- Platform constrains available Deliverable formats.
- Every + Add Deliverable creates an independent Deliverable.
- Multiple Deliverables may share a format.
- Deliverables independently own configuration and Creative Guidance.
- Usage Rights and creator requirements belong to Brief, not Deliverable.
- Deliverables have no independent lifecycle status in MVP.
- AI-generated payloads must use the same predefined types/formats/profiles.
- The frozen Add Brief UI/profile registry is authoritative; do not normalize it into a different generic authoring model.
