# Brand verification OTP — local hardcoded bypass

Step 6 email OTP has a real Postmark implementation (`sendOtpReal` /
`verifyOtpReal`) left in the service, but **local UI testing currently uses a
hardcoded `123456`**. There is **no env flag**.

## Current mode (local testing)

| Layer | What happens |
|-------|----------------|
| Frontend | `USE_REAL_BRAND_VERIFICATION_OTP = false` in `verification-otp.config.ts`. Send/resend stay in the browser. Code is `123456`. |
| Backend | `sendOtp` / `verifyOtp` call `sendOtpLocal` / `verifyOtpLocal`. No Postmark. Verify accepts only `123456`. |
| Shared `/login` and Creator Entry | Unchanged. Real random OTP + `[OTP]` log + Postmark attempt. |

Work email must still match the scanned website domain.

## Restore real OTP before production

1. Frontend `verification-otp.config.ts`: `USE_REAL_BRAND_VERIFICATION_OTP = true` and delete `STUB_OTP_CODE`.
2. Backend `brand-verification.service.ts`: point `sendOtp` / `verifyOtp` at `sendOtpReal` / `verifyOtpReal` and delete `BRAND_ONBOARDING_LOCAL_OTP`.
3. Restart API + rebuild frontend.
4. Confirm Postmark + off-prod `[OTP] purpose=BRAND_VERIFICATION` logs.

## APIs (unchanged)

- `POST /api/v1/brand/profiles/:brandProfileId/verification/send`
- `POST /api/v1/brand/profiles/:brandProfileId/verification/verify`
