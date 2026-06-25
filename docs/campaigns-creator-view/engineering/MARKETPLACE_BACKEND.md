# Creator marketplace — backend (Screen 1)

**Product reference (read-only):** `product-docs/PRD_ Campaign- Creator view.md`, `Develop Doc- Creator_view.md`  
**Status:** Phase 1 backend — marketplace discovery feed  
**Next:** Screen 2 (`/api/v1/creator/campaigns/:id`) detail + apply wizard

---

## API routes (split per product docs)

| Surface | API prefix | Notes |
| --- | --- | --- |
| Marketplace discovery | `GET /api/v1/creator/marketplace/campaigns` | Screen 1 — this doc |
| Legacy test apply list | `GET /api/v1/creator-uce/campaigns` | Kept for dashboard test harness; no visibility matrix |
| Campaign detail + apply | `api/v1/creator/campaigns/:id` | Not started (Screen 2) |
| Campaigns command center | `api/v1/creator/campaigns/workspace` | Not started (operational tab) |

---

## Schema extensions (mapped from product docs → existing UCE)

| Product concept | Implementation |
| --- | --- |
| `visibility_scopes[]` | `uce_campaign_targeting.visibility_scopes` (`UceVisibilityScope[]`) |
| `application_scope` | `uce_campaign_targeting.application_scope` (`UceApplicationScope`) |
| Creator audience matrix | `creator_profiles.audience_demographics_matrix` (JSON) |
| Follower count / region | `creator_profiles.follower_count`, `primary_region` |
| Invite deep links | `uce_campaign_collaborations.invitation_token`, `invitation_source_channel` |

Defaults for bridge + legacy campaigns: `visibility_scopes = [EVERYONE]`, `application_scope = EVERYONE`.

Brand manual wizard Step 2 accepts optional `visibility_scopes` and `application_scope` (Zod defaults above).

---

## Mock Instagram metrics (temporary)

Real Instagram Graph API OAuth and sync are **deferred**. Until then:

| Field | Source |
| --- | --- |
| `is_social_connected` / `access_tier` | `FULL` when `creator_profiles.instagram_handle` is set; else `SOCIAL_PENDING` |
| `follower_count` | Static seed / manual profile row |
| `audience_demographics_matrix` | Static JSON on profile (see `scripts/seed-dev-creator.ts`) |
| Match score + eligibility | Computed from mock fields + campaign `uce_campaign_targeting` |

**Replace later:** background worker post-OAuth to hydrate `follower_count` and `audience_demographics_matrix` from Meta Graph API. Eligibility service (`CreatorEligibilityService`) is the single swap point.

Dev seed (`npm run db:seed:dev-creator`) sets:

- `follower_count: 45000` (MICRO tier)
- `primary_region: IN`
- Sample `age_distribution` / `top_countries` / `gender_skew`

---

## Marketplace feed behaviour

### Visibility (OR across configured scopes)

| Scope | Row shown when |
| --- | --- |
| `EVERYONE` | Always (for ACTIVE campaigns) |
| `ELIGIBLE_ONLY` | Creator passes targeting check |
| `INVITED_ONLY` | Creator has `PROSPECT_INVITED` or `PROSPECT_CURATED` pipeline row |

### Response excludes sensitive brand fields

List payload omits `total_campaign_budget_pool` and internal caps. Returns `compensation_teaser` only (min/max/fixed fee).

### Affinity score

$$S_{match} = 0.4 \cdot A_{geo} + 0.4 \cdot A_{demo} + 0.2 \cdot A_{niche}$$

Returned as `match_score_percent` (0–100) when `access_tier = FULL`; `null` when social pending.

### Query parameters

| Param | Purpose |
| --- | --- |
| `search_query` | Campaign name substring |
| `niche` | Industry vertical substring |
| `deliverable_type` | `INSTAGRAM_REEL`, `INSTAGRAM_STORY`, `TIKTOK_VIDEO`, `YOUTUBE_SHORTS` |
| `show_match_eligible_only` | Hide rows where creator fails targeting |
| `creator_tier` | Filter by creator's resolved tier (NANO–MEGA) |
| `target_geography` | ISO-2; campaign must list region in `target_locations` |
| `production_timeline` | `URGENT_PIPELINE` (<7d) or `STANDARD_RUNWAY` (7–15d) |

---

## Module layout

```text
src/features/creator-marketplace/
  creator-marketplace.controller.ts
  creator-marketplace.module.ts
  dto/marketplace-query.dto.ts
  schemas/marketplace-filter.schema.ts
  services/
    creator-marketplace.service.ts
    creator-eligibility.service.ts
    creator-affinity.service.ts
  utils/
    creator-tier.util.ts
    visibility-scope.util.ts
```

---

## Migration

`prisma/migrations/20260624120000_creator_marketplace/migration.sql`

Apply locally: `npm run db:migrate:dev`

---

## Manual test checklist

1. Run migration + `npm run db:seed:dev-creator`
2. Brand: create/activate UCE campaign with targeting tiers including `MICRO`, locations including `IN`
3. Creator login (`test@creator.com`, OTP `123456`)
4. `GET /api/v1/creator/marketplace/campaigns` — expect row with `match_score_percent`, `is_eligible: true`
5. Set campaign `visibility_scopes` to `['INVITED_ONLY']` only — creator should not see row until brand adds prospect/invite pipeline row
