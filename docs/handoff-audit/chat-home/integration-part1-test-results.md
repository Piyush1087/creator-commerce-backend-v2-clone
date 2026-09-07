# Chat Home V1 â€” Integration Part 1 Test Results

**Date:** 2026-09-04 (closeout refresh)
**Branch:** `integration/chat-home-v1`
**Report:** [`integration-part1-report.md`](./integration-part1-report.md)
**Gate:** [`integration-candidate-gate.md`](./integration-candidate-gate.md)
**Commands:** [`commands-to-run.md`](./commands-to-run.md)

Status vocabulary: `PASS` / `FIXED` / `GENUINE_AUTHORITY_CONFLICT` / `ENVIRONMENT_BLOCKED`

**Scope note:** Evidence below is **local** on the integration candidate.
**Not** merged to `development`. **Not** deployed to dev/prod. Dev/prod smoke remains Part B/C after human auth.

---

## Exact SHAs (fill after commit of this closeout)

| Repo | Branch | SHA |
|------|--------|-----|
| Backend | `integration/chat-home-v1` | `0ad6443beb17047ae2676223abf8f33e28905bf6` |
| Frontend | `integration/chat-home-v1` | `251048074b46b1edf909a6d734c1f1b31ad5a040` |

Accepted source runtimes (ancestors): BE `00e1299ec2e97497bc6d81aeda808d6edd3b482a` Â· FE `1cf2e3bd93425f60fb3d40692320078aea567794`

Logs: `docs/handoff-audit/.logs/chat-home-*` (local; usually not committed).

---

## Backend

### B1 â€” Prisma validate + generate + migrate rehearsal â€” PASS

- Disposable DBs: `chat_home_integ` / `chat_home_p3_integ` / `bs07_chat_home_integ` / `chat_home_p3_module_boundary_01`
- **74** migrations applied; no pending on those DBs
- **Not** validated against real **dev/prod RDS** yet (operational debt)

### B2 â€” `npx nest build` â€” PASS

```
exit 0
```

(Reconfirmed after Notifications circular-dep `forwardRef` fix.)

### B3 â€” Targeted Chat/Home unit â€” PASS

```
Test Files  23 passed | 5 skipped (28)
     Tests  152 passed | 29 skipped (181)
```

Postgres files skipped in that scoped run (flags off). Non-DB Chat/Home: **PASS**.

### B4 â€” Self-seeding Chat postgres â€” PASS (skip 0) â€” reconfirmed

**Env:** `CHAT_HOME_DATABASE_TEST=true`, `CHAT_HOME_P3_DATABASE_TEST=true`, `DATABASE_URL=â€¦/chat_home_p3_integ`

```
Test Files  2 passed (2)
     Tests  8 passed (8)
```

### B5 â€” Brand workspace auth postgres (P7-C1) â€” PASS (skip 0) â€” reconfirmed

**Env:** `BRAND_WORKSPACE_DATABASE_TEST=true`, `DATABASE_URL=â€¦/bs07_chat_home_integ`

```
Test Files  1 passed (1)
     Tests  11 passed (11)
```

### B6 â€” P5-A / P5-B fixture postgres â€” ENVIRONMENT_BLOCKED (ran with flags ON; not skipped)

**Env:** `CHAT_HOME_P5_A_DATABASE_TEST=true`, `CHAT_HOME_P5_B_DATABASE_TEST=true`, `DATABASE_URL=â€¦/chat_home_p3_module_boundary_01`
DB migrated (74). **No acceptance fixture rows** (no DB dump available to this worker).

| File | Observed | Class |
|------|----------|-------|
| `chat-p5a-consumers.postgres.test.ts` | `findUniqueOrThrow` missing user `244023ed-0031-4e50-967c-ba58a4bc76f5` | **ENVIRONMENT_BLOCKED** |
| `brand-home.postgres.test.ts` | Same | **ENVIRONMENT_BLOCKED** |

No Product seed invented.

### B7 â€” Intelligence contracts verify CLI â€” ENVIRONMENT_BLOCKED

Attempted:

```text
npm run intelligence:contracts:verify -- --source <repo> --commit ad4e428â€¦
â†’ Error: Architecture source checkout is dirty
```

Needs a **clean** checkout of the exact SHA. Worktree has local untracked handoff/logs. Not a Chat semantic fail.

### B8 â€” Full `npm test` (flags cleared so Chat postgres skip by design) â€” NOT green overall

Log: `.logs/chat-home-be-full-npm-test-clean.log`

```
Test Files  24 failed | 174 passed | 42 skipped (240)
     Tests  15 failed | 1209 passed | 504 skipped (1728)
exit 1
```

**Chat/Home postgres suites:** skipped when flags unset (expected). With flags + disposable DB they **PASS** (B4/B5).

**Named failing tests (15) â€” none are Chat/Home Product suites.** Observed classes:

| Area | Examples | Classification for Chat/Home gate |
|------|----------|-----------------------------------|
| Auth static BS-12 | fixed OTP / `CREATOR_VERIFICATION_USE_REAL_OTP` in SST | Pre-existing on tip / unrelated to Chat merge â€” **not** claimed PASS |
| Notifications / escrow / DE architecture | module wiring string asserts, Route payout, DE â€œwinnerâ€, BI imports string | Several expect **development-shaped** BI imports (`[DataExtractionModule, BrandCanonicalStateModule]`); tip retains Chat-accepted `NotificationsModule` import â€” **integration-visible**; see B9 |
| Collaboration node:test files | `invalidateReadiness` undefined, etc. | Unrelated Collaboration â€” **not** Chat FAIL |
| Pricing subscription lifecycle | schedule assert | Unrelated â€” **not** Chat FAIL |

**Honest gate read:** `backend_full_suite` is **FAIL / not clean** on this tip. Chat/Home **targeted** evidence remains **PASS**. Do not claim full-suite PASS.

### B9 â€” Local Nest boot â€” FIXED (integration defect)

**Before fix:** `nest start` failed:

```text
Nest cannot create the NotificationsModule instance.
The module at index [2] of the NotificationsModule "imports" array is undefined.
Scope [AppModule â†’ BrandOnboardingModule â†’ BrandCentreModule â†’ BrandIntelligenceModule]
```

**Cause:** Accepted Chat runtime `00e1299` BI module imports `NotificationsModule`; `origin/development` BI does **not**. Cycle: BrandCentre â†’ BrandIntelligence â†’ Notifications â†’ BrandCentre made `BrandCentreModule` undefined at load.

**Fix (bounded, Part D):** `forwardRef` on BIâ†”Notificationsâ†”BrandCentre edges. No Product/EXECUTE change.

**After fix:** `GET http://127.0.0.1:3000/health/live` â†’ `200 {"status":"ok"}`.

---

## Frontend

### F1 â€” `npx tsc -b` â€” FIXED â†’ PASS (earlier merge hygiene)

### F2 â€” Scoped Chat / Brand Home / destination nav â€” PASS

```
Test Files  12 passed (12)
     Tests  105 passed (105)
```

### F3 â€” `npm run build` â€” PASS

### F4 â€” Full `npm test` â€” NOT green overall

Log: `.logs/chat-home-fe-full-npm-test.log`

```
Test Files  4 failed | 100 passed (104)
     Tests  23 failed | 816 passed (839)
exit 1
```

**Failing files (not Chat/Home):**

- `src/features/auth/auth-security-static.test.ts`
- `src/features/brand-onboarding/components/social-sync-view.test.ts` (majority)
- `src/features/brand-onboarding/utils/google-id-token.test.ts`
- `src/pages/brand/settings/brand-settings-billing-page.test.ts`

**Chat/Home scoped suites** in F2: **105/105 PASS**. Do not claim full FE suite PASS. Do not claim those 23 failures are Chat regressions without a development-baseline comparison (not run here).

### F5 â€” Local UI / API smoke (local only) â€” PARTIAL

| Check | Result | Notes |
|-------|--------|-------|
| FE Vite `http://127.0.0.1:5173/` | **PASS** HTTP 200 | Shell loads |
| BE `/health/live` | **PASS** 200 `{"status":"ok"}` | After B9 fix |
| `GET /api/v1/brand/home` unauthenticated | **PASS** 401 | Route present; auth gate holds |
| `GET /api/v1/chat/conversations` unauthenticated | **PASS** 401 | Route present; auth gate holds |
| Authenticated Brand Home four sections | **ENVIRONMENT_BLOCKED** | No Brand test session / browser MCP unavailable this run |
| Authenticated Chat grounded turn + reload | **ENVIRONMENT_BLOCKED** | Same |
| Deployed dev smoke (D2/D3) | **NOT RUN** | Hold: no merge/deploy auth |

Local `.env` has `GEMINI_MODEL=gemini-3.5-flash` (key present; not printed). **Deployed** ECS Gemini **not** verified.

---

## Named summary

| Item | Status | Where it runs next |
|------|--------|--------------------|
| Self-seed Chat postgres | **PASS** | Local done |
| Workspace auth postgres | **PASS** | Local done |
| P5 fixture postgres | **ENVIRONMENT_BLOCKED** | Needs fixture dump if parity required; else accept gap |
| Contracts verify CLI | **ENVIRONMENT_BLOCKED** | Clean checkout of tip SHA |
| Nest local boot | **FIXED** â†’ health **PASS** | Dev deploy still separate |
| Local unauth route smoke | **PASS** | Authenticated UI still blocked |
| Authenticated local UI smoke | **ENVIRONMENT_BLOCKED** | Operator login or Part B |
| Full BE `npm test` | **FAIL** (15 unrelated/integration-visible) | Re-check after merge; not Chat suite FAIL |
| Full FE `npm test` | **FAIL** (23 non-Chat files) | Same |
| Merge to `development` | **NOT DONE** | Needs `INTEGRATION_MERGE_AUTHORIZED` |
| Dev/prod deploy + smoke | **NOT DONE** | Needs deploy auth |

**`GENUINE_AUTHORITY_CONFLICT`:** none observed.

---

## Part 1 bottom line (honest)

- Chat/Home **integration candidate** is in good shape for **review**: merge done on branch, builds pass, targeted Chat/Home + P7-C1 postgres green, local Nest boot fixed.
- It is **not** â€œfull handoff Â§10 greenâ€: full suites are not clean; P5 fixture absent; contracts CLI dirty-tree blocked; authenticated browser smoke not done.
- Remaining mail debt is still **operational**: merge to `development`, target-env migrations, deployed `gemini-3.5-flash`, then D2/D3.

**Do not merge/deploy until you authorize.** Review of the branch is appropriate now with the caveats above.
