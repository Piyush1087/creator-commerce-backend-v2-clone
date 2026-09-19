# App Review application steps — do not submit

Dashboard: [App Review](https://developers.facebook.com/apps/1718441312765233/app-review/permissions/) on **creator marketplace API 2**.

This is the form Meta will score. We collect complete answers here. We click **Submit** only when [requirements.md](./requirements.md) is satisfied.

App Review components: **verification → app settings → allowed usage → data handling → data protection → reviewer instructions → Submit.**

Official walkthroughs:

- https://developers.facebook.com/documentation/resp-plat-initiatives/appreview/tutorial
- https://developers.facebook.com/documentation/resp-plat-initiatives/appreview/content
- Common rejections: https://developers.facebook.com/docs/app-review/submission-guide/common-mistakes/

Non-eng prep: [non-technical.md](./non-technical.md). Media: [screencast-and-media.md](./screencast-and-media.md). URLs: [sources.md](./sources.md).

---

## Before the form (blockers)

- [ ] Product path in [requirements.md](./requirements.md) §3 works on **public HTTPS**
- [ ] One screencast per permission in [permissions.md](./permissions.md) (English UI or captions; no audio)
- [ ] ≥1 successful Graph call per permission in the last 30 days
- [ ] Privacy policy URL live (no Meta trademarks in app icon)
- [ ] Data deletion instructions URL live
- [ ] Contact email on the app is verified and we can read it
- [ ] Business portfolio verified and **claimed this app**
- [ ] Platforms listed in Settings = only platforms that actually work (web). Remove iOS/Android if we do not have them — Meta reviews every listed platform
- [ ] Facebook Login for Business Valid OAuth Redirect URIs match production/dev callbacks the reviewer will hit
- [ ] Reviewer pack: our-app brand login + **real** Facebook user who admins the test Page + Professional IG linked + Marketplace ToS accepted if prompted
- [ ] Login configuration includes `instagram_creator_marketplace_discovery`

MCP (2026-09-19): no privacy policy; business verification does not pass; never submitted.

---

## Step 1 — Permissions on the request

App Review → Permissions and features (already Standard Access).

Request **Advanced Access** only for the five in [permissions.md](./permissions.md).  
Remove anything else from the request before submit.

Do not start this step until the product is testable. Requesting Advanced Access opens the rest of the form.

---

## Step 2.1 — Business verification

Connect a **verified** business portfolio to this app.

If the portfolio is not verified, Meta sends you to Business Suite Security Center. That can take days. App Review will not complete without it.

App purpose in settings: **Clients** (we serve multiple brands), not “only people with a role on the app.”

---

## Step 2.2 — App settings

Same fields as Settings → Basic. Reviewers see what is on the app.

| Field | Pass bar |
| --- | --- |
| App icon | 1024×1024, no Meta/Facebook/Instagram logos |
| Privacy policy URL | Public, matches what Login shows users |
| User data deletion | Public instructions URL |
| App category | Accurate (business / creator tools — not a random category) |
| Primary contact | Inbox we monitor |
| Platforms | Web URL the reviewer uses. Nothing we cannot demo |

Changing Basic/Advanced settings **after** submit can force re-review. Freeze settings once the packet is ready.

---

## Step 2.3 — Allowed usage

For **each** of the five permissions:

1. Certify allowed usage.
2. Written “how our app uses this” — specific, in-product, matches the screencast.
3. Upload that permission’s screencast.
4. Agree to allowed usage.

Draft copy lives in [permissions.md](./permissions.md). If a permission is not visible in the product, **remove it from the request** rather than stretching the story.

---

## Step 2.4 — Data handling

Questions on processing and transfer of **Platform Data** (tokens, app secret, Meta user IDs, emails, profile pictures, usernames, and anything derived).

Answers must match what the backend actually does (encryption at rest, who can see tokens, no selling IG data). Inconsistent answers vs the live app are a rejection.

---

## Step 2.5 — Data protection

Four buckets if shown:

| Bucket | We must be able to show |
| --- | --- |
| App purpose | Brand Marketplace discovery for clients |
| Data sharing | Named processors only (hosting, etc.) — no surprise third parties |
| Data deletion | How a brand disconnects / we delete tokens and derived fields |
| Data security | Token encryption, access control |

If this section does not appear, skip — some apps are not prompted.

---

## Step 2.6 — Reviewer instructions

Write a path a stranger can follow without Slack.

Include:

1. Public web URL (production or a stable staging host). **Not localhost.**
2. Our-app username/password for a **brand** that already has (or can connect) the test Page.
3. Which button is Facebook Login for Business.
4. Which Facebook user / Page / IG to select.
5. Exact clicks to search creators and open insights (same as screencasts).
6. Notes: tick Pages in the Facebook dialog; permission list must show Marketplace discovery.

If staging needs a second gate (HTTP auth, VPN), put those credentials here. Reviewer cannot get in → **entire** submission rejected.

---

## Step 3 — Submit

Only when every section on the overview shows complete.

Certify truthfulness + Platform Terms.

**Do not switch the app to Live** until Advanced Access is approved. Live apps can only request approved permissions; switching early can lock testers out.

We are **not** at this step.

---

## After a rejection (if it happens)

Do not argue in email. Resubmit with **updated reviewer instructions** that answer the written feedback. That is Meta’s channel.
