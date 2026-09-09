# 12 — Frontend ↔ backend smoke

**Date:** 2026-09-08  
**Run:** RUN 4  
**App:** Vite `http://localhost:5173/` proxying `/api` to Nest `http://127.0.0.1:3000`  
**Database:** disposable `freeze_mvp_canonical_v1` (87/87). `thecreatorshop` not migrated.

OTP codes were read from the local Nest non-prod log and **must not** be committed.

## Seed

| Script | Result | Classification |
| --- | --- | --- |
| `npm run db:seed:dev-c03-opportunity` | PASS. Creator `c03-smoke@creator.com`, Brand `c03-smoke@brand.com`, LIVE campaign fixture | Used for login smoke |
| `npm run db:seed:dev-creator` | User `test@creator.com` created earlier as `PROVISIONAL` without a Creator organization | Cannot receive LOGIN OTP (`eligible` requires `ACTIVE`). C-01 trigger `C01_ACTIVE_CREATOR_ORGANIZATION_REQUIRED` if activated without org. **Not** used for this smoke |
| `npm run db:seed:dev-collaboration` | TypeScript compile fail vs current Prisma | `STALE_TEST_PROVEN` |

Local Postmark send failed; OTP issue still succeeded off-prod (code logged, then “Postmark send failed”).

## Unauthenticated (RUN 3 remainder + RUN 4)

| Path | Observed |
| --- | --- |
| `/login` | Sign in |
| `/marketplace` | “This entry is unavailable. Open a Campaign link provided by the Brand.” |
| `/creator/home`, `/brand/dashboard` | Redirect to `/login` |

## Creator (OTP, `c03-smoke@creator.com`)

| Path / action | Observed |
| --- | --- |
| Email-code login | PASS |
| Immediate post-login | `/brand/dashboard` because an earlier unauthenticated visit left `from=/brand/dashboard`. `resolvePostLoginPath` preserves `/brand/` return values for Creator. Brand Home fail-closed: “Brand Centre is available to active brand users only” |
| `/creator/home` | Deferred C-05 entry: “Creator Home is deferred”. Signed in as `c03-smoke@creator.com`. Nav: Home, Campaigns, Collaborations, Settings |
| `/creator/campaigns` | Redirects to `/creator/campaigns/opportunities`. Lists **C-03 Local Smoke Opportunity** |
| `/creator/settings` | `/creator/settings/account`. Email code Active |
| `/creator/centre` | Redirects to `/creator/home` |
| `/creator/payouts` | Redirects to `/creator/settings/payouts` (C-05 store-only copy) |
| `/marketplace` | Still unavailable |

## Brand (OTP, `c03-smoke@brand.com`)

| Path / action | Observed |
| --- | --- |
| Email-code login from `/login` | PASS → `/brand/dashboard` |
| Brand Home | Loaded for **C-03 Smoke Brand**. Needs Attention (subscription access), momentum for the LIVE C-03 campaign. Nav: Home, Brand Centre, Campaigns, Brand page, Collaborations, Settings, Support |
| Campaigns nav | `/brand/uce/campaigns` “Your Campaigns” |
| Brand Centre nav | `/brand-centre` Brand workspace. Overview/Market/Recommendations unavailable (expected for this fixture) |
| Guessed `/brand/campaigns` | Unmatched “Brand page not found” — **not** the Campaigns nav target |
| `/creator/home` as Brand | `/creator/onboarding` — “Brand account cannot enter Creator setup” |
| `/marketplace` | Unavailable |

## Shell hide

No Marketplace, Creator Centre, Co-Pilot, or old payout hub in authenticated nav for either role.

## Not claimed

Provider-unavailable recovery, full apply/handoff click-through.

Viewport matrix is in `16-viewport-smoke.md` (RUN 5 remainder). RBAC postgres isolation is in `13-postgres-invariants.md`.
