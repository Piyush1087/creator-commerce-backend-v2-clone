# Screencast and screenshot pack

Parked media requirements for the clean ICM App Review.  
**Do not record yet** — wait until discovery UI exists on a public URL (prod for review).

Official guides:

- https://developers.facebook.com/docs/app-review/submission-guide/screen-recordings/
- ICM App Review notes in Meta’s Creator Marketplace docs

---

## Production rules

- English UI (or English captions)
- ~1080p; large cursor; mouse clicks preferred
- **No audio**
- Annotate when a permission is used
- Start logged out of our app and Meta
- Show Facebook Login button per brand guidelines

Store videos outside git. Track status here only.

| Asset | Status | Link |
| --- | --- | --- |
| Clip A — App login | not started | |
| Clip B — Facebook Login + ICM consent | not started | |
| Clip C — Page + IG professional connect | not started | |
| Clip D — Creator search + insights | not started | |
| Still — Privacy policy | not started | |
| Still — Terms | not started | |
| Still — Data deletion instructions | not started | |
| Still — Dashboard permission list | not started | |

---

## Required clips

### Clip A — Product login

1. Open review URL (prod preferred):  
   `https://dashboard.thecreatorshop.in/...`
2. Logged-out → sign in with the **brand test user** from verification details
3. Reach brand workspace

### Clip B — Facebook Login + ICM consent

1. Go to **Settings → Integrations**  
   (`/brand/settings/integrations`)  
   and/or the product creator-discovery route (TBD — real product UI, not a throwaway demo page)
2. Start Facebook Login for Business
3. Pause on permissions so reviewers can read them
4. ICM wording visible: discover creators on Instagram Creator Marketplace
5. Grant companion scopes (`instagram_basic`, pages list/metadata, `business_management`)

### Clip C — Page + Instagram professional

1. Select the Facebook Page from the test pack
2. Show linked Instagram professional account
3. Return to connected state in our UI

### Clip D — Discovery + insights (proves ICM)

1. Open creator search (product discovery UI once built)
2. Run a search
3. Show results (bio, followers, etc.)
4. Open insights for one creator
5. Optional annotation: Graph `creator_marketplace_creators`

Under Standard Access, mock/test creators are acceptable for **plumbing**.
For Advanced Access review, Meta expects the flow to demonstrate real usage of
the permission; use the eligible brand Page/IG from the test pack.

### Do **not** record a `pages_read_engagement` clip

We are **not** submitting that permission on this pass.

---

## Supporting screenshots

1. Privacy Policy page loading
2. Terms page loading
3. **Data deletion instructions** page on our domain (once hosted)
4. App Dashboard requested permissions for this submit

---

## App Verification Details — draft skeleton

```text
Primary App URL:
  https://dashboard.thecreatorshop.in/

Also available for internal parity:
  https://dashboard.dev.thecreatorshop.in/

Brand login (our app):
  email: <reviewer brand user>
  password: <vault>

Meta / Page / IG:
  Facebook user: <...>
  Page name: <...>
  Instagram professional: @<...>

Steps:
  1. Open Primary App URL and sign in with brand credentials.
  2. Open Settings → Integrations
     (or brand discovery route when built).
  3. Connect with Facebook Login; grant requested permissions.
  4. Select Page <name>; confirm IG @<handle>.
  5. Run creator search "<example>"; open a result for insights.

Screencast matches steps 1–5.
```
