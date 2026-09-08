# Security and release hygiene check (§15)

**Date:** 2026-09-08  
**Scope:** freeze-branch source scan. Not a pentest. No AWS env proof.

## Hazard scan

| Hazard | Finding | Class |
| --- | --- | --- |
| Hard-coded OTPs / fixed `123456` | `auth-security.static.test.ts` forbids legacy fixed six-digit code in `src/` and in deployable `sst.config.ts` + `.env.example` | Guard present. Docs in older `docs/creator-onboarding` still mention stub OTP — docs debt, not runtime |
| Test passwords / bypass users | `CREATOR_APPLY_BYPASS_EMAILS` in `.env.example` defaults to `test@creator.com` — QA campaign-targeting bypass, **not** login OTP bypass. Must be empty in production | PRODUCTION_BLOCKER if left set on prod |
| Deployable mock authentication | `CREATOR_VERIFICATION_USE_REAL_OTP` / `BRAND_VERIFICATION_USE_REAL_OTP` must not appear in SST or `.env.example` (static test). Comments in `.env.example` say local-only and never wire into SST | Guard present |
| OTP logged in non-prod | `email-otp.service.ts` logs OTP code when `!isProduction()`. Brand verification service also logs OTP off-prod | Acceptable for local/dev; **production must not log codes**. AWS worker must prove `STAGE=prod` |
| Placeholder secrets as real | `.env.example` uses `replace-me` placeholders | Names only; no live secrets in this register |
| Committed credentials | Not scanned as a full git-history secret dump this run. `.env` is not in freeze docs | Later §18 / AWS |
| Permissive redirects | C-01 client must not send client-controlled `redirectUri` (architecture tests exist) | Keep in §18 |
| Disabled auth/RBAC | FE `RequireAuth` + Creator platform guard + Settings action guards. BE still serves OUT modules if called | Residual: hidden UI ≠ disabled API |
| Cross-tenant exposure | Not re-proven this run | §18 |
| Debug / test routes | `/brand/intelligence/identity-test` still mounted in brand onboarding app | Classify LEGACY test surface |
| Frontend-only authorization | Mutations must stay backend-enforced | §18 |
| Provider success simulation | Razorpay route runtime comment: disabled until entitlement verified. Co-Pilot quota unlimited off-prod | Fail-closed required for money |

## Required posture

```text
NO_KNOWN_DEPLOYABLE_SECURITY_BYPASS  = NOT YET DECLARED
```

Blockers to clear before freeze PASS:

1. Production `CREATOR_APPLY_BYPASS_EMAILS` empty (or security authority accepts a named list).
2. OTP codes never logged when `STAGE=prod`.
3. OUT APIs (Co-Pilot, Centre, old payout hubs, public marketplace) either unwired or explicitly accepted as non-deployable-in-product with auth still required.
4. §18 auth/RBAC/cross-tenant suite run.

## Known non-bypass debt

Non-prod OTP logging is intentional for local mail failures. It is **not** a fixed OTP.
