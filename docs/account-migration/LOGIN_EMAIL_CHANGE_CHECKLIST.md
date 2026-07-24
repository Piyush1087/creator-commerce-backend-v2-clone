# Login email change checklist — `@growthverse.in` → `@thecreatorshop.in`

**Purpose:** Flat list of places you currently sign in with a Growth Verse email.  
After migration, you need `@thecreatorshop.in` access to each — or you lose access (e.g. Postmark, Razorpay).

**Rule:** For each row — add new email → verify → make primary/owner → keep old email as backup for 2–4 weeks.

---

## Before anything else

- [ ] `admin@thecreatorshop.in` (or similar) exists in **Google Workspace** and can receive mail
- [ ] Your personal `@thecreatorshop.in` mailbox works (for vendor invites)
- [ ] Old `@growthverse.in` mail still works until every row below is done

---

## 1. Company & identity (do first)

| # | Where you log in | URL / how to find it | Who | Done |
|---|------------------|----------------------|-----|------|
| 1 | **Google Workspace** (admin) | [admin.google.com](https://admin.google.com) | Root admin | ☐ |
| 2 | **AWS root — dev account** | AWS Console → root user sign-in | Whoever owns root | ☐ |
| 3 | **AWS root — prod account** | Same, account `250037328530` | Whoever owns root | ☐ |
| 4 | **AWS SSO / IAM Identity Center** | [growthverse.awsapps.com/start](https://growthverse.awsapps.com/start/) | Each developer (`brian`, etc.) | ☐ |
| 5 | **GitHub** (personal + org if any) | [github.com/settings/emails](https://github.com/settings/emails) | Each dev with repo access | ☐ |
| 6 | **GitHub Organization** (if used) | Org → Settings → Billing / member emails | Org owners | ☐ |

**Notes**

- AWS root email change is separate from SSO user email — do **both**.
- SSO portal URL may still say `growthverse.awsapps.com` until org admin renames it (optional, later).
- Local `~/.aws/config` profile names (`creator-dev`, `creator-prod`) do **not** change.

---

## 2. Vendor dashboards — product won’t work without these

| # | Service | What breaks if locked out | Login URL | Done |
|---|---------|-------------------------|-----------|------|
| 7 | **Postmark** | OTP emails, notifications, brand mail | [account.postmarkapp.com](https://account.postmarkapp.com) | ☐ |
| 8 | **Razorpay** | Escrow, subscriptions, payouts | [dashboard.razorpay.com](https://dashboard.razorpay.com) | ☐ |
| 9 | **Meta Developer** (Instagram app) | Creator Instagram connect | [developers.facebook.com](https://developers.facebook.com) | ☐ |
| 10 | **Google AI Studio / Gemini API** | Brand scan, co-pilot, DNA | [aistudio.google.com](https://aistudio.google.com) or GCP console | ☐ |
| 11 | **Google Cloud Console** (OAuth project) | Creator “Sign in with Google” (when enabled) | [console.cloud.google.com](https://console.cloud.google.com) | ☐ |
| 12 | **Zyte** | Brand website scraping | [zyte.com](https://www.zyte.com) (account dashboard) | ☐ |
| 13 | **Wix** | Marketing site `thecreatorshop.in`, DNS records | [wix.com](https://www.wix.com) | ☐ |

**Also check Razorpay / Meta / Postmark for:**

- [ ] Other team members listed with `@growthverse.in` — add `@thecreatorshop.in`, remove old later
- [ ] Billing contact email on each vendor

---

## 3. Optional / legacy — change if you still use it

| # | Service | Notes | Done |
|---|---------|-------|------|
| 14 | **Parallel** | Legacy scrape; only if still paying | ☐ |
| 15 | **SST Console** | Frontend autodeploy; tied to GitHub + email | [sst.dev](https://sst.dev) | ☐ |
| 16 | **Domain registrar** | If not Wix — who owns `thecreatorshop.in` / `growthverse.in` | ☐ |

---

## 4. Dev-only (per person, not company-wide)

| # | Service | Who | Done |
|---|---------|-----|------|
| 17 | **ngrok** | Devs testing webhooks/OAuth locally | ☐ |
| 18 | **Stitch / Gemini CLI** | Designers; personal Google login | ☐ |
| 19 | **Local git** | `git config user.email` on each machine | ☐ |

---

## 5. Not a login change (but verify while you’re in each dashboard)

These use **API keys** in `.env` — login email change does **not** rotate keys.  
Just confirm you can still reach the dashboard after email change.

| Service | What to verify in dashboard (not email) |
|---------|----------------------------------------|
| Postmark | Sender `no-reply@thecreatorshop.in` verified; DNS on Wix if needed |
| Razorpay | Webhooks point to `api.thecreatorshop.in` / `api.dev.thecreatorshop.in` |
| Meta | OAuth redirect URIs include `dashboard.thecreatorshop.in/.../instagram/callback` |
| Google OAuth | Authorized domains / redirect URIs for dashboard URLs |
| Wix | DNS for Postmark (SPF/DKIM) if sending from `@thecreatorshop.in` |

---

## 6. AWS account contacts (not “login” but same inbox problem)

Update in AWS Console → **Account** (as root), both dev and prod:

- [ ] Root user email
- [ ] Operations contact
- [ ] Billing contact
- [ ] Security contact
- [ ] Budget / SNS alert emails (e.g. `rds-dev-alerts`)

---

## Suggested order

```
Workspace mail ready
    → AWS root + contacts (dev, prod)
    → AWS SSO user emails
    → GitHub emails
    → Postmark, Razorpay, Meta  ← you need these for the product
    → Gemini, Zyte, Google Cloud
    → Wix
    → Optional / dev tools
    → Remove @growthverse.in from vendors after 2–4 weeks
```

---

## Quick copy-paste tracker

```
☐ Google Workspace admin
☐ AWS root (dev)
☐ AWS root (prod)
☐ AWS SSO — brian
☐ AWS SSO — [other dev]
☐ GitHub — [name]
☐ Postmark
☐ Razorpay
☐ Meta Developer
☐ Google AI / Gemini
☐ Google Cloud (OAuth)
☐ Zyte
☐ Wix
☐ Parallel (if used)
☐ SST Console
☐ Domain registrar (if not Wix)
```

---

## Related docs

- [AUDIT_AND_MIGRATION_PLAN.md](./AUDIT_AND_MIGRATION_PLAN.md) — AWS/infra context
- [github.md](./github.md) — GitHub email steps
- [THIRD_PARTY_SERVICES.md](./THIRD_PARTY_SERVICES.md) — technical detail (env vars, webhooks) if needed
