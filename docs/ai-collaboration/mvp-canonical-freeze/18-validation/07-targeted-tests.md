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

Full `npm test` suites were not re-run (prior vitest hang risk). Module acceptance suites: `NOT_RE_RUN` on freeze tip.

Per-INV mapping: `11-invariant-results.md`.
