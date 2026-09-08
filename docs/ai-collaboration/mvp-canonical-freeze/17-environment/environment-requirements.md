# Environment / configuration manifest (§17)

Names only. Never commit secret values.  
**Sources:** backend `.env.example`, frontend `.env.example`, `sst.config.ts` comments in those files.  
**Date:** 2026-09-08

## Frontend (Vite build + runtime)

| Name | Owner | Required? | Dev vs prod | Absent behavior | Secret store |
| --- | --- | --- | --- | --- | --- |
| `VITE_API_URL` | FE | optional local | unset → Vite `/api` proxy | CORS if API on another host | build-time |
| `VITE_STAGE` | FE | recommended | `local` in example | stage labels | build-time |
| `VITE_GOOGLE_CLIENT_ID` | FE | if Google login | same Web client as BE | Google path unavailable | build-time |
| `VITE_GOOGLE_MAPS_API_KEY` | FE | if campaign geo | restrict to origins | geo picker fails | build-time |
| `VITE_RAZORPAY_KEY_ID` | FE | if escrow top-up UI | test vs live key | escrow card fails closed | build-time |
| `VITE_PUBLIC_APP_URL` | FE | optional | ngrok for Meta localhost | Instagram OAuth may reject localhost | build-time |

## Backend required for any boot

| Name | Owner | Required? | Dev vs prod | Absent behavior | Secret store |
| --- | --- | --- | --- | --- | --- |
| `PORT` | BE | optional | default 3000 | bind default | runtime |
| `STAGE` | BE | required for fail-closed | `local` / `dev` / `prod` | OTP logging and quota depend on this | runtime |
| `DATABASE_URL` | BE | required | local vs RDS | will not boot usefully | secret store |
| `JWT_SECRET` or `JWT_SECRET_DEV`/`JWT_SECRET_PROD` | BE | required | SST maps suffixed → ECS unsuffixed | auth broken | secret store |
| `JWT_ISSUER` `JWT_AUDIENCE` `JWT_ACCESS_TTL` `AUTH_REFRESH_TTL` | BE | required | | | runtime |
| `AUTH_OTP_TTL` `AUTH_RESET_TTL` | BE | required | | | runtime |
| `AUTH_OTP_PEPPER` or `_DEV`/`_PROD` | BE | required | SST maps | OTP verify broken | secret store |
| `SETTINGS_FIELD_ENCRYPTION_KEY` | BE | required | 32-byte base64 | token/settings encrypt broken | secret store |

## Backend mail / URLs

| Name | Owner | Required? | Notes |
| --- | --- | --- | --- |
| `POSTMARK_SERVER_TOKEN` | BE | required for real email | |
| `POSTMARK_OTP_TEMPLATE_ID` / `POSTMARK_AUTH_OTP_TEMPLATE_ID` | BE | required for OTP mail | AUTH optional override |
| `POSTMARK_PASSWORD_RESET_TEMPLATE_ID` `POSTMARK_TEAM_INVITE_TEMPLATE_ID` | BE | required for those flows | |
| `POSTMARK_AUTH_FROM` `POSTMARK_NOTIFICATION_FROM` | BE | recommended | example uses `no-reply@thecreatorshop.in` |
| `POSTMARK_NOTIFICATION_DEFAULT_TEMPLATE_ID` | BE | required for notification mail | |
| `APP_FRONTEND_URL` | BE | required local | SST uses `_DEV`/`_PROD` |
| `PUBLIC_API_BASE_URL` | BE | required deployed | Meta deletion status URLs |
| `CORS_ORIGINS` | BE | optional | extra origins |

## Gatekeeper / intelligence / DE

| Name | Owner | Required? | Notes |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` `GEMINI_MODEL` `GATEKEEPER_GEMINI_MODEL` `MCP_PLANNER_GEMINI_MODEL` `BRAND_DNA_GEMINI_MODEL` | BE | required for those features | |
| `OPENAI_API_KEY` `GATEKEEPER_OPENAI_MODEL_ID` | BE | optional depending on model path | |
| `GATEKEEPER_TERMS_VERSION` `GATEKEEPER_PRIVACY_POLICY_VERSION` | BE | required on deploy | admission fails if missing in container |
| `GATEKEEPER_SUPPORT_URL` | BE | recommended | `GET /api/v1/discovery/support` |
| `ZYTE_API_KEY` `ZYTE_API_URL` `BRAND_SCAN_ACQUISITION` | BE | required for scan | |
| `PLAYWRIGHT_ENABLED` `PLAYWRIGHT_TIMEOUT_MS` `PLAYWRIGHT_FORCE_OFF` | BE | ECS usually on | |
| `PARALLEL_API_KEY` | BE | if Parallel used | |
| `DATA_EXTRACTION_*` `OFFERING_PRICE_REFRESH_*` | BE | DE / PI | |

## Instagram / C-03 / money

| Name | Owner | Required? | Notes |
| --- | --- | --- | --- |
| `INSTAGRAM_API_ID` `INSTAGRAM_APP_SECRET` `CREATOR_INSTAGRAM_REDIRECT_URI` | BE | required for connect | exact callback URI |
| `GOOGLE_CLIENT_ID` | BE | if Google | |
| `C03_INVITATION_IDENTITY_HMAC_PEPPER` (+ `_DEV`/`_PROD`) | BE | required for HMAC invitation identity | ≥32 bytes; never reuse another secret |
| `RAZORPAY_API_KEY_ID` `RAZORPAY_API_KEY_SECRET` `RAZORPAY_WEBHOOK_SECRET` | BE | required for live escrow | |
| `RAZORPAY_ROUTE_WEBHOOK_SECRET` `RAZORPAY_BRAND_RETURN_WEBHOOK_SECRET` | BE | optional until those products | route remains disabled until entitlement |
| `S3_BUCKET_NAME` `AWS_REGION` | BE | required for uploads | SST injects deployed |
| `CREATOR_APPLY_BYPASS_EMAILS` | BE | must be empty in production | QA targeting bypass |
| `NOTIFICATIONS_DEV_EMIT_ENABLED` | BE | local only | |

## Never on deploy

| Name | Rule |
| --- | --- |
| `CREATOR_VERIFICATION_USE_REAL_OTP` | Local-only; forbidden in SST / `.env.example` body (comment only) |
| `BRAND_VERIFICATION_USE_REAL_OTP` | Same |

## Health / ports

```text
Backend default PORT = 3000
Health live          = GET /health/live
Health ready         = GET /health   (Prisma SELECT 1)
Frontend Vite local  = 5173 (APP_FRONTEND_URL example)
```

Callback/domain assumptions (names only):

```text
APP_FRONTEND_URL_DEV  ~ https://dashboard.dev.thecreatorshop.in
APP_FRONTEND_URL_PROD ~ https://dashboard.thecreatorshop.in
CREATOR_INSTAGRAM_REDIRECT_URI example ~ https://dashboard.dev.thecreatorshop.in/creator-marketplace/callback
```

The AWS worker owns actual domain/certificate wiring.
