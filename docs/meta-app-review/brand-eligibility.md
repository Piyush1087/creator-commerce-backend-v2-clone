# Brand eligibility — Creator Marketing Hub vs Creator Marketplace API

This is easy to get wrong because Meta’s **consumer/help** wording differs from **developer/API** wording.

## TL;DR for our product and App Review

**Keep Facebook Page + Instagram Professional linked.**  
Do **not** disconnect the Page and try to run discovery on “IG Professional alone.”

| Surface | What Meta says | What we need |
| --- | --- | --- |
| **Creator Marketing Hub** (Business Suite UI) | Brand IG must be a **Professional** account **or** connected to a Facebook Page to onboard | Useful for accepting ToS / seeing Hub inventory |
| **Instagram Creator Marketplace API** | Requires a **Page access token** for a **Page connected** to the brand’s Instagram business account | **Required** for our app, Graph calls, and App Review |

## Source — Hub / Instagram Help

Article (brand onboarding to Creator Marketing Hub):  
https://help.instagram.com/672550269221197/

Quoted requirement (as captured in planning):

> Brands must be eligible to access Creator Marketing Hub. Note: Your brand’s Instagram account must be a Professional account **or** connected to a Facebook Page in order to onboard to Creator Marketing Hub.

Onboarding steps in that article (Suite):

1. Go to Meta Business Suite and click **Get Started**. First visit → agree to Meta’s terms.
2. Click **Agree**.
3. Access Creator Marketing Hub.

That **or** applies to **Hub UI eligibility**, not to our Graph integration.

Meta Business Suite: https://business.facebook.com

## Source — API (developer)

Instagram Creator Marketplace API:  
https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/creator-marketplace

Documented access token rule:

> This API requires a **Page access token** for a **Page that is connected to your brand’s Instagram business account** and is either eligible to onboard or has onboarded to Instagram’s creator marketplace as a brand.

Eligibility note from the same docs:

- Meta checks brand eligibility during brand onboarding.
- If eligible but not onboarded → accept Instagram Creator Marketplace Terms of Service:  
  https://www.facebook.com/business/help/488723392994445

Permissions are granted with **Facebook Login** (Facebook Login for Business for our setup).

## Can we disconnect the Page and only use Professional IG?

| Goal | Answer |
| --- | --- |
| Use Creator Marketing Hub in Suite only | Possibly — Hub help allows Professional **or** Page |
| Call `/{ig-user-id}/creator_marketplace_creators` from our app | **No** — need Page token + linked IG |
| Pass App Review for ICM | **No** — Meta expects Login → connect Instagram via linked Facebook Page → search in our UI |
| Brand test account for reviewer | Page Admin + Professional IG linked + Hub/Marketplace ToS done |

If you disconnect the Page:

- `/me/accounts` may still list the Page, but **without** `instagram_business_account`
- Or Page token path breaks for ICM
- Empty `data: []` / eligibility errors become harder to debug
- Screencast cannot honestly show “connected via linked Facebook Page”

## Required brand asset chain (API + review)

```text
1. Facebook Page (user is Admin / can perform tasks)
2. Instagram Professional (Business or Creator) linked to that Page
3. Page + IG as assets of the business portfolio (preferred; BV helps Suite tools)
4. Creator Marketing / Marketplace visible → Get started → Agree ToS (if prompted)
5. Facebook Login for Business → grant ICM scopes → tick Pages
6. GET /me/accounts?fields=id,name,access_token,instagram_business_account
7. Use Page access_token + instagram_business_account.id for ICM calls
```

Facebook Login for Business (how Page + IG get wired in one flow):  
https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-login-for-instagram

## Symptom cheat sheet

| Symptom | Likely cause |
| --- | --- |
| `/me/accounts` → `[]` | Pages not granted in Login dialog; regenerate token and tick Pages |
| Page listed, no `instagram_business_account` | Professional IG not linked to Page |
| Hub menu missing | Portfolio / eligibility / wrong asset picker |
| Hub works, API `data: []` no error | Eligible but not fully onboarded / inventory / Standard Access mock empty — check ToS + Suite Discover |
| API error 10 Brand Eligibility | Brand not eligible for Marketplace onboard |
| API error 10 App Missing Permission | Missing `instagram_creator_marketplace_discovery` on the token/app |

## Decision locked for this pack

- Test brand and reviewer brand: **Page + Professional IG linked**, never IG-only.
- Hub ToS still useful so Suite and API eligibility align.
- Do not treat Instagram Help “or” as permission to drop the Page for engineering.
