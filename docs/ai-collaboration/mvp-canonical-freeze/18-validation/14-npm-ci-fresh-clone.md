# 14 — Fresh clone `npm ci` (RUN 5)

**Date:** 2026-09-09  
**Method:** local `git clone --branch freeze/mvp-canonical-application-v1 --single-branch` into `%TEMP%\tcs-freeze-ci-fe` and `%TEMP%\tcs-freeze-ci-be` (freeze branch is not assumed on origin).

## Frontend — PASS

```text
npm ci
npm run typecheck   exit 0
npm run lint        exit 0
npm run build       exit 0
```

`npm audit` reported vulnerabilities; not a freeze gate.

## Backend — PARTIAL

```text
npm ci                    PASS
npx prisma validate       PASS
npm run build (no generate) FAIL  2046 TS errors (Prisma client not generated)
npx prisma generate       PASS (retry)
npm run build after generate  HUNG / killed after ~27 min with no nest output
  (CPU contended with full BE npm test)
```

**Classification:** `ENVIRONMENT_BLOCKED` for clone `nest build` under load. Working-tree backend build already **PASS** in RUN 3. Fresh clone must run `npx prisma generate` before `npm run build` (`pretest` generates; `build` does not).
