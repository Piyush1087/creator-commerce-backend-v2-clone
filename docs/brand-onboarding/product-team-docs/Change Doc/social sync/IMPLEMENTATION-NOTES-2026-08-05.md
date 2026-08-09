# Implementation notes — Onboarding password + Instagram sync (2026-08-05)

## Locked product decisions

1. Password stored on **`User.hashedPassword`** (scrypt), not `BrandProfile.accountPasswordHash`.
2. **`BrandProfile.isVerified`** flips only **after** the password gate (OTP/Google only set `identityConfirmedAt` + `verificationEmail`).
3. **No Meta Business Suite during onboarding** — Instagram Login only. Meta Suite remains available later in **Settings → Integrations**.
4. Migrations via **`npm run db:migrate:deploy`** + **`npm run prisma:generate`** (no shadow DB / `migrate dev`).
   - `prisma:generate` succeeded locally.
   - `db:migrate:deploy` blocked on 2026-08-05 with `P1001` (Postgres not reachable at `localhost:5432`). Re-run when Docker/DB is up.

## Frontend UI status (placeholders)

There is **no Stitch / design reference** for the new password gate, Instagram social sync, invitee OTP/complete screens, or the Settings integrations case matrix.

FE screens were built as **Aurora placeholders** matching existing brand-onboarding (`bob-verify`) and settings shells:

| Screen | Route | Notes |
|--------|-------|--------|
| Password after OTP | `/brand/onboarding/verification` | Wired to BE password endpoint |
| Google verify CTA | same | **Disabled placeholder** until GIS SDK is wired |
| Instagram social sync | `/brand/onboarding/social-sync` | Opens IG OAuth URL; callback exchange TBD |
| Invitee OTP gate | `/brand/onboarding/sync-verify` | Placeholder Aurora card |
| Invitee complete | `/brand/onboarding/sync-complete` | Placeholder Aurora card |
| Settings integrations | `/brand/settings/integrations` | Case layout from API; Meta connect CTA placeholder |

Replace placeholders when Stitch/final UI arrives; keep API contracts stable.

## Backend endpoints added

- `POST /api/v1/brand/profiles/:id/verification/google`
- `POST /api/v1/brand/profiles/:id/verification/password`
- `GET/POST /api/v1/brand/social-sync/*` (oauth-url, connect, skip, invite, invite OTP/connect)
- `GET /api/v1/brand/settings/integrations`
- `GET /api/v1/brand/settings/integrations/instagram/oauth-url`
- `POST /api/v1/brand/settings/integrations/instagram/connect`
- `POST /api/v1/brand/settings/integrations/resolve-identity-conflict`
- `POST /api/v1/brand/settings/integrations/manage`

## Follow-ups landed 2026-08-05 (pass 2)

- Google Path B FE wired via GIS (`VITE_GOOGLE_CLIENT_ID`) → `verification/google` → password step
- Instagram connect inspects granted permissions → `PARTIALLY_CONNECTED` (Case 1) vs `CONNECTED` (Case 2)
- Settings identity-conflict overwrite/cancel API + modal
- Active `UceCampaign` (`ACTIVE`) blocks disconnect/delete
- Midnight cron marks expired tokens `TOKEN_EXPIRED` (per-row error isolation)
- Social-sync skip confirmation modal per UI copy doc
- Delete ingested data still token-only (analytics stores later)

## Schema

Migration: `prisma/migrations/20260805090000_brand_password_and_integrations`

- `brand_profiles.identity_confirmed_at`, `social_sync_skipped`
- `brand_integrations`
- `instagram_sync_invitations`
