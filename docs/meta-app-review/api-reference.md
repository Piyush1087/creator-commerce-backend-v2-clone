# API reference notes — Instagram Creator Marketplace

Captured from Meta ICM docs (Graph v25.0 examples as of Jun 2026).  
Primary: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/creator-marketplace  
Confirm version against https://developers.facebook.com/docs/graph-api/changelog before shipping.

This file is a working dump for eng + App Review evidence. Prefer live docs if anything conflicts.

---

## Auth

1. Facebook Login for Business with scopes (see [permissions.md](./permissions.md)).
2. Exchange / obtain User access token.
3. `GET /me/accounts?fields=id,name,access_token,instagram_business_account`
4. Capture:
   - Page `id`
   - Page `access_token` (**Page access token** — use for ICM)
   - `instagram_business_account.id` → `{ig-user-id}`

Base host: `https://graph.facebook.com` (versioned path e.g. `/v25.0/`).

---

## Discovery

```http
GET /{ig-user-id}/creator_marketplace_creators
  ?access_token={page_access_token}
  &fields=...
  &limit=...
  &{filters}
```

Minimal smoke:

```http
GET /{ig-user-id}/creator_marketplace_creators
  ?recommendation_type=most_relevant_for_me
  &fields=id,username,biography,country,profile_picture_url
  &limit=5
  &access_token={page_access_token}
```

### Documented parameter notes

- When `username` is specified, other filters (e.g. `creator_countries`) cannot be applied.
- When `similar_to_creators` is used, keyword `query` cannot be used.
- `query` can be combined with other filters (e.g. `creator_age_bucket`).
- If searched `username` matches an eligible professional account, it may return regardless of Marketplace onboarding status.

### Filters / params (from Meta docs — non-exhaustive dump)

| Param | Notes / example values |
| --- | --- |
| `creator_countries` | ISO codes, e.g. `['US']`, `['IN']` |
| `creator_min_followers` | `0`, `10000`, `25000`, `50000`, `75000`, `100000`, `250000`, `1000000` |
| `creator_max_followers` | `10000`, `25000`, `50000`, `75000`, `100000`, `250000`, `1000000` |
| `creator_age_bucket` | `18_to_24`, `25_to_34`, `35_to_44`, `45_to_54`, `55_to_64`, `65_and_above` |
| `creator_interests` | Enums e.g. `FASHION`, `BEAUTY`, `TRAVEL_AND_LEISURE_ACTIVITIES`, … (full list in Meta docs) |
| `creator_gender` | `male`, `female` |
| `creator_states` | US states only; requires `creator_countries=['US']` |
| `creator_min_engaged_accounts` / `creator_max_engaged_accounts` | discrete buckets per docs |
| `major_audience_age_bucket` | same age bucket enums |
| `major_audience_gender` | `male`, `female` |
| `major_audience_countries` / `major_audience_states` | audience geo; states need US country |
| `query` | free-text keywords |
| `username` | exact / specific creator lookup |
| `recommendation_type` | e.g. `most_relevant_for_me` (used in our older Explorer notes) |
| `limit` | page size (confirm max in live docs) |

Response fields commonly used for product + review: `id`, `username`, `biography` / bio, `country`, `gender`, `profile_picture_url`, insights nested fields, media fields when requested.

---

## Creator insights

Query insights for a specific creator (typically via `username` + `fields=insights.metrics(...)`).

Example metrics called out in docs:

| Metric | Notes |
| --- | --- |
| `total_followers` | lifetime / overall |
| `creator_engaged_accounts` | day/overall; breakdowns e.g. follow_type, gender, age, top_countries, top_cities |
| `creator_reach` | day/overall; breakdowns e.g. follow_type, media_type |
| `reels_interaction_rate` | overall, last_90_days |
| `reels_hook_rate` | overall, last_90_days |

App Review wants the product to show something like **bio, follower count, account reach** — map UI fields to real response fields.

---

## Media / content-style fields (on creator objects)

Docs describe nested media collections when `username` is specified, e.g.:

- `branded_content_media`
- `recent_media`
- `past_partnership_ads_media` (insights not available for past partnership ads media per docs)

Media insight examples: likes, comments, views, shares, permalink, thumbnail, caption, etc.

Not required for the minimal ICM permission demo, but useful later.

---

## Brand information API (OUT OF THIS REVIEW)

```http
GET /{ig-user-id}/creator_marketplace_brand_info
```

Documented permissions include `instagram_creator_marketplace_discovery`, `instagram_basic`, **`ads_management`**.

Custom audiences for discovery filtering. **Do not include in this App Review.** Separate permission + screencast later.

---

## Rate limits (ICM docs)

| Level | Cap |
| --- | --- |
| Account | 1000 requests / user / hour |
| Application | `1000 * Number of Effective Users` per rolling hour (DAU-based; may use weekly/monthly active when usage fluctuates) |

---

## Error codes (document dump)

| Code | Meaning (ICM) |
| --- | --- |
| 10 | Permission Denied — **App Missing Permission** (`instagram_creator_marketplace_discovery`) |
| 10 | Permission Denied — **Brand Eligibility** (brand cannot onboard / not eligible) |
| 100 | Invalid Parameter Input (bad filters, bounds, category limits, etc.) |

Brand info endpoint also: 10 Authorization Error if missing `ads_management` against ad account; 100 if `acting_business_id` cannot access IG user’s ad accounts.

---

## App Review evidence calls

Before Advanced Access submit (Meta App Review tutorial):

- Make **≥1 successful API call using each permission** in the **30 days** before submit.
- Calls can be from the app **or** Graph API Explorer.

Suggested Explorer sequence (permissions ticked, Pages selected):

1. Generate User token with ICM five scopes.
2. `GET /me/accounts?fields=id,name,access_token,instagram_business_account`
3. Switch to Page token.
4. `GET /{ig-user-id}/creator_marketplace_creators?...`
5. Save request IDs / screenshots for the evidence folder (optional but useful if reviewer asks).

Explorer: https://developers.facebook.com/tools/explorer

---

## Standard vs Advanced Access

| Access | Behavior |
| --- | --- |
| Standard | Auto-granted when permission is added; **test / simulated** creator data; only roles on the app can be asked for the permission |
| Advanced | App Review; real creator inventory for end users |

Do not promise real inventory in marketing until Advanced is approved.
