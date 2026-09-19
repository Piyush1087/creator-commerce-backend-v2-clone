# Requirements — pass App Review for Creator Marketplace

Sources: Meta ICM API (Jun 2026), App Review tutorial (Jun 2026), permissions reference, MCP on this app.  
Full URL index: [sources.md](./sources.md).  
Objective: a complete product Meta can log into and reproduce. Not a demo page. Not “dashboard configured.”

---

## 0. Scope lock

| In scope | Out of scope (this packet) |
| --- | --- |
| Instagram Creator Marketplace API | Facebook Creator Discovery API |
| Facebook Login for Business + five ICM permissions | `ads_management` / brand_info / custom audiences |
| Brand discovers IG creators in **our** product | Creator-side Instagram Login (`instagram_business_*`) review |
| Advanced Access later | Submit today |

See [instagram-vs-facebook.md](./instagram-vs-facebook.md).

---

## 1. What the API actually is

Brands discover Instagram creators for partnership ads using authenticated first-party data.

| | Requirement |
| --- | --- |
| Login | **Facebook Login** (Facebook Login for Business). Permissions granted in that dialog. |
| Token | **Page access token** for a Page linked to the brand’s Instagram Professional account |
| Brand | Page+IG eligible for Marketplace, or already onboarded (accept [ICM Terms](https://www.facebook.com/business/help/488723392994445) if eligible but not onboarded) |
| Call | `GET /{ig-user-id}/creator_marketplace_creators` on `graph.facebook.com` |
| `{ig-user-id}` | `instagram_business_account.id` from `GET /me/accounts?fields=id,name,access_token,instagram_business_account` |
| Permission that gates the call | `instagram_creator_marketplace_discovery` — missing it is error **10** |

Standard Access (now): test/simulated data.  
Advanced Access (App Review): real creator inventory.

Do **not** include `creator_marketplace_brand_info` / custom audiences in this review — that needs `ads_management` and is a later submission.

Official ICM docs:  
https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/creator-marketplace

Endpoint dump / filters: [api-reference.md](./api-reference.md).

---

## 1b. Hub wording vs API wording (do not miss)

Instagram Help (Creator Marketing Hub) says brand IG must be Professional **or** connected to a Facebook Page:  
https://help.instagram.com/672550269221197/

**API** says you need a **Page access token** for a **Page connected** to the brand IG.

For our product and App Review: **Page + Professional IG linked. Do not disconnect the Page.**  
Full write-up: [brand-eligibility.md](./brand-eligibility.md).

---

## 2. What Meta will reject if missing

From [common mistakes](https://developers.facebook.com/docs/app-review/submission-guide/common-mistakes/) and ICM review instructions:

| Rejection | What we must have |
| --- | --- |
| App inaccessible | Public HTTPS product (not localhost). Valid TLS. Reviewer can load it. |
| Incomplete / still developing | Finished brand flow: connect Page/IG → grant consent → **search creators in our UI** → show bio, followers, reach-style fields |
| Permission not in screencast | One recording per requested permission, reproducing the exact UI path |
| Extra permissions | Only the five in [permissions.md](./permissions.md) |
| Facebook Login not found / broken | Visible Login for Business in-product; reviewer can complete it |
| Fake account | Real Facebook user + real Page + real Professional IG |
| Allowed usage fail | Copy must match Meta’s allowed usage (discover creators for a brand onboarded to Marketplace — not ads manager, not DMs) |
| No successful API call | ≥1 successful call **per permission** in the **30 days** before submit (app or Graph Explorer) |
| ICM-specific | Dialog lists permissions; **“Discover content creators on the Instagram Creator Marketplace platform”** is visible; login flow matches Meta’s ICM example as closely as possible |
| Wrong login family | Do not prove this packet with Instagram Login (`instagram_business_*`) |
| Listed platform we cannot demo | Only web (or whatever we actually ship) in App Settings |

Screencasts: English UI if possible; captions if not; **omit audio**. Detail: [screencast-and-media.md](./screencast-and-media.md).

---

## 3. Product bar (this is the real work)

Reviewers verify the **app**, not Explorer.

Must exist in **our** application:

1. Brand user signs into our app (credentials we will put in reviewer instructions).
2. Connect Instagram via a **linked Facebook Page** (Facebook Login for Business).
3. Consent screen shows Marketplace discovery.
4. Brand runs a **creator search** on a real product surface (not a throwaway ICM demo).
5. Results show at least: identity, bio, follower count, reach-style insight.

Until that path works end-to-end on a public URL, we do not open the Submit dialog.

---

## 4. App Review form (six components)

Meta will not approve Advanced Access unless all of these pass. Detail: [application-steps.md](./application-steps.md)

1. **Business verification** — portfolio connected and verified  
2. **App settings** — icon 1024² (no Meta logos), privacy policy URL, data deletion URL, category, contact email, platforms  
3. **Allowed usage** — per-permission “how we use this” + screencast  
4. **Data handling** — how Platform Data is processed/transferred  
5. **Data protection** — app purpose, sharing, deletion, security  
6. **Reviewer instructions** — public URL, our-app login, Facebook user, which Page/IG to pick, click-path matching the screencasts  

Non-eng checklist: [non-technical.md](./non-technical.md).

MCP on this app (2026-09-19): `can_submit=true`, **no privacy policy**, **business verification fails**, `NO_SUBMISSION`. Hygiene and BV are blockers even if `can_submit` is true.

---

## 5. Login-type risk

Instagram App Review docs: Advanced Access permission sets depend on login type; **Facebook Login and Instagram Login are treated as separate families**.  
https://developers.facebook.com/docs/instagram-platform/app-review

This app currently has **Instagram Login** and **Facebook Login for Business**.

For **this** submission: request **only** Facebook Login ICM permissions. Do not request `instagram_business_*` here. Keep creator Instagram Login off this review so the reviewer is not sent down the wrong login.

---

## 6. Token chain (what eng must implement)

```text
Facebook Login for Business
  → User token with the five ICM scopes (Pages ticked in the dialog)
  → GET /me/accounts?fields=id,name,access_token,instagram_business_account
  → Page token + ig-user-id
  → GET /{ig-user-id}/creator_marketplace_creators
```

If `/me/accounts` is empty: Pages were not granted in the login dialog.  
If Page has no `instagram_business_account`: IG is not linked.  
If API returns `data: []` with no error: brand eligibility / Marketplace ToS — not a missing scope. Reviewer still needs **some** successful, visible search result in our UI (Standard Access test data is acceptable until Advanced Access).

Login for Business docs:  
https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-login-for-instagram

---

## 7. Permission naming trap

| Use | Do not use as the Graph scope |
| --- | --- |
| `instagram_creator_marketplace_discovery` | `instagram_creator_marketplace` (dashboard label / incomplete name) |
| | `instagram_creator_marketplace_messaging` (DMs — separate review) |
| | `facebook_creator_marketplace_discovery` (Facebook Creator Discovery API) |

---

## 8. Pre-submit evidence checklist (combined)

- [ ] Product path §3 on public HTTPS  
- [ ] Five screencasts ([screencast-and-media.md](./screencast-and-media.md))  
- [ ] ≥1 successful call per permission in last 30 days  
- [ ] Brand Page + Professional IG linked; ToS if needed ([brand-eligibility.md](./brand-eligibility.md))  
- [ ] Non-technical hygiene ([non-technical.md](./non-technical.md))  
- [ ] Form answers drafted ([application-steps.md](./application-steps.md))  
- [ ] MCP re-check: privacy URL present, BV passes, privileges match the five scopes  

Only then: Submit once. Do not switch to Live until Advanced Access is approved.
