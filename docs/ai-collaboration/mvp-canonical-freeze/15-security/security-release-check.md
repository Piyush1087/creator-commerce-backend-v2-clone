# Security and release hygiene check (§15)

**Date:** 2026-09-11  
**Scope:** freeze-branch source scan + live **creator-dev** ECS read (profile `creator-dev`, account `841162679642`). Not a pentest. **creator-prod not inspected.** No `sst deploy`. OTP codes are not recorded here.

## Hazard scan

| Hazard | Finding | Class |
| --- | --- | --- |
| Hard-coded OTPs / fixed `123456` | `auth-security.static.test.ts` forbids legacy fixed six-digit code in `src/` and in deployable `sst.config.ts` + `.env.example` | Guard present. Docs in older `docs/creator-onboarding` still mention stub OTP — docs debt, not runtime |
| Test passwords / bypass users | Live creator-dev ECS `CREATOR_APPLY_BYPASS_EMAILS=test@creator.com` (SST non-prod default). **QA campaign-targeting list, not login OTP bypass.** Accepted named list for AWS-dev. Must be empty on a future prod deploy unless a security authority names a list | AWS-dev reviewed. PRODUCTION_BLOCKER if left set on a real prod API |
| Deployable mock authentication | `CREATOR_VERIFICATION_USE_REAL_OTP` / `BRAND_VERIFICATION_USE_REAL_OTP` absent from freeze SST/`.env.example` and from live creator-dev ECS env **names** | Guard present on source and on live creator-dev |
| OTP logged in non-prod | Live ECS `STAGE=dev`. Code logs `[OTP]` unless `STAGE=prod`. CloudWatch log group `/sst/cluster/creatorshop-be-dev-apiclusterCluster/api/api` has `[OTP]` events in the last 7 days (codes not copied) | Required for AWS-dev testers. Production silence remains a future prod-deploy gate (`STAGE=prod`); creator-prod has no API today |
| Placeholder secrets as real | `.env.example` uses `replace-me` placeholders | Names only; no live secrets in this register |
| Committed credentials | Not a full git-history secret dump. `.env` is not in freeze docs | Unchanged |
| Permissive redirects | C-01 client must not send client-controlled `redirectUri` (architecture tests exist) | Keep in §18 |
| Disabled auth/RBAC | FE `RequireAuth` + Creator platform guard + Settings action guards. BE still serves OUT modules if called | Residual: hidden UI ≠ disabled API. Competing OUT **writes** retired `410` |
| Cross-tenant exposure | INV-01/04/12 postgres PASS | §18 |
| Debug / test routes | `/brand/intelligence/identity-test` inbound redirects to Home (RUN 9). Page files kept | LEGACY test surface hidden |
| Frontend-only authorization | Mutations must stay backend-enforced | §18 |
| Provider success simulation | Razorpay route runtime comment: disabled until entitlement verified. Co-Pilot quota unlimited off-prod | Fail-closed required for money. Live IG/Razorpay later (INV-10) |

## Live creator-dev proof (2026-09-11)

Read-only. Profile `creator-dev`. No deploy.

```text
account                         841162679642
cluster                         creatorshop-be-dev-apiclusterCluster
service api                     ACTIVE  desired=1 running=1
task definition                 creatorshop-be-dev-apiclusterCluster-api:232
registeredAt                    2026-09-08 (this image is not the freeze SHA pair)
https://api.dev.thecreatorshop.in/health/live   HTTP 200
STAGE                           dev
CREATOR_APPLY_BYPASS_EMAILS     test@creator.com
NOTIFICATIONS_DEV_EMIT_ENABLED  false
mock OTP feature-flag names     absent from ECS env
CloudWatch [OTP] events         present (limit 20 hit; codes not recorded)
```

## Required posture

```text
NO_KNOWN_DEPLOYABLE_SECURITY_BYPASS  = DECLARED 2026-09-11
  bound = freeze source + live creator-dev ECS env
  not freeze PASS
  not creator-prod
  not a claim that freeze SHAs are what ECS is running
```

**Named AWS-dev QA list:** `test@creator.com` is campaign-targeting only. Login still requires OTP/Google.

**Future prod-deploy gates (no live prod API today):** `STAGE=prod`, no OTP logs, `CREATOR_APPLY_BYPASS_EMAILS` empty unless a security authority names a list.

**Classified leftovers that are not login/auth bypasses:** Brand UCE second persistence engine (IN), Chat Home HITL campaign/planner intents, unauthenticated public marketplace GET (read-only), Centre media-kit PATCH (OUT writing OUT).

## Known non-bypass debt

Non-prod OTP logging is intentional for testers. It is **not** a fixed OTP.
