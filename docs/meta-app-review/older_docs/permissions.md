# Permissions matrix — Creator Marketplace (brand / Facebook Login)

Source of truth for **this** App Review track: Instagram Creator Marketplace
discovery for brands via **Facebook Login**.

Creator-side **Instagram Login** insights (`instagram_business_*`) are already
approved on the app — **not** part of this submission or these screencasts.

References:

- ICM: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/creator-marketplace  
- Permissions: https://developers.facebook.com/docs/permissions/

---

## Official ICM required list (Facebook Login)

- `instagram_creator_marketplace_discovery`
- `instagram_basic`
- `pages_manage_metadata`
- `pages_show_list`
- `business_management`

---

## Decision summary

| Permission | This submission | Notes |
| --- | --- | --- |
| `instagram_creator_marketplace_discovery` | **Submit** | Creator search + bio, avatar, followers, reach-style fields |
| `instagram_basic` | **Submit** | Brand IG professional identity |
| `pages_show_list` | **Submit** | Page picker |
| `pages_manage_metadata` | **Submit** | Page / IG link; ICM dependency |
| `business_management` | **Submit** | ICM dependency (say so in use-case text) |
| `pages_read_engagement` | **Do not submit** | Not required for ICM; creator cards use discovery fields |
| `instagram_manage_insights` | **Do not submit** | FB-Login insights path — out of this review |
| `instagram_business_*` insights | **Already approved** | Creator Instagram Login — no re-demo in this submit |
| `ads_management` | **Do not submit** | `brand_info` / custom audiences only — deferred |

---

## Each permission (submit set)

### `instagram_creator_marketplace_discovery`

Discover Marketplace creators and related fields (bio, avatar, followers, etc.).  
Screencast: Facebook Login → grant → search → show results.

### `instagram_basic`

Brand IG professional basics; ICM dependency.  
Screencast: connected IG identity.

### `pages_show_list`

List Pages the user manages so they can pick one for the Page token.  
Screencast: Page selection.

### `pages_manage_metadata`

Page metadata / IG link Meta expects for ICM.  
Screencast: successful Page + IG connect.

### `business_management`

ICM dependency. Use-case: requested **as dependency of discovery**, not as Ads Manager.

---

## Out of scope (this review)

- **`pages_read_engagement`** — brand Page feed/admin; not ICM creator cards.  
- **`instagram_manage_insights`** — separate FB-Login insights product path.  
- **Creator Instagram Login + `instagram_business_manage_insights`** — already done; brand-only videos for this submit.  
- **`ads_management` / `creator_marketplace_brand_info`** — deferred.

---

## Suggested Graph Explorer scopes (ICM only)

```text
instagram_creator_marketplace_discovery
instagram_basic
pages_show_list
pages_manage_metadata
business_management
```

Tick Pages in the Login dialog. Do not add insights/`pages_read_engagement` unless debugging something else.

---

## Integrations UI note

`/brand/settings/integrations` = connect + capability flags.  
App Review still needs a product screen that runs **creator search** and shows ICM fields.
