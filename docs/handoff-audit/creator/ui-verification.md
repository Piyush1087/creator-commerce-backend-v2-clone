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

## Do not treat as this packet

- Wiring `CreatorPlatformAccessGuard` onto Centre / Co-Pilot / Payouts / UCE
  (parked on origin)
- Clone vitest `getByRole("dialog")` vs Aurora SideDrawer
- Production migrate, AWS bootstrap, live payout/KYC
