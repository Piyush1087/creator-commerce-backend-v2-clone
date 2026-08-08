# Add Brief — Field / Profile Contract

Version: 1.0
Status: FROZEN

This artifact records field ownership and the frozen Creative Guidance resolver. Exact UI copy remains governed by the frozen Add Brief UI source; this contract does not redesign it.

## Brief fields

- briefName — Brief-owned; required for Publish; draft-compatible.
- creativeIntent — Brief-owned; required for Publish; draft-compatible.
- creatorBrief — Brief-owned; required for Publish; draft-compatible.
- briefType — CREATOR_LED | BRAND_LED.
- platform — canonical UceMediaPlatform; Instagram-only operationally in MVP; must be enabled by Campaign.
- briefLevelGuidance — Brief-owned structured value where required by frozen UI.
- referenceContent — Brief-owned structured value where required by frozen UI.
- usageRights — Brief-owned structured value.
- creatorRequirements — Brief-owned field following frozen UI shape.

Campaign-owned values shown in Step 3 are READ ONLY projections and are not copied into Brief.

## Deliverable fields

Each Deliverable has: id, format, displayOrder, configuration, creativeGuidance, optional amplifyTargetDeliverableId.

### REEL_VIDEO configuration
- dimension: 9:16 | 4:5
- duration: <15s | 15–45s | >45s

### STORY configuration
- intent: CUSTOM_CONTENT | AMPLIFY_REEL

### PHOTOSHOOT configuration
- quantity: integer >= 1

### BANNER_CAROUSEL configuration
- dimension: 4:5 | 1:1
- slideCount: integer 1..10

## Creative Guidance profile registry

Profiles:
- CREATOR_LED_REEL
- CREATOR_LED_STORY
- CREATOR_LED_CAROUSEL
- CREATOR_LED_PHOTOSHOOT
- BRAND_LED_REEL
- BRAND_LED_STORY
- BRAND_LED_CAROUSEL
- BRAND_LED_PHOTOSHOOT

Story Intent may further resolve CUSTOM_CONTENT vs AMPLIFY_REEL behavior.

Each profile owns its exact frozen fields, conditional fields, repeaters, validation and read-only references. Do not replace profile-specific fields with one generic scene model.

Brand-led storyboard preserves Environmental Profile and dynamic Scene[] authoring. Carousel preserves Slide[]. Photoshoot preserves Shot[]. Story preserves its frozen Story-specific/frame behavior. A brand may keep one scene/unit or add more through the frozen [+] behavior.

## Usage Rights

- Link-in-Bio: enabled boolean; if enabled, durationDays > 0.
- Partnership/Spark Ads: enabled boolean; if enabled, authorizationDays > 0.
- Organic Reposting: enabled boolean; if enabled, usageDays > 0.
- Branded Collaboration: enabled boolean.

The Organic Reposting duration/tooltip inconsistency remains a copy issue; persistence supports the duration captured by UI.

## Edit semantics

MANUAL: content can be edited while allowed by runtime rules, including PUBLISHED before creator execution is instantiated.

AI_RECOMMENDED: content fields and child Deliverables/Guidance are manually read-only after acceptance. Pause/Resume remain operational actions.
