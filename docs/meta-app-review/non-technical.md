# Non-technical requirements — App Review ops / legal

Eng builds the product. This file is everything else that can still get the submission rejected.

Related: [application-steps.md](./application-steps.md), [brand-eligibility.md](./brand-eligibility.md), [sources.md](./sources.md).

---

## 1. Business verification

| Item | Detail |
| --- | --- |
| Why | App Review Advanced Access requires a **verified** business portfolio connected to the app (since ~2023 for many advanced permissions) |
| Where | Meta Business Suite → Security Center → Start verification |
| App claim | Portfolio must **claim / own** app `1718441312765233` |
| Timeline | Can take days (sometimes up to ~14 business days if docs requested) |
| App purpose | Set to **Clients** (we serve multiple brands), not “only people with roles on the app” |

MCP (2026-09-19): `business_verification_passes: false` on this app.

Without BV, the App Review form may open but will not complete.

---

## 2. App Dashboard hygiene (Settings → Basic)

| Field | Pass bar |
| --- | --- |
| App icon | 1024×1024; **no** Meta / Facebook / Instagram logos or trademarks |
| Privacy policy URL | Public HTTPS; same policy users see in Login |
| Terms of service URL | Strongly recommended / often expected for business apps |
| User data deletion | Public instructions URL (how a user requests deletion) |
| Contact email | Verified; inbox we monitor for App Review mail |
| Category | Accurate business / creator-tools category |
| Platforms | **Only** platforms we can demo (web). Remove iOS/Android if we do not have them — Meta reviews every listed platform |

MCP (2026-09-19): no privacy policy on this app.

Freeze Basic/Advanced settings once the packet is ready — changes after submit can force re-review.

---

## 3. Brand test identity (real accounts only)

Fake Facebook accounts → **entire submission rejected**.

Need a real chain:

| Asset | Requirement |
| --- | --- |
| Facebook user | Real person; Admin/Developer/Tester on the Meta app; Admin on the Page |
| Facebook Page | Brand Page used in Login |
| Instagram Professional | Business or Creator, **linked to that Page** |
| Business portfolio | Page + IG as assets; BV preferred |
| Marketplace / Hub ToS | Agree in Suite if prompted ([Hub help](https://help.instagram.com/672550269221197/), [ICM ToS](https://www.facebook.com/business/help/488723392994445)) |

Do **not** disconnect Page to go IG-only for API testing. See [brand-eligibility.md](./brand-eligibility.md).

Also provide **our-app** brand login credentials for the reviewer (email/password or magic-link process documented).

---

## 4. App roles (Development / Standard Access)

Until Advanced Access:

- Only users with a **role on the app** (or claiming business) can grant unapproved permissions.
- Add every human who will connect during build/test: Admin / Developer / Tester.

MCP cannot list Facebook “test users” reliably; verify in App Dashboard → Roles.

---

## 5. Legal / data answers (form)

App Review will ask **data handling** and **data protection** questions about Platform Data (tokens, Meta user IDs, emails, profile pictures, usernames, derived data).

Ops + eng must agree on true answers:

| Topic | What we must be able to state honestly |
| --- | --- |
| App purpose | Brand discovers Instagram Marketplace creators for partnership / campaigns inside our product |
| Data sharing | Named processors only (hosting, email, etc.) — no selling IG creator data |
| Retention | How long tokens and creator search caches live |
| Deletion | How brand disconnect works; how we delete tokens / derived fields; data-deletion URL |
| Security | Encryption at rest for tokens; access control |

Inconsistent answers vs the live product → rejection or later compliance pain.

---

## 6. Reviewer access pack (non-eng owns delivery)

Deliver to whoever fills the form:

- [ ] Public HTTPS URL (prod or stable staging) — not localhost
- [ ] Staging gate credentials if any (HTTP auth, VPN) — if missing, whole submission fails
- [ ] Our-app brand username / password
- [ ] Which Facebook user / Page / IG to use
- [ ] Step-by-step click path matching screencasts
- [ ] Note: tick Pages in Facebook dialog; Marketplace discovery permission visible
- [ ] Valid privacy policy URL (again)
- [ ] Valid gift codes / OTP paths if our signup requires them

---

## 7. What we are not doing non-technically in this pass

- Not applying for Facebook Creator Discovery
- Not completing ads / custom audience (`ads_management`) path
- Not switching the app to Live before Advanced Access
- Not using fake accounts for “easier” review

---

## 8. Status worksheet (fill as ops progresses)

| Item | Owner | Status | Notes |
| --- | --- | --- | --- |
| Business verification | | | |
| App claimed by verified portfolio | | | |
| Privacy policy URL live | | | |
| Terms URL live | | | |
| Data deletion URL live | | | |
| Contact email verified | | | |
| App icon uploaded | | | |
| Platforms trimmed to web | | | |
| Brand Page + IG linked | | | |
| Hub / Marketplace ToS agreed | | | |
| App roles for testers | | | |
| Reviewer credential pack | | | |
| Screencasts recorded | | | |
