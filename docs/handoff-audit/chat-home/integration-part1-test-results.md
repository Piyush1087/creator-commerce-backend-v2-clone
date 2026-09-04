# Chat Home V1 — Integration Part 1 Test Results

**Date:** 2026-09-04  
**Branch:** `integration/chat-home-v1`  
**Report:** [`integration-part1-report.md`](./integration-part1-report.md)  
**Commands:** [`commands-to-run.md`](./commands-to-run.md)

Status vocabulary: `PASS` / `FIXED` / `GENUINE_AUTHORITY_CONFLICT` / `ENVIRONMENT_BLOCKED`

---

## Exact SHAs

| Repo | Branch | SHA |
|------|--------|-----|
| Backend | `integration/chat-home-v1` | `e732a134639baba3a7c48d8768ccc981d6a5a439` |
| Frontend | `integration/chat-home-v1` | `251048074b46b1edf909a6d734c1f1b31ad5a040` |

Accepted source runtimes (ancestors): BE `00e1299ec2e97497bc6d81aeda808d6edd3b482a` · FE `1cf2e3bd93425f60fb3d40692320078aea567794`

Logs: `docs/handoff-audit/.logs/chat-home-*` and `docs/brand-home/_*.log` (local).

---

## Backend

### B1 — Prisma validate + generate + migrate rehearsal — PASS

- Schema valid.  
- Disposable `chat_home_integ` / `chat_home_p3_integ` / `bs07_chat_home_integ` / `chat_home_p3_module_boundary_01`: **74** migrations, no pending.

### B2 — `npx nest build` — PASS

```
exit 0
```

### B3 — Unit / architecture (Chat, Brand Home, intelligence-consumer, workspace auth unit)

```
Test Files  23 passed | 5 skipped (28)
     Tests  152 passed | 29 skipped (181)
```

Postgres files skipped in this run (flags off). Non-DB Chat/Home evidence: **PASS**.

### B4 — Self-seeding postgres — PASS (skip 0)

**Env:** `CHAT_HOME_DATABASE_TEST=true`, `CHAT_HOME_P3_DATABASE_TEST=true`, `DATABASE_URL=…/chat_home_p3_integ`

```
Test Files  2 passed (2)
     Tests  8 passed (8)
```

- `chat-conversation.postgres.test.ts` — 3  
- `chat-http.postgres.test.ts` — 5  

### B5 — Brand workspace auth postgres (P7-C1) — PASS (skip 0)

**Env:** `BRAND_WORKSPACE_DATABASE_TEST=true`, `DATABASE_URL=…/bs07_chat_home_integ`

```
Test Files  1 passed (1)
     Tests  11 passed (11)
```

### B6 — P5-A / P5-B fixture postgres — ENVIRONMENT_BLOCKED

**Env:** `CHAT_HOME_P5_A_DATABASE_TEST=true`, `CHAT_HOME_P5_B_DATABASE_TEST=true`, `DATABASE_URL=…/chat_home_p3_module_boundary_01`  
DB exists and is migrated (74), but **acceptance fixture rows absent** (`findUniqueOrThrow` on fixed `PRIMARY_USER_ID`).

| File | Error | Class |
|------|-------|-------|
| `chat-p5a-consumers.postgres.test.ts` | No user for `244023ed-0031-4e50-967c-ba58a4bc76f5` | **ENVIRONMENT_BLOCKED** |
| `brand-home.postgres.test.ts` | Same | **ENVIRONMENT_BLOCKED** |

Handoff/ledger: fixture used at clone acceptance (`fixture_manifest_present`). No seed script in repo for this integration. Do not invent Product data.

### B7 — Intelligence contracts verify CLI — ENVIRONMENT_BLOCKED

`npm run intelligence:contracts:verify` requires `--source` / `--commit` on this line. Not treated as architecture fail.

---

## Frontend

### F1 — `npx tsc -b` — FIXED → PASS

Merge had dropped origin `verification-otp.config.ts` + `creator-onboarding.contracts.ts` and duplicate `aria-current` attrs. Restored/fixed (merge hygiene only). Then clean.

### F2 — Scoped Chat / Brand Home / destination nav — PASS

```
Test Files  12 passed (12)
     Tests  105 passed (105)
```

### F3 — `npm run build` — PASS

```
exit 0 (chunk-size warning only)
```

### F4 — UI smoke — ENVIRONMENT_BLOCKED

Not executed this pass (local click-through deferred to operator / Part B).

---

## Named failures / blocks summary

| Item | Status |
|------|--------|
| Self-seeding Chat postgres | **PASS** |
| Workspace auth postgres | **PASS** |
| P5 fixture postgres | **ENVIRONMENT_BLOCKED** |
| FE merge-drop typecheck | **FIXED** |
| Contracts verify CLI | **ENVIRONMENT_BLOCKED** |
| UI smoke | **ENVIRONMENT_BLOCKED** |
| Authority conflict | **none** |

---

## Part 1 bottom line

Integration candidate is **code-complete** with accepted runtimes merged and core Chat/Home + P7-C1 evidence green.  
Part 1 is **closed for merge consideration** except optional restore of P5 fixture before claiming full historical postgres parity.

**Do not push / merge to `development` until you authorize.**
