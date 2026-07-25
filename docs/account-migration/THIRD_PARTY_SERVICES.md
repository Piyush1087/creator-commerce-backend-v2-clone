# Third-party services map — `@growthverse.in` → `@thecreatorshop.in`

**Purpose:** Every external service touched by v2, what to do for the email/domain migration, and whether you need a **new account** vs **update existing**.

**Repos scanned:** `creator-commerce-backend-v2`, `creator-commerce-frontend-v2`  
**Related:** [AUDIT_AND_MIGRATION_PLAN.md](./AUDIT_AND_MIGRATION_PLAN.md)

---

## How to read this doc

| Migration type | Meaning |
|----------------|---------|
| **Email only** | Change login / billing / notification email on the **same** vendor account |
| **Config update** | Dashboard settings (webhooks, OAuth redirects, verified sender) — keys usually stay |
| **New account** | Create a separate vendor account under Creator Shop — only if legal/ops wants a clean break |
| **No action** | Not tied to company email, or customer-provided |
| **Dev only** | Not production; optional for designers |

**Default recommendation:** Prefer **email only** + **config update** on existing accounts. New accounts add cost, re-KYC, and webhook/key rotation.

---

## Summary matrix

| Service | Used for | Config location | Migration | New account? |
|---------|----------|-----------------|-----------|--------------|
| **AWS** | Hosting, SSO, S3, ECS | `sst.config.ts`, `~/.aws/config` | Root + SSO user emails | No |
| **Google Workspace** | Company email, MX | Wix DNS + Admin Console | Add/promote `thecreatorshop.in` | No |
| **Wix** | Marketing site + DNS | Wix dashboard | Account email + billing | No |
| **GitHub** | Code, SST autodeploy | Org/repos, Actions secrets | Primary email on accounts | No (org optional) |
| **Postmark** | OTP, transactional email | Backend `.env` / SST | Sender domain + account email | Usually no |
| **Razorpay** | Escrow, subscriptions, card pay | Backend `.env` / SST | Merchant email, webhooks (URLs OK) | Only if new legal entity |
| **Meta (Instagram)** | Creator IG OAuth | Meta Developer app | App admin emails, OAuth redirects | No |
| **Google Cloud / OAuth** | Creator Google sign-in (backend ready) | `GOOGLE_CLIENT_ID` | OAuth consent screen, redirect URIs | No |
| **Google Gemini** | Brand scan, co-pilot, DNA | `GEMINI_API_KEY` | Billing account contact email | No |
| **Zyte** | Brand site scraping (Stage 1A) | `ZYTE_API_KEY` in `.env` | Billing/login email | No |
| **Parallel** | Legacy scrape (disabled in `.env`) | `PARALLEL_API_KEY` in SST | Billing email if still billed | No |
| **SST Console** | Autodeploy `main` → dev FE | `sst.config.ts` `console.autodeploy` | GitHub link + SST account email | No |
| **Slack** | Brand notification webhooks | Per-brand in app DB | N/A — brands paste their own URL | No |
| **Stitch** | UI design / MCP (dev) | `scripts/stitch-cli.mjs`, API key | Designer Google/API login | No |
| **ngrok** | Local OAuth / webhooks | Dev machine only | Personal ngrok account | No |

---

## Platform infrastructure

### AWS

| | |
|--|--|
| **Role** | ECS API, CloudFront frontend, RDS, S3 files, SSO |
| **Profiles** | `creator-dev` (`841162679642`), `creator-prod` (`250037328530`) |
| **Code** | `backend-v2/sst.config.ts`, `frontend-v2/sst.config.ts` |
| **Domains** | `api(.dev).thecreatorshop.in`, `dashboard(.dev).thecreatorshop.in` |

**Migration:** Root email + contacts per account; SSO user emails in Identity Center.  
**New account?** No — same accounts, identity change only.  
**SSO portal** (`growthverse.awsapps.com`): optional rename later; not a deploy step.

---

### Google Workspace

| | |
|--|--|
| **Role** | `@thecreatorshop.in` / `@growthverse.in` mailboxes |
| **DNS** | `thecreatorshop.in` NS → Wix; MX → Google |

**Migration:** Add domain, create mailboxes (`admin@`, `billing@`, devs), then use those for AWS/GitHub/vendor logins.  
**New account?** No — add secondary domain or promote primary.

---

### Wix

| | |
|--|--|
| **Role** | `thecreatorshop.in`, `www`, `growthverse.in` marketing sites |
| **Not** | App dashboard (that's AWS CloudFront) |

**Migration:** Wix account settings → change login/billing email to `@thecreatorshop.in`.  
**New account?** No — transfer ownership/email on existing site.  
**Later:** 301 `growthverse.in` → `thecreatorshop.in`.

---

### GitHub

| | |
|--|--|
| **Role** | Source repos; SST frontend autodeploy on push to `main` |
| **Code** | `frontend-v2/sst.config.ts` → `console.autodeploy` |

**Migration:** Per [github.md](./github.md) — add/verify `@thecreatorshop.in`, set primary, audit Actions secrets.  
**New account?** No. Consider **`thecreatorshop` org** for prod repo ownership (recommended, not required).  
**Check:** SST Console ↔ GitHub App still authorized after email change (usually unaffected).

---

## Payments & money

### Razorpay

| | |
|--|--|
| **Role** | Brand escrow (VBA, card top-up), subscription billing |
| **Env** | `RAZORPAY_API_KEY_ID`, `RAZORPAY_API_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| **Backend** | `brand-escrow`, `pricing` modules |
| **Webhooks** | `POST /api/v1/webhooks/escrow`, `POST /api/v1/webhooks/subscription` |
| **Frontend** | `VITE_RAZORPAY_KEY_ID` (public key only) |
| **Docs** | `docs/escrow/product-docs/razorpay-setup.md`, `docs/pricing/product-docs/Razorpay-setup.md` |

**Expected webhook URLs (already correct if v2 on same domains):**

| Stage | Escrow | Subscription |
|-------|--------|--------------|
| Dev | `https://api.dev.thecreatorshop.in/api/v1/webhooks/escrow` | `https://api.dev.thecreatorshop.in/api/v1/webhooks/subscription` |
| Prod | `https://api.thecreatorshop.in/api/v1/webhooks/escrow` | `https://api.thecreatorshop.in/api/v1/webhooks/subscription` |

**Migration:**

- [ ] Razorpay Dashboard → account email / authorized users → `@thecreatorshop.in`
- [ ] Confirm webhook URLs still match (domain already `thecreatorshop.in` — likely no URL change)
- [ ] **Do not rotate API keys** unless you want a hard cutover; keys are not email-bound
- [ ] KYC / business name on merchant account — update if legal entity is rebranding (may need Razorpay support)

**New account?** Only if Creator Shop is a **new legal entity** requiring separate merchant KYC. Otherwise update existing merchant account.

---

## Email & notifications

### Postmark

| | |
|--|--|
| **Role** | Brand/creator OTP, notification emails |
| **Env** | `POSTMARK_SERVER_TOKEN`, `POSTMARK_OTP_TEMPLATE_ID`, `POSTMARK_NOTIFICATION_FROM`, `POSTMARK_TEMPLATE_*` |
| **Default sender** | `no-reply@thecreatorshop.in` (already in code + `.env.example`) |
| **Backend** | `src/mail/`, `src/features/notifications/` |
| **Docs** | `docs/notifications/README.md` |

**Migration:**

- [ ] Postmark account login email → `@thecreatorshop.in`
- [ ] **Sender signature / domain:** confirm `thecreatorshop.in` (or `no-reply@thecreatorshop.in`) is verified in Postmark
- [ ] DKIM/SPF for sending domain — DNS is on **Wix** for `thecreatorshop.in`; add Postmark DNS records there if not already done
- [ ] API token (`POSTMARK_SERVER_TOKEN`) — **keep same** unless rotating on purpose
- [ ] Template IDs — unchanged

**New account?** No, unless deliverability/legal requires isolated Postmark server.

---

### Slack (customer-configured)

| | |
|--|--|
| **Role** | Optional brand notification channel |
| **Storage** | `brand_notification_settings.slack_webhook_url` per workspace |
| **Code** | `notification-channel.service.ts`, brand settings UI |

**Migration:** None at platform level — each brand owns their Slack incoming webhook.  
**New account?** N/A

---

## Social & auth

### Meta — Instagram / Facebook (creator onboarding)

| | |
|--|--|
| **Role** | Creator connects Instagram Business/Creator account |
| **Env** | `INSTAGRAM_API_ID`, `INSTAGRAM_APP_SECRET` |
| **Backend** | `src/features/instagram/` |
| **Frontend** | `src/shared/oauth/instagram-oauth.ts`, callback route `/creator/onboarding/instagram/callback` |
| **OAuth redirect** | `{APP_URL}/creator/onboarding/instagram/callback` (prod/dev dashboard origins) |

**Migration:**

- [ ] [Meta Developer Console](https://developers.facebook.com/) → app → **Roles** — add admins with `@thecreatorshop.in`
- [ ] Remove or demote old `@growthverse.in` admins when ready
- [ ] **Instagram → API setup → Valid OAuth Redirect URIs:**
  - `https://dashboard.dev.thecreatorshop.in/creator/onboarding/instagram/callback`
  - `https://dashboard.thecreatorshop.in/creator/onboarding/instagram/callback`
  - (plus any ngrok URL for local dev)
- [ ] App ID / secret — **keep same** unless creating new Meta app

**New account?** No. **New Meta app?** Only if old app is under a Growth Verse Business Manager you can't transfer.

**Note:** Product copy references "Meta Graph API" — uses Instagram OAuth scopes `instagram_business_basic`, `instagram_business_manage_insights`.

---

### Google — OAuth (creator signup)

| | |
|--|--|
| **Role** | "Continue with Google" for creators |
| **Env** | `GOOGLE_CLIENT_ID` (backend) |
| **Backend** | `src/features/auth/google-auth.service.ts`, `POST` google sign-in |
| **Frontend** | Signup UI shows Google button — **SDK not wired yet** (`signup-view.tsx`) |

**Migration (when enabled):**

- [ ] Google Cloud Console → OAuth client → authorized JavaScript origins + redirect URIs for `dashboard.*.thecreatorshop.in`
- [ ] OAuth consent screen → support email / developer contact → `@thecreatorshop.in`
- [ ] Project billing account contact

**New account?** No — update same GCP project.

---

## AI & data acquisition (brand onboarding)

### Google Gemini

| | |
|--|--|
| **Role** | Gatekeeper, brand DNA, co-pilot, industry classifier, MCP planner |
| **Env** | `GEMINI_API_KEY`, `GEMINI_MODEL`, `*_GEMINI_MODEL` variants |
| **Backend** | `integrations/gemini/`, `co-pilot/`, `brand-centre/`, surface-scan stage 2 |
| **Package** | `@google/genai`, `@google/generative-ai` |

**Migration:** Google AI Studio / GCP billing contact email → `@thecreatorshop.in`. API key unchanged.  
**New account?** No.

---

### Zyte

| | |
|--|--|
| **Role** | Homepage HTML fetch for brand surface scan (default acquisition path) |
| **Env** | `ZYTE_API_KEY`, `ZYTE_API_URL`, `BRAND_SCAN_ACQUISITION=zyte` |
| **Backend** | `stage1a/zyte-homepage.strategy.ts` |

**Migration:** Zyte dashboard login/billing email → `@thecreatorshop.in`. API key unchanged.

**Deploy gap to fix separately:** `ZYTE_API_KEY` is in `.env.example` but **not** listed in `sst.config.ts` `apiEnvironment`. If scans work on dev ECS, key may have been injected manually — add to SST on next deploy so it survives rotation.

**New account?** No.

---

### Parallel (legacy)

| | |
|--|--|
| **Role** | Legacy extract/search for surface scan |
| **Env** | `PARALLEL_API_KEY` (+ timeouts) — **in SST**; commented out in `.env.example` |
| **Status** | Disabled in local `.env.example`; code paths still present |

**Migration:** If still paying, update billing email. Otherwise ignore.  
**New account?** No.

---

### Playwright

| | |
|--|--|
| **Role** | Optional homepage scrape fallback |
| **Env** | `PLAYWRIGHT_ENABLED` — disabled in `.env.example` |
| **Runs in** | ECS container (if enabled) — no external SaaS account |

**Migration:** None.

---

## Storage & files

### AWS S3 (via SST)

| | |
|--|--|
| **Role** | Brand scan images, public file URLs |
| **Buckets** | `creatorshop-v2-files-{local,dev,prod}` |
| **Docs** | `docs/brand-onboarding/S3_ASSETS.md` |

**Migration:** None — tied to AWS account migration (identity only).  
**Legacy IAM user:** `s3-upload-user` exists in dev — audit if still needed.

---

## Frontend-only / deploy

### SST + Pulumi (not a vendor account)

| | |
|--|--|
| **Backend app** | `creatorshop-be` |
| **Frontend app** | `creatorshop-fe` |
| **Deploy** | `npx sst deploy --stage dev|prod` with `AWS_PROFILE` |

No separate SST "account email" migration beyond AWS/GitHub links.

---

### SST Console autodeploy

| | |
|--|--|
| **Config** | `frontend-v2/sst.config.ts` → `main` branch push → `dev` stage |
| **Requires** | GitHub repo connected in SST Console |

**Migration:** Confirm SST Console org email and GitHub integration after GitHub email change.

---

## Dev & design tools (non-production)

| Tool | Purpose | Migration |
|------|---------|-----------|
| **Stitch** | UI generation MCP (`stitch-cli.mjs`, `stitch.googleapis.com`) | Designer API key / Google login |
| **Gemini CLI + Stitch extension** | Local design workflow | `docs/mcp/stitch-mcp.md` — personal Google Cloud project |
| **ngrok** | Local Instagram OAuth / Razorpay webhooks | Personal account; no company migration |
| **Docker Compose** | Local Postgres | None |

---

## Environment variable checklist (secrets audit)

When migrating, **rotate only if compromised or moving to new vendor account**. Otherwise keep keys and update dashboard emails.

### Backend (`creator-commerce-backend-v2/.env` → SST deploy)

| Variable | Service |
|----------|---------|
| `POSTMARK_SERVER_TOKEN` | Postmark |
| `POSTMARK_*_TEMPLATE_ID` | Postmark |
| `RAZORPAY_API_KEY_ID` / `SECRET` / `WEBHOOK_SECRET` | Razorpay |
| `INSTAGRAM_API_ID` / `INSTAGRAM_APP_SECRET` | Meta |
| `GOOGLE_CLIENT_ID` | Google OAuth |
| `GEMINI_API_KEY` | Google Gemini |
| `ZYTE_API_KEY` | Zyte |
| `PARALLEL_API_KEY` | Parallel (legacy) |
| `JWT_SECRET_DEV` / `JWT_SECRET_PROD` | Internal — no vendor |
| `SETTINGS_FIELD_ENCRYPTION_KEY` | Internal — no vendor |
| `DEV_DATABASE_URL` | AWS RDS — no vendor |

### Frontend (`creator-commerce-frontend-v2/.env` → SST build)

| Variable | Service |
|----------|---------|
| `VITE_RAZORPAY_KEY_ID` | Razorpay (public) |
| `VITE_API_URL` | Set by SST per stage |
| `VITE_PUBLIC_APP_URL` | OAuth helper (ngrok local) |

---

## Suggested migration order (vendors)

1. **Google Workspace** — mailboxes exist before anything else
2. **Postmark** — verify `thecreatorshop.in` sender + account email
3. **Razorpay** — merchant account email + webhook smoke test
4. **Meta Developer** — admin emails + OAuth redirect URIs
5. **Google Cloud / Gemini** — billing + OAuth consent (when Google signup ships)
6. **Zyte** — billing email; add `ZYTE_API_KEY` to `sst.config.ts` if missing
7. **Wix** — account email + DNS for Postmark if needed
8. **GitHub** — primary email + SST Console link check

---

## When you *would* create new accounts

Only consider **new** vendor accounts if:

- Creator Shop is a **new legal entity** (Razorpay KYC, bank account, GST)
- Old Meta app / Business Manager cannot be transferred from Growth Verse
- Compliance requires isolated Postmark server or AWS org

Otherwise: **same accounts, new emails, dashboard housekeeping.**
