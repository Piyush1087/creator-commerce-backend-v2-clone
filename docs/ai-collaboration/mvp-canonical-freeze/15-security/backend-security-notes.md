# Backend security notes (§15)

See also `security-release-check.md`.

| Topic | Backend evidence |
| --- | --- |
| No fixed OTP in deployable config | `src/features/auth/auth-security.static.test.ts` |
| Non-prod OTP log | `src/features/auth/auth-otp-log.ts` — log on `local` and AWS `--stage dev` (`creator-dev`); silent only when `STAGE=prod` |
| QA apply bypass | Live creator-dev `CREATOR_APPLY_BYPASS_EMAILS=test@creator.com` (named targeting list, not login). Empty on a future prod deploy unless a security authority names a list |
| OUT APIs still mounted | `CoPilotModule` `CreatorCoPilotModule` `CreatorCentreModule` `CreatorPayoutsModule` in `src/app.module.ts`. Competing collab/marketplace command transitions retired `410`. `BrandPayoutsModule` is now IN (v1). |
| Prisma validate | PASS 2026-09-08 `npx prisma validate` |

Do not commit `.env`, `tmp-ssm-params.json`, or `tmp-*` logs.
