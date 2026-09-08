# Local UI verification (C-01 + C-05)

Origin branch `feature/c01-c05-creator-integration` in both repos.
Do **not** use production, AWS, live Meta, or KYC/payout execution.

Typecheck and production build are already VERIFIED. This packet is the
remaining product click-through. Mark each row PASS / FAIL / BLOCKED in chat
or by editing this file.

## Setup

1. Backend and frontend v2 running locally against the disposable Postgres
   already at **82** migrations.
2. Browser: desktop (~1440) and one 390px pass for the screens you touch.
3. Login: email OTP. Non-prod still logs `[OTP]`. Operator 2026-09-03: Creator
   Postmark delivery also worked (v1 `POSTMARK_OTP_TEMPLATE_ID`). Brand Step 6
   still uses local hardcoded `123456` (not Postmark).

Platform entry (`/creator/home`, Campaigns, Collaborations, Creator Center,
product Payouts) requires a **connected, usable Instagram** identity. Creator
Settings stays reachable without that.

### Instagram: wired in code, live Meta not this packet

The Connect Instagram button is real: frontend calls
`POST /api/v1/creator-entry/instagram/authorize`, backend builds the Meta URL
(state + redirect owned by the server). It is **not** a mock.

Origin audit still marks **LIVE_META_OAUTH** as BLOCKED. Clone handoff:

```text
LIVE_META_OAUTH_E2E = NOT_EXECUTED_NO_AUTHORIZED_TEST_IDENTITY
```

Localhost cannot complete a real Instagram login as-is. Backend only accepts:

- `https://dashboard.dev.thecreatorshop.in/creator-marketplace/callback`
- `https://dashboard.thecreatorshop.in/creator-marketplace/callback`

`http://localhost:…/creator-marketplace/callback` is rejected
(`CREATOR_INSTAGRAM_REDIRECT_URI_INVALID`). You also need real
`INSTAGRAM_API_ID` / `INSTAGRAM_APP_SECRET` (not `replace-me`) and a
Professional Instagram account in a Meta app that already has one of those
HTTPS callbacks.

Handoff does **not** say “never click Connect locally.” It says live Meta cannot
be certified from mocked C-01 tests, and the only registered callbacks are the
deployed HTTPS dashboards. C-01 §17 production smoke (connect + callback +
platform entry) is **after** separately authorized deploy. C-05 live Instagram
Settings is the same: `INSTAGRAM_API_ID` / secret are for separately authorized
live behavior. Origin audit: `LIVE_META_OAUTH` BLOCKED.

For local C-01 UI: stop at Connect Instagram (`NOT_CONNECTED` / `UNKNOWN`).
C01-IG stays **BLOCKED on localhost**. Try Connect on
**`https://dashboard.dev.thecreatorshop.in`** (or prod) once that runtime has
this code, the Meta app, and `CREATOR_INSTAGRAM_REDIRECT_URI`. Do not add
localhost to the allowlist without Meta release authority.

---

## C-01 — Creator Entry

Use a logged-out window first.

| # | Do this | Expect |
|---|---------|--------|
| C01-1 | Open `/creator/onboarding` logged out | Creator Entry, not the old waitlist / handle pre-check / skip-Instagram path |
| C01-2 | Sign up with a **new** email (password or OTP) | Verification works; you stay on Entry, not Brand onboarding |
| C01-3 | While incomplete, open `/creator/home` and `/creator/campaigns` | Redirect back to `/creator/onboarding`. Do **not** land in the authenticated Creator shell |
| C01-4 | Open `/creator/settings/account` while incomplete | Account & Security still loads (Settings is outside the C-01 platform guard) |
| C01-5 | Open `/login`, then a protected Brand URL such as `/brand/settings?tab=security` in another tab first if you prefer | After Brand login, return stays on Brand settings (query/hash preserved). After Creator login, you must not be dumped onto a random external URL |
| C01-6 | Open public `/marketplace` logged out | Guest marketplace still works. Completing login from a non-invite marketplace URL should send a Creator to `/creator/campaigns`, not Marketplace nav |
| C01-7 | From a public campaign, click Apply as a guest | You are sent into Entry. No Application / collaboration is created until an authenticated Creator explicitly Applies after Entry |
| C01-8 | 390px on `/creator/onboarding` | Stacks; primary CTA full width; no page-level horizontal scroll |
| C01-9 | Brand regression: `/login` as a Brand | Brand dashboard / Brand Centre still work. Creator Entry must not appear |

**Skip unless local Meta is configured**

| # | Do this | Expect |
|---|---------|--------|
| C01-IG | Connect Professional Instagram on Entry, land on `/creator-marketplace/callback`, then `/creator/home` | Callback query is scrubbed; you can enter the Creator shell. Reconnect same account later from Settings. Different Instagram account is blocked |

---

## C-05 — Creator Settings + shell

Needs a Creator who **can enter the platform** for nav (C05-1…C05-4). If
Instagram is not connected, skip those and still run Settings (C05-5…).

| # | Do this | Expect |
|---|---------|--------|
| C05-1 | Log in as a complete Creator | Sidebar is exactly **Home / Campaigns / Collaborations / Creator Center / Payouts / Settings**. No Marketplace, Insights, or Profile nav items |
| C05-2 | 390px footer | Exactly **Home / Campaigns / Collaborations / Creator Center** |
| C05-3 | Click each sidebar item | Each route loads. Creator Center is Centre, not frozen as Media Kit. Marketplace is not advertised on Home |
| C05-4 | Logout from the shell | Session ends; refresh does not restore Creator pages |
| C05-5 | `/creator/settings` | Redirects to `/creator/settings/account` |
| C05-6 | Settings nav | **Account & Security**, **Profile & Contact**, **Team**, **Instagram**, **Payouts & Legal**. No Notifications |
| C05-7 | `/creator/settings/social` | Redirects to `/creator/settings/instagram` |
| C05-8 | Account & Security | Shared password / email flows still work for this Creator |
| C05-9 | Profile & Contact | Load and save display name / phone without a full-page reload |
| C05-10 | Team | Invite drawer opens (Aurora **aside**, not a `dialog` role). Owner cannot be demoted. Cap is five seats |
| C05-11 | Instagram Settings | Page loads a lifecycle state (not connected / connected / recovery). Do not require live reconnect |
| C05-12 | Payouts & Legal | Destination and legal-profile drawers open. No PAN/KYC capture. Do not execute a payout |
| C05-13 | Brand Settings regression | Brand login → `/brand/settings` still has General / Integrations / Billing / Escrow |

**Assistant vs Owner (only if you have a second Creator seat)**

| # | Do this | Expect |
|---|---------|--------|
| C05-R | Accept a Team invite as Assistant | Assistant cannot open Team / Instagram / Payouts & Legal actions. Account & Security remains usable |

---

## Session 2026-09-03 (operator)

Local C-01 UI is **done**. C-05 Creator shell stays blocked without Instagram.

| # | Result | Notes |
|---|--------|-------|
| C01-1 | PASS | `/creator/onboarding` is Entry |
| C01-2 | PASS | `test1@creator.com` OTP. Postmark mail **worked** (not log-only) |
| C01-3 | PASS | Home bounce while `NOT_CONNECTED` |
| C01-4 | PASS | `/creator/settings/account` opens properly |
| C01-5 | PASS | Login return to Brand settings |
| C01-6 | PASS | Guest marketplace opens |
| C01-7 | SKIPPED | UCE create not end-to-end (`strategy: {}`); no public LIVE campaign |
| C01-8 | PASS | 390px readable |
| C01-9 | PASS | Brand onboarded with local `123456`; Brand Settings General / Integrations / Billing / Escrow |
| C01-logout | PASS | Logout works |
| C01-IG | BLOCKED | localhost callback not allowlisted. Live connect = deployed dashboard after Meta/deploy authority |
| C05-1…C05-4 | BLOCKED | needs usable Instagram / `canEnterCreatorPlatform` |
| C05-5 | PASS | Creator Settings opens |
| C05-6…C05-12 | SKIPPED | shell/product Settings beyond Account not fully walked as a complete Creator |
| C05-13 | PASS | same Brand Settings walk as C01-9 |

---

---

## C-03 — Campaign Participation / Apply (local smoke)

Branch: BE/FE `integration/c03-campaign-participation`.  
Do **not** use production, AWS, live Meta, or KYC/payout execution.

Mark each row **PASS / FAIL / BLOCKED / SKIPPED** in chat or below when you run it.

### A. Local servers (exact)

**Terminal 1 — backend** (`d:\Work\cursor-repos\creator-commerce-backend-v2`):

1. Ensure disposable Postgres is up (`creatorshop-postgres-v2`) and your local `.env` `DATABASE_URL` points at a migrated local DB (not AWS).
2. Run:

```powershell
npm run start:dev
```

3. Wait until Nest is listening (default **http://localhost:3000**).

**Terminal 2 — frontend** (`d:\Work\cursor-repos\creator-commerce-frontend-v2`):

1. `.env` / `.env.local` should resolve API to local BE (example from `.env.example`: `VITE_API_URL=http://localhost:3000`).
2. Run:

```powershell
npm run dev
```

3. Open the Vite URL (usually **http://localhost:5173**).

**Browser:** one desktop pass (~1440) and one **390px** pass on the screens you touch.

### B. Accounts and data you need before C03 rows

| Need | How |
|------|-----|
| Local C-03 smoke seed (recommended) | From BE root with localhost `DATABASE_URL`: `npm run db:seed:dev-c03-opportunity` → Creator `c03-smoke@creator.com`, Brand `c03-smoke@brand.com`, campaign id `22222222-2222-4222-8222-222222222203` |
| Brand account that can create/publish UCE campaigns | Same as prior C-01 Brand smoke (`/login` as Brand), **or** use seeded Brand above |
| At least one **LIVE** campaign with a **PUBLISHED** Brief visible to Creator | Seed creates `ELIGIBLE_ONLY` LIVE + Brief. Without seed: create via Brand UCE `/brand/uce/campaigns` |
| Creator who can open Campaigns | Seed creates workspace Owner + usable Instagram stub. Login via OTP (`[OTP]` in BE log) |

**Note:** Opportunities list only shows campaigns the Creator is entitled to (ELIGIBLE_ONLY / invited / prior ingress). A random LIVE EVERYONE campaign may stay empty until you visit `/campaigns/<id>` once while logged in.

### C. Exact smoke rows

#### Guest / public (no Creator platform required)

| # | Exact steps | Expect |
|---|-------------|--------|
| C03-G1 | Logged out → open `/marketplace` | Guest marketplace loads (no crash) |
| C03-G2 | From marketplace (or paste) open a real campaign: `/marketplace/<campaignId>` **or** `/campaigns/<campaignId>` | Public Campaign opportunity entry loads campaign name; guest sees Sign in / create Creator CTAs (not a Brand Apply form that creates an Application) |
| C03-G3 | On that public page, click through toward Apply as guest → Sign in / create account | Lands on `/login` (or Entry) with return intent toward `/campaigns/<campaignId>`. **No** Application row is created while still a guest |
| C03-G4 | 390px on `/campaigns/<campaignId>` | Stacks; primary CTAs usable; no page-level horizontal scroll |

#### Authenticated Creator (needs platform-ready Creator)

Use a **Creator** session that reaches `/creator/home` successfully (Instagram usable).

| # | Exact steps | Expect |
|---|-------------|--------|
| C03-1 | Login as Creator → open `/creator/campaigns` | Redirects to `/creator/campaigns/opportunities` |
| C03-2 | On Opportunities, click **Refresh** | List loads (may be empty). No auth error. If empty but Brand published a LIVE eligible campaign for this Creator, investigate entitlement — else empty is OK until data exists |
| C03-3 | Open `/creator/campaigns/opportunities/<campaignId>` for a LIVE eligible campaign | Opportunity dossier: brand, briefs, **Apply to this Brief** / **Apply to Campaign** when `AVAILABLE` |
| C03-4 | Click **Apply to this Brief** (or Apply to Campaign) → complete required fields in the Apply overlay → submit once | Success path: Application created; navigate/link to Application detail under `/creator/campaigns/applications/<applicationId>` with status **PENDING** |
| C03-5 | Hard-refresh Application detail; confirm snapshot fields (campaign/brief/commercial) still present | Immutable snapshot copy remains; status still PENDING |
| C03-6 | Click **Download Creator Brief Pack** (or equivalent Brief Pack control) | PDF downloads (`creator-shop-brief-pack-…pdf`); status text progresses then success |
| C03-7 | Open `/creator/campaigns/applications` | List shows the Application; open it again from the list |
| C03-8 | On PENDING Application, as Owner with withdraw permission: open **Withdraw** → confirm in drawer → submit | Status becomes **WITHDRAWN** (or terminal withdrawn); withdraw CTA no longer available |
| C03-9 | 390px on Opportunities list + Application detail | Stacks; drawers/sheets usable; no page-level horizontal scroll |

#### Brand / handoff (optional if you have Brand + remaining PENDING Application)

| # | Exact steps | Expect |
|---|-------------|--------|
| C03-B1 | Brand login → open applicants / UCE campaign applicants for that campaign (Brand UCE detail `/brand/uce/campaigns/<id>`) | See Creator Application |
| C03-B2 | Approve Application (Brand decision) | Creator side shows terminal **APPROVED**; Collaboration appears under `/creator/collaborations` (handoff). If Brand UI for decide is missing locally, mark **BLOCKED** with note |

#### Explicitly out of this local packet

| # | Item | Status |
|---|------|--------|
| C03-IG | Live Meta Instagram connect on localhost | **BLOCKED** (same as C01-IG) |
| C03-INV | Invite-only token deep link `/marketplace/invite/<token>` | Only if you issued a real invitation; otherwise **SKIPPED** |
| C03-AWS | Prod/AWS deploy smoke | **Not authorized** |

### D. Session results (operator 2026-09-08)

Local seed: `npm run db:seed:dev-c03-opportunity` (`c03-smoke@creator.com`, campaign `22222222-2222-4222-8222-222222222203`).

| # | Result | Notes |
|---|--------|-------|
| C03-G1 | | not required this session |
| C03-G2 | | not required this session |
| C03-G3 | | not required this session |
| C03-G4 | | not required this session |
| C03-1 | PASS | Opportunities reachable |
| C03-2 | PASS | Seeded campaign listed after Refresh |
| C03-3 | PASS | Opportunity dossier |
| C03-4 | PASS | Apply → PENDING Application |
| C03-5 | PASS | Snapshot persists |
| C03-6 | PASS | Brief Pack download |
| C03-7 | PASS | Applications list |
| C03-8 | PASS | Withdraw (or covered in flow) |
| C03-9 | | not separately noted |
| C03-B1 | | not run |
| C03-B2 | | not run |

Operator confirmation: **all ok** (2026-09-08).
