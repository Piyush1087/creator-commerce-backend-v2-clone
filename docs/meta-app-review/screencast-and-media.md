# Screencasts and screenshots — App Review media pack

Objective: Meta can **reproduce** every requested permission in our product.  
Missing a recording for a permission → that permission is denied (others may still pass).  
Fake accounts → **entire** submission rejected.

Sources:

- ICM App Review instructions: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/creator-marketplace
- Common mistakes: https://developers.facebook.com/docs/app-review/submission-guide/common-mistakes/
- App Review tutorial (screencast guidance): https://developers.facebook.com/documentation/resp-plat-initiatives/appreview/tutorial
- Permissions reference (per-permission screencast requirements): https://developers.facebook.com/docs/permissions/

---

## Global recording rules

| Rule | Detail |
| --- | --- |
| Language | English UI if possible |
| Captions | Required if UI is not English or not self-explanatory |
| Audio | **Omit** — reviewers do not listen |
| Completeness | Show end-to-end user path, not a zoomed snippet of a table |
| Match form text | Same clicks described in reviewer instructions and allowed-usage answers |
| Product readiness | App must look finished (not “still developing”) |
| Public app | Recording must be of the same publicly reachable build reviewers use |
| No Meta trademarks in app icon | Separate from video, but checked in App Settings |

Recordings are a **map** for the reviewer to follow. Why we need the permission goes in the **form text**, not in voiceover.

---

## Required videos (minimum)

One video **per permission** in [permissions.md](./permissions.md). You may also keep one long master cut and export per-permission clips if Meta’s form wants separate uploads.

### Master narrative (must appear across clips)

1. Open our **public** web app.
2. Sign in as the **brand** test user (our credentials).
3. Navigate to Connect / Integrations (Facebook Login for Business).
4. Complete Facebook Login:
   - Grant the ICM permission list.
   - **“Discover content creators on the Instagram Creator Marketplace platform”** (or equivalent Meta consent copy) is **visible**.
   - Select / tick the **Facebook Page**.
   - Connect Instagram via the **linked Page**.
5. Land back in our app with brand IG identity shown.
6. Open the **real** creator discovery / search surface (not a throwaway demo page).
7. Run a search / recommendation.
8. Show results: at least identity, bio, follower count, reach-style insight.
9. Optionally open one creator detail if that is part of the product.

ICM docs: login flow should match Meta’s **Login Flow Experience** example as closely as possible.

---

## Per-permission checklist

### 1. `instagram_creator_marketplace_discovery`

- [ ] Full Facebook Login in our app
- [ ] Consent list includes Marketplace discovery wording
- [ ] Creator **search** in our UI using ICM
- [ ] Results / insights: bio, followers, reach (or equivalent fields we actually render)

### 2. `instagram_basic`

- [ ] Same Login
- [ ] Brand selects Instagram Professional via Page
- [ ] Our app displays connected IG identity (username / ID)

### 3. `pages_show_list`

- [ ] Login returns manageable Pages
- [ ] Page picker **or** clear single-Page selection in our UI / dialog

### 4. `pages_manage_metadata`

- [ ] Successful Page + linked IG connect (call out the link; do not invent unrelated Page-edit UI)
- [ ] Frame as ICM dependency, not “we edit Page about text”

### 5. `business_management`

- [ ] Permission granted in the same Login
- [ ] Do **not** build a fake Business Manager admin screen
- [ ] Allowed-usage text: dependency of discovery only

---

## Screenshots (optional but useful)

Meta may ask for video; still keep a still pack for our notes / resubmit:

| Shot | Why |
| --- | --- |
| App Settings → Basic (privacy, data deletion, icon) | Hygiene evidence |
| Permissions and features (five scopes, Standard/Advanced status) | Scope freeze |
| Facebook Login for Business → Valid OAuth Redirect URIs | Callback correctness |
| Login dialog showing Marketplace discovery string | ICM-specific requirement |
| Our search results UI with creator cards | Product proof |
| Graph Explorer successful `creator_marketplace_creators` (redact tokens) | 30-day API evidence |
| Suite Creator Marketing Hub Agree / Discover (if used for ToS) | Brand eligibility |

Store under a private ops folder (not in git with secrets). Redact access tokens always.

---

## What not to film

- Graph Explorer **instead of** our product as the only demo
- Localhost-only flows
- Fake Facebook profiles
- Permissions we are **not** requesting (`ads_management`, messaging, FB Creator Discovery)
- Broken / WIP screens (“coming soon” for the review path)
- Instagram Login (`instagram_business_*`) as the proof for this Facebook Login ICM packet

---

## Reviewer instructions must mirror the videos

For each step in the video, the written reviewer path in [application-steps.md](./application-steps.md) §2.6 must name:

- URL
- Our-app credentials
- Which button
- Which Page / IG
- Exact search to run

If the video and the instructions disagree, expect rejection or “could not reproduce.”
