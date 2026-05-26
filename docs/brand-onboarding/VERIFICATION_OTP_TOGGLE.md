# Brand verification OTP — pre-prod stub vs production

Step 6 email OTP is **implemented** (Postmark + `VerificationCode` + APIs) but **disabled by default** so staging/demo can use a fixed code without mail delivery.

## Current mode (pre-prod)

| Layer | Switch | Value now |
|-------|--------|-----------|
| Frontend | `USE_REAL_BRAND_VERIFICATION_OTP` in `creator-commerce-frontend-v2/src/features/brand-onboarding/verification-otp.config.ts` | `false` |
| Backend | `BRAND_VERIFICATION_USE_REAL_OTP` in `.env` | unset or not `true` |
| Test code | — | **`123456`** |

**Frontend (stub):** Send OTP does not call the API; verify checks `123456` locally, then calls verify API so `BrandProfile.isVerified` is still set.

**Backend (stub):** Send returns success without Postmark/DB code rows. Verify accepts only `123456` and sets `isVerified` / `verificationEmail`.

## Enable real OTP for production

1. **Frontend** — `verification-otp.config.ts`:
   ```ts
   export const USE_REAL_BRAND_VERIFICATION_OTP = true;
   ```
2. **Backend** — `.env` (deploy secrets, never commit values):
   ```env
   BRAND_VERIFICATION_USE_REAL_OTP=true
   POSTMARK_SERVER_TOKEN=...
   POSTMARK_OTP_TEMPLATE_ID=...
   ```
3. Restart API + rebuild frontend.
4. Confirm Postmark logs: cyan SEND → green SEND OK (or yellow inactive — OTP still in `BrandVerificationService` log).
5. Remove or ignore stub code paths; real logic lives in `sendOtpReal` / `verifyOtpReal` in `brand-verification.service.ts` (not deleted).

## APIs (unchanged when real mode is on)

- `POST /api/v1/brand/profiles/:brandProfileId/verification/send` — body `{ "email": "..." }`
- `POST /api/v1/brand/profiles/:brandProfileId/verification/verify` — body `{ "email": "...", "otp": "######" }`

Product copy/rules: `docs/product-team-docs/brand-onboarding/step-8.md` (Step 6 verification UI).

## Changelog

| Date | Note |
|------|------|
| 2026-05-25 | Real OTP shipped; stub `123456` default for pre-prod; toggle doc added |
