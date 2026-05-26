# Brand auth (MVP)

Separate Nest module: `src/features/auth/` (same pattern as `src/mail/` and brand-onboarding).

## Flow

1. Anonymous onboarding (`sessionStorage`: `leadId`, `brandProfileId`, `normalizedUrl`).
2. Step 6 OTP → `BrandProfile.isVerified` + `verificationEmail`.
3. Pricing → `POST /api/v1/auth/brand/complete-registration` (email from verified profile only) → `Organization` + `User` (BRAND) + `BrandProfile.organizationId` → JWT in `localStorage`.
4. Social sync (optional Meta UI) with JWT available for future APIs.
5. Skip → `/brand/dashboard` (requires JWT).

## Deferred

- **Plan assignment** at org level (free trial / professional / enterprise enums exist on `BrandProfile`; defaults remain `FREE_TRIAL` + `TRIALING`).
- Influencer auth, invitations, password auth, refresh tokens.
- Duplicate-email edge cases on re-registration (returns JWT if user already exists).

## User fields

- `name`: email local-part (before `@`) at registration.

## Login (placeholder)

- `POST /api/v1/auth/login` with `email` + `otp` (stub **`123456`** only, same as brand verification pre-prod).

## org_claimed

Discovery still returns `org_claimed` for early funnel blocking (modal only). Complete-registration also rejects if another verified profile on the domain already has an org + user.

## JWT configuration

- **Expiry:** `24h` in `src/features/auth/auth-jwt.config.ts`.
- **Secrets:** `JWT_SECRET_DEV` and `JWT_SECRET_PROD` in `.env` (placeholders for now). Local/dev use dev; prod uses prod. `sst.config.ts` maps the right one to `JWT_SECRET` on deploy.

## Frontend

- Token key: `ccs.auth.v1` in `localStorage`.
- Routes: `/login`, `/brand/dashboard`.
- Logout clears token and navigates to `/`.
