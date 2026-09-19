# Instagram Creator Marketplace vs Facebook Creator Discovery

Meta treats these as **two distinct, complementary APIs**. Do not merge them into one App Review or one permission set.

Launch note (both GA Oct 2025):  
https://developers.facebook.com/blog/post/2025/09/09/instagrams-creator-marketplace-and-facebook-creator-discovery-apis-are-launching-soon-get-ready/

| | **Instagram Creator Marketplace** (this track) | **Facebook Creator Discovery** (later / separate) |
| --- | --- | --- |
| Surface | Instagram creators | Facebook creators (Pages / profiles opted into data sharing) |
| Purpose | Discover / evaluate creators for **partnership ads** on IG | Same idea on **Facebook** |
| Primary docs | https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/creator-marketplace | https://developers.facebook.com/docs/fb-creator-discovery/ |
| Core permission | `instagram_creator_marketplace_discovery` | `facebook_creator_marketplace_discovery` |
| Other scopes (documented) | `instagram_basic`, `pages_show_list`, `pages_manage_metadata`, `business_management` | `pages_show_list` (with the FB discovery permission) |
| Typical call | `GET /{ig-user-id}/creator_marketplace_creators` | `GET /creator_marketplace/creators` and `/creator_marketplace/content` |
| Token | **Page access token** for a Page **connected to brand IG Professional** | **Page access token** (FB Login → `/me/accounts`) |
| Brand ToS / eligibility | Instagram Creator Marketplace / Creator Marketing Hub path | Facebook Creator Discovery ToS (checked at Login for eligible brands) |
| Rate limits (documented) | ~1000 / user / hour; app scales with effective users | 2000 / user / hour; 10_000 / app / hour |
| Standard Access | Simulated / test creator data | Simulated / mocked creator data |
| Advanced Access | App Review required for real inventory | App Review required for real inventory |

## What we are applying for

**Instagram Creator Marketplace only** on app `1718441312765233`.

Reasons:

- Product is Instagram-first creator commerce / discovery.
- Permissions, screencasts, and ToS are IG-specific.
- Mixing FB Discovery into the same packet invites “extra permission / cannot reproduce” rejection.

## What we are explicitly not doing in this submission

- Do not request `facebook_creator_marketplace_discovery`.
- Do not demo Facebook-only creator search as the ICM proof.
- Do not cite FB Discovery endpoints in ICM allowed-usage text.

If product later wants Facebook creators, open a **second** review with its own screencasts and copy.

## Naming traps

| Name you might see | Meaning |
| --- | --- |
| Instagram Creator Marketplace API | This track |
| Facebook Creator Discovery API | Other API |
| Creator Marketing Hub | Meta Business Suite **UI** for brands (not our API) |
| `instagram_creator_marketplace` (no `_discovery`) | Dashboard/group name — **not** the Graph permission ICM docs require |
| `instagram_creator_marketplace_discovery` | Correct ICM permission |
| `instagram_creator_marketplace_messaging` | Partnership DMs — different permission / review |
| Business Discovery (older IG Graph feature) | Different product (discover public business profiles) — not ICM |

## Review implication

One screencast packet per API family. Reviewer instructions must say **Instagram** Marketplace discovery and show the IG permission string in the Login dialog.
