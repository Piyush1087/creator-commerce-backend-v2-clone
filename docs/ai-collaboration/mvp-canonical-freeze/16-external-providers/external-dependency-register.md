# MVP_EXTERNAL_DEPENDENCY_REGISTER (§16)

No secret values. Names and requirements only.  
**Date:** 2026-09-08

| provider | capability | code_state | configuration_state | live_validation_state | credential_or_permission_prerequisite | blocks_AWS_dev | blocks_production | owner/future_worker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Google Gemini | Gatekeeper / Brand DNA / Chat Home models | CODE_READY | PROVIDER_CONFIGURATION_PENDING | LIVE_VALIDATION_PENDING | `GEMINI_API_KEY` + model name vars | AWS_DEV_BLOCKER if Brand onboarding required on that env | PRODUCTION_BLOCKER | AWS worker / intelligence |
| OpenAI | Gatekeeper model option / DE | CODE_READY | PROVIDER_CONFIGURATION_PENDING | LIVE_VALIDATION_PENDING | `OPENAI_API_KEY` | DEFERRED_NONBLOCKING if Gemini is the active path | depends on active model | intelligence |
| Zyte | Brand surface acquisition | CODE_READY | PROVIDER_CONFIGURATION_PENDING | LIVE_VALIDATION_PENDING | `ZYTE_API_KEY` `ZYTE_API_URL` | AWS_DEV_BLOCKER for onboarding scan | PRODUCTION_BLOCKER | Brand onboarding |
| Playwright / Chromium | Parallel surface merge | CODE_READY | ECS image installs Chromium | LIVE_VALIDATION_PENDING | `PLAYWRIGHT_ENABLED` | DEFERRED_NONBLOCKING locally | configuration | Brand onboarding |
| Parallel API | Legacy research / DE capability | CODE_READY | PROVIDER_CONFIGURATION_PENDING | LIVE_VALIDATION_PENDING | `PARALLEL_API_KEY` | DEFERRED_NONBLOCKING | depends | DE |
| Postmark | Auth OTP, invites, notifications | CODE_READY | OTP template CONFIGURED_LOCALLY 2026-09-10; invites/other templates not re-proven | OTP template LOCAL_LIVE_SEND_PASS (Parent inboxes 2026-09-10) | `POSTMARK_SERVER_TOKEN` + template IDs | AWS_DEV_BLOCKER until ECS has the same token/templates | PRODUCTION_BLOCKER | auth / notifications |
| Google OAuth | Brand + Creator Google sign-in | CODE_READY | PROVIDER_CONFIGURATION_PENDING | LIVE_VALIDATION_PENDING | `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` | DEFERRED_NONBLOCKING if email OTP used | PRODUCTION_BLOCKER if Google is offered | auth |
| Google Maps | Campaign geography | CODE_READY | PROVIDER_CONFIGURATION_PENDING | LIVE_VALIDATION_PENDING | `VITE_GOOGLE_MAPS_API_KEY` | DEFERRED_NONBLOCKING | PRODUCTION_BLOCKER if campaign geo used | UCE |
| Instagram / Meta Graph | Creator + Brand social connect | CODE_READY | PROVIDER_CONFIGURATION_PENDING | LIVE_VALIDATION_PENDING | `INSTAGRAM_API_ID` `INSTAGRAM_APP_SECRET` `CREATOR_INSTAGRAM_REDIRECT_URI` | AWS_DEV_BLOCKER for C-01 connect | PRODUCTION_BLOCKER; Meta App Review `PROVIDER_DEFERRED` | C-01 / Settings |
| Meta data deletion | Compliance callback | CODE_READY | PROVIDER_CONFIGURATION_PENDING | LIVE_VALIDATION_PENDING | `PUBLIC_API_BASE_URL` | DEFERRED_NONBLOCKING | PRODUCTION_BLOCKER for App Review | Settings |
| Razorpay | Escrow / subscriptions / route | CODE_READY (route disabled until entitlement) | PROVIDER_CONFIGURATION_PENDING | LIVE_VALIDATION_PENDING | `RAZORPAY_*` keys + webhook secrets; FE `VITE_RAZORPAY_KEY_ID` | AWS_DEV_BLOCKER for live money; escrow UI may fail-closed | PRODUCTION_BLOCKER; live Razorpay `PROVIDER_DEFERRED` | Settings escrow / future Brand Payouts v1 |
| AWS S3 | File uploads | CODE_READY | PROVIDER_CONFIGURATION_PENDING | LIVE_VALIDATION_PENDING | `S3_BUCKET_NAME` `AWS_REGION` (SST injects on deploy) | AWS_DEV_BLOCKER | PRODUCTION_BLOCKER | AWS worker |
| PostgreSQL | Canonical persistence | CODE_READY | PROVIDER_CONFIGURATION_PENDING | LIVE_VALIDATION_PENDING | `DATABASE_URL` | AWS_DEV_BLOCKER | PRODUCTION_BLOCKER | AWS worker |
| Co-Pilot LLM | Co-Pilot product | OUT_OF_MVP | n/a | n/a | `GEMINI_*` / quota flags | no | no | not this freeze |

Statuses used: `CODE_READY` `PROVIDER_CONFIGURATION_PENDING` `LIVE_VALIDATION_PENDING` `DEFERRED_NONBLOCKING` `AWS_DEV_BLOCKER` `PRODUCTION_BLOCKER` `OUT_OF_MVP`.
