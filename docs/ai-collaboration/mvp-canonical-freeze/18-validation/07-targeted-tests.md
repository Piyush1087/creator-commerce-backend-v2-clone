# 07 — Targeted tests

**Date:** 2026-09-08

## Frontend freeze-relevant (PASS) — RUN 3 + RUN 4

RUN 3 (shell hide / C-05 / Creator Entry guard-scope):

```text
npx vitest run --config vitest.config.ts
  src/layouts/app-shell/bottom-nav-items.test.ts
  src/layouts/app-shell/creator-shell-capabilities.test.ts
  src/features/creator-onboarding/creator-settings-guard-scope.test.ts
  src/routes/c05-frontend-convergence.architecture.test.ts
Test Files  4 passed
Tests       35 passed
```

RUN 4 expanded FE invariant proofs:

```text
npx vitest run --config vitest.config.ts
  src/shared/auth/require-auth.test.ts
  src/features/auth/post-login-redirect.test.ts
  src/features/collaboration/utils/collaboration-route-access.test.ts
  src/features/creator-onboarding/creator-entry-architecture.test.ts
  src/layouts/app-shell/bottom-nav-items.test.ts
  src/layouts/app-shell/creator-shell-capabilities.test.ts
  src/features/creator-onboarding/creator-settings-guard-scope.test.ts
  src/routes/c05-frontend-convergence.architecture.test.ts
Test Files  8 passed (8)
Tests       70 passed (70)
```

## Backend freeze-relevant (PASS) — RUN 3 + RUN 4

RUN 3 auth static (after `.env.example` comment cleanup):

```text
npx vitest run --config vitest.config.ts src/features/auth/auth-security.static.test.ts
Tests 4 passed
```

RUN 4 expanded BE invariant proofs (architecture + unit; **not** dedicated postgres isolation DBs):

```text
npx vitest run --config vitest.config.ts
  src/features/auth/auth-security.static.test.ts
  src/features/auth/auth-security.unit.test.ts
  src/features/creator-entry/creator-entry.architecture.test.ts
  src/features/creator-settings/c05-p2-convergence.architecture.test.ts
  src/features/creator-settings/team/creator-team.policy.test.ts
  src/features/brand-centre/brand-workspace-authorization.service.test.ts
Test Files  6 passed (6)
Tests       51 passed (51)
```

Module-wise suites for this amendment are recorded below. Do not treat a whole-repo run as remaining work.

## Backend C-04 collab conversion (PASS) — this amendment

Former `node:test` collab files now collect under Vitest. Harnesses retargeted to current C-04 / Payouts constructors. Isolated:

```text
npx vitest run --config vitest.config.ts
  src/features/collaboration/services/collaboration-fulfillment.test.ts
  src/features/collaboration/services/collaboration-publishing.test.ts
  src/features/collaboration/utils/collaboration-read-model.mapper.test.ts
  src/features/collaboration/services/collaboration-feedback.test.ts
  src/features/collaboration/services/collaboration-commercial-command.test.ts
  src/features/collaboration/services/collaboration-exception.test.ts
  src/features/collaboration/schemas/provision-collaboration.schema.test.ts
  src/features/collaboration/services/collaboration-auto-approval.test.ts
  src/features/collaboration/services/collaboration-production.test.ts
  src/features/collaboration/services/collaboration-settlement.test.ts
  src/features/collaboration/services/collaboration-financial-boundary.test.ts
  src/features/collaboration/services/collaboration-bank-ownership.test.ts
  src/features/collaboration/services/collaboration-messaging-lifecycle.test.ts
  src/features/collaboration/services/collaboration-final-reconciliation.test.ts
Test Files  14 passed (14)
Tests       106 passed (106)
```

## Brand Payouts Wave B postgres (PASS) — this amendment

First `npx vitest` fail was a stale Prisma client (`payoutReserveApproval` / `financialReserveApproval` missing). `npx vitest` does not run `pretest` generate. After `npx prisma generate` against disposable `localhost/waveb_runtime` (94 migrations; not `thecreatorshop`):

```text
npx prisma generate
$env:DATABASE_URL="postgresql://postgres:password@localhost:5432/waveb_runtime?schema=public"
$env:BRAND_PAYOUTS_WAVE_B_DATABASE_TEST="true"
npx vitest run src/features/brand-payouts/brand-payouts-wave-b.postgres.test.ts
Test Files  1 passed (1)
Tests       3 passed (3)
```

Post-Wave-B targeted C-04 collab + Payouts unit (no postgres): **23 files / 167 passed / 5 skipped**. Pair 2 leftover-writer retirement did not break Wave B. Parent reconfirm 2026-09-11: same suite **3/3 PASS**.

## INV-11 / INV-09 / fail-closed / lint:eslint — 2026-09-11

```text
FE  npx vitest run src/routes/inv-11-backend-authority.architecture.test.ts
    (+ creator-home / brand-home / chat architecture)
    PASS 3/3 on INV-11 file

BE  npx vitest run src/features/collaboration/inv-09-shipping-disposition.static.test.ts
    src/features/brand-payouts/brand-payouts-wave-b.test.ts
    src/features/brand-payouts/brand-payouts-p0.architecture.test.ts
    src/features/creator-settings/c05-p2-convergence.architecture.test.ts
    PASS

BE  npm run lint:eslint
    PASS classified (prettier plugin off; exit 0)
```

### INV-09 reclassification — 2026-09-11 (later)

C-04 destination `confirmDefault` already consumed `CreatorShippingAddress` (snapshot onto `CollaborationDeliveryDestination`; fulfillment gates on that snapshot). The earlier PARTIAL grepped `collaboration-fulfillment.service.ts` only. Static test rewritten to prove that path. **PASS classified.** Do not invent a live fulfillment join.

```text
BE  npx vitest run src/features/collaboration/inv-09-shipping-disposition.static.test.ts
    PASS 3/3
```

### creator-dev security env — 2026-09-11

Read-only `aws` profile `creator-dev`. No deploy. No creator-prod. OTP codes not recorded.

```text
sts account                         841162679642
ecs service api                     desired=1 running=1  task :232
STAGE                               dev
CREATOR_APPLY_BYPASS_EMAILS         test@creator.com
mock OTP flag names                 absent
health/live                         HTTP 200
CloudWatch [OTP]                    events present (codes not copied)
NO_KNOWN_DEPLOYABLE_SECURITY_BYPASS DECLARED (this bound only)
```

### Parent reconfirm — INV-09 / C-04 destination / auth security — 2026-09-11 16:50

Parent-run after INV-09 static rewrite. Isolated vitest only.

```text
BE  npx vitest run --config vitest.config.ts
      src/features/collaboration/inv-09-shipping-disposition.static.test.ts
    PASS 1 file / 3 tests

BE  npx vitest run --config vitest.config.ts
      src/features/collaboration/c04-runtime.test.ts
      src/features/collaboration/services/collaboration-fulfillment.test.ts
    PASS 2 files / 15 tests

BE  npx vitest run --config vitest.config.ts
      src/features/auth/auth-security.static.test.ts
      src/features/auth/auth-security.unit.test.ts
    PASS 2 files / 14 tests

FE  npx vitest run --config vitest.config.ts
      src/features/collaboration/c04-frontend.test.ts
    PASS 1 file / 6 tests
```

C-04 destination postgres (`C04_B2_DATABASE_TEST` / `c04_b2_runtime_20260906`) was **not** re-run.

Per-INV mapping: `11-invariant-results.md`.
