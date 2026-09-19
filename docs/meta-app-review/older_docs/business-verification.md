# Business portfolio verification (requirement)

Required for **brand** access to Meta Creator Marketplace / Creator Marketing Hub
inventory (Suite UI + non-empty `creator_marketplace_creators` for that brand).

This is **not** the same as:

- Creator **1,000 follower** rule (talent eligibility only)
- Meta Verified badge on a Page
- App Review Advanced Access (separate; app BV for The Creator Shop already passes)

**Status (2026-09-18):** Prompted in Business Suite for the portfolio that owns
TCS ICM Test. **Not completed yet** — Brian cannot do it right now. Remains a
gate before real creator rows / Suite Marketplace for that test brand.

Official: https://www.facebook.com/business/help/2058515294227817

---

## Who can submit

- Person with **full control** of the business portfolio
- Authorized to represent the legal entity

Prefer verifying **The Creator Shop’s real legal entity**, then attach Pages/IG
(including `TCS ICM Test`) as assets of that portfolio — do not invent a fake
company name for the test Page.

---

## What Meta asks

### 1. Business details (exact legal match)

- Legal business name  
- Official mailing address  
- Phone number  
- Website (`https://`, must load)

### 2. Prove connection to the business (one method)

- Business-domain email  
- Phone / SMS / WhatsApp  
- Domain verification (meta tag or DNS on the website)

### 3. Official documents (if no auto-match)

Upload clear, current scans (PDF/JPG/PNG). Redact unnecessary personal IDs.

| Purpose | Common document types |
| --- | --- |
| Legal name / registration | Certificate of incorporation, business license, GST certificate, articles / partnership deed, tax registration |
| Address / phone | Utility bill, bank statement, or tax doc showing **same** legal name + address |

India-oriented examples often used: incorporation / GST / PAN (company), plus address proof. Exact ask depends on Meta’s form for that portfolio.

---

## How long

| | |
| --- | --- |
| Meta stated SLA | **Up to 14 business days** |
| Typical if docs match | Often a few business days |
| Rejection / resubmit | Extra cycle |

Notification when approved or rejected. Editing business details after submit can force re-verification.

---

## After verification (checklist)

1. Confirm portfolio shows **verified** in Security Center  
2. Ensure Page + IG are **business assets** of that portfolio  
3. Grant user permission for Creator Marketplace on that Page (Business settings → people → Page permissions)  
4. Open **Creator marketing** / **Creator marketplace** → Get started → Agree ToS  
5. Re-run Graph:  
   `GET /{ig-user-id}/creator_marketplace_creators?...`  
6. Update [current-test-assets.md](./current-test-assets.md)

---

## If we skip BV for now

Allowed for planning / later eng:

- Keep using TCS ICM Test for Login + Page + IG + empty ICM responses  
- Build ICM demo UI against empty/`data: []`  
- Do **not** expect Suite Creator marketing or real discovery rows until BV + onboard  

App Review later still needs a **demo brand that can show search results** — that likely means BV completed (or another already-verified portfolio) before recording screencasts.
