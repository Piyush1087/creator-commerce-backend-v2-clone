# 14 — Fresh clone `npm ci` (RUN 5)

**Date:** 2026-09-09; isolated clone Nest reconfirm **2026-09-12**  
**Method:** local `git clone --branch freeze/mvp-canonical-application-v1 --single-branch` into `%TEMP%\tcs-freeze-ci-fe` and `%TEMP%\tcs-freeze-ci-be` (freeze branch is not assumed on origin).

## Frontend — PASS

```text
npm ci
npm run typecheck   exit 0
npm run lint        exit 0
npm run build       exit 0
```

`npm audit` reported vulnerabilities; not a freeze gate.

## Backend — PASS (isolated clone 2026-09-12)

RUN 5 (2026-09-09) clone `nest build` **HUNG** under CPU contention with a full BE `npm test` (`ENVIRONMENT_BLOCKED`). `npm ci` and `npx prisma validate` already PASS. `npm run build` without generate fails (~2046 TS errors) because `pretest` generates and `build` does not.

Isolated clone reconfirm 2026-09-12 (no farm running; freeze tip `f217402…`). Parent ran **`npx prisma generate` then `npm run build`** (generate output was not pasted; build `copy-prompt-assets: ok` is the Nest PASS). Same generate was re-run on the **local working tree after reset** and also PASS.

```text
CLONE (fresh checkout)
npm ci                    PASS
npx prisma validate       PASS
npx prisma generate       PASS  Prisma Client v6.19.3 (~10s)
npm run build             PASS  nest build + copy-prompt-assets: ok
                              dist/main.js present

LOCAL working tree (after reset, same freeze tip)
npx prisma generate       PASS
```

**Classification:** clone Nest hang was `ENVIRONMENT_BLOCKED`, not product red. Isolated clone **generate then build** is **PASS**. Fresh clone must still run `npx prisma generate` before `npm run build` (`pretest` generates; `build` does not).
