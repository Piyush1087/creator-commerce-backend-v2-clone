# 07 — Targeted tests

**Date:** 2026-09-08

## Frontend freeze-relevant (PASS)

```text
npx vitest run --config vitest.config.ts
  src/layouts/app-shell/bottom-nav-items.test.ts
  src/layouts/app-shell/creator-shell-capabilities.test.ts
  src/features/creator-onboarding/creator-settings-guard-scope.test.ts
  src/routes/c05-frontend-convergence.architecture.test.ts
```

```text
Test Files  4 passed
Tests       35 passed
```

Covers shell hide / C-05 Settings mounts / Creator Entry guard-scope (INV-03, INV-05 partial).

## Backend auth static (PASS after example-comment cleanup)

First run failed because `.env.example` still named `CREATOR_VERIFICATION_USE_REAL_OTP` in comments. `sst.config.ts` does not contain that string (not wired into SST).

Comments were rewritten without the flag names. Re-run:

```text
npx vitest run --config vitest.config.ts src/features/auth/auth-security.static.test.ts
Tests 4 passed
```

Full `npm test` suites were not re-run (prior vitest hang risk). Module acceptance suites: `NOT_RE_RUN` on freeze tip.
