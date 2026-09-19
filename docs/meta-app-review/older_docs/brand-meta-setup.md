# Brand Meta setup (Page / IG / Business Suite)

How-to for unlocking brand Creator Marketplace.  
Decisions: [FULL-PLAN.md](./FULL-PLAN.md). Live IDs: [current-test-assets.md](./current-test-assets.md).

---

## Brand vs creator

| Role | Bar |
| --- | --- |
| **Creator** (listed) | Professional public IG, **≥ 1,000 followers**, etc. |
| **Brand** (discover / API) | Verified **business portfolio**, IG + Page as assets, eligible country |

Brand IG follower count is **not** the 1k creator rule.

---

## End-to-end chain

```text
1. Facebook Page (you are Admin)
2. Instagram Professional linked to that Page
3. Page + IG are assets of a verified Business portfolio
4. Creator marketing / Marketplace visible → Get started → Agree ToS
5. Graph: User token (Pages ticked) → Page token → creator_marketplace_creators
```

---

## Preferred vs current

| Page | Role |
| --- | --- |
| **Growth Verse** | Preferred next brand — **link Professional IG**, then BV + ToS |
| **TCS ICM Test** | Already has IG — plumbing only; empty creators until BV/ToS |
| Pura Milk / Test Page 1303 | Ignore unless IG linked |

---

## Step A — Page

1. https://www.facebook.com/pages/create (or use existing Growth Verse)  
2. Confirm Admin under Page settings → Page access  

---

## Step B — Instagram Professional + link

1. IG app → switch account to **Professional** (Creator or Business)  
2. Link to the Facebook Page:  
   - Page → Settings → Linked accounts / Instagram, **or**  
   - Meta Business Suite → Settings → Accounts → Instagram accounts → Add / link to Page, **or**  
   - Accounts Center → connect Facebook Page to that IG  
3. Confirm in Explorer:  
   `GET /me/accounts?fields=id,name,instagram_business_account`  
   → Growth Verse shows an `instagram_business_account.id`

---

## Step C — Business portfolio (Business Manager / Suite)

1. https://business.facebook.com → correct **business portfolio** (The Creator Shop legal entity)  
2. Security Center → **Start verification** — see [business-verification.md](./business-verification.md)  
   (legal name, address, phone, https website, email/phone/domain confirm, docs if asked; up to ~14 business days)  
3. After verified: Settings → **Business assets** → ensure **Page** and **Instagram** are added to this portfolio  
4. Settings → People → your user → Page permissions → enable **Creator Marketplace / Creator marketing** access if toggles exist  

---

## Step D — Creator marketing in Suite

1. Same portfolio + Page/IG selected in the top picker  
2. Left nav or **All tools** → **Advertise** → **Creator marketing** (or Creator marketplace)  
3. First visit: **Get started** → **Agree** terms  
4. **Discover creators** should show people in Meta’s own UI  

If the tool is missing after BV → eligibility issue on that brand; try Growth Verse once IG-linked under the verified portfolio.

---

## Step E — Prove in Graph API Explorer

1. App **The Creator Shop** · User token · scopes include ICM set + `pages_show_list`  
2. Login dialog: **select the Page**  
3. `GET /me/accounts?fields=id,name,instagram_business_account`  
4. Switch to **Page token** for Growth Verse (or TCS)  
5. `GET /{ig-user-id}/creator_marketplace_creators?recommendation_type=most_relevant_for_me&fields=id,username&limit=5`  

Also add yourself under App Dashboard → Roles (admin/developer/tester) for Standard Access testing.

---

## Symptom cheat sheet

| Symptom | Fix |
| --- | --- |
| `/me/accounts` → `[]` | Tick Pages on token regenerate |
| Page without `instagram_business_account` | Finish Step B |
| No Creator marketing menu | Finish Step C (BV + assets) |
| Menu but empty Discover | Finish Step D ToS; wait/retry |
| API `data: []` no error | Steps C–D; not a token bug |
| API eligibility error | Wrong brand / not eligible — Step D eligibility |
