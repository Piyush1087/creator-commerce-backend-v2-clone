# C-03 automated test results (origin)

Clone joint-acceptance counts are **not** copied here. Source of truth:  
[`../c03-origin-run-log.md`](../c03-origin-run-log.md) and `docs/handoff-audit/.logs/c03-be-*.log`.

Branch: BE/FE `integration/c03-campaign-participation` · BE merge `9397a10` · FE merge `26e1a0d`  
Cycle date: 2026-09-08. Working tree still has uncommitted reconcile fixes.

| Check | Status | Origin result |
|-------|--------|---------------|
| Prisma migrate deploy (named disposable DBs) | VERIFIED | Applied on `c03_p5`, `c03_p11a_fresh`…`c03_p11e_fresh`, `c03_p12`, `c03_p13`, `c03_p14_handoff` (host often `localhost`) |
| Backend Nest build | VERIFIED | Pass |
| Backend unit/architecture scoped | VERIFIED | **4959 passed** / 9 files — `.logs/c03-be-unit.log` |
| BE P5 Brief Pack postgres | VERIFIED | 6 passed — `c03-be-pg-p5.log` |
| BE P11A | VERIFIED | 5 passed — `c03-be-pg-p11a.log` |
| BE P11B | VERIFIED | 5 passed after tip-guard test align — `c03-be-p11b-rerun2.log` |
| BE P11C | VERIFIED | 6 passed after DB recreate (dirty digests) — `c03-be-p11c-rerun.log` (clean) |
| BE P11D | VERIFIED | 6 passed — `c03-be-pg-p11d.log` |
| BE P11E | VERIFIED | 21 passed after approval→Collaboration fixture — `c03-be-pg-p11e-rerun.log` |
| BE P12 | VERIFIED | 15 passed — `c03-be-pg-p12.log` |
| BE P13 apps/contention | VERIFIED | 57 passed — `c03-be-pg-p13-rerun.log` |
| BE P14 handoff + legacy | VERIFIED | handoff prior green; legacy **4 passed** after NotificationDispatch wire — `c03-be-p14-legacy-rerun2.log` |
| Backend lint | VERIFIED | prettier-off ESLint clean (exit 0, no findings) — operator 2026-09-08; `.logs/c03-be-lint-prettier-off.log` |
| Full backend `npm test` | PENDING / optional | Not required for scoped gate; expect unrelated origin noise |
| Frontend `tsc -b` | VERIFIED | Clean (user 2026-09-08); also implied by `npm run build` = `tsc -b && vite build` |
| Frontend scoped `creator-campaigns` vitest | VERIFIED | **10 files / 116 tests passed** — `.logs/c03-fe-creator-campaigns.log` |
| Frontend build | VERIFIED | `vite build` ok (~30.86s); chunk-size warning only — `.logs/c03-fe-build.log` |
| Frontend lint | VERIFIED | **0 errors / 0 warnings** — `.logs/c03-fe-lint.log` (better than mail baseline 26/13) |
| Local UI smoke | VERIFIED | Operator 2026-09-08: C-03 Opportunities/Apply/Brief Pack/Applications **all ok** on seeded fixture — see `../ui-verification.md` C-03 session |
| AWS / prod migrate | BLOCKED | not authorized |

## Named failures that were FIXED this cycle

| File | Case | Class | Fix |
|------|------|-------|-----|
| `c03-p11b-application-snapshot.postgres.test.ts` | ancestry uniqueness + afterAll cleanup | Tip `INITIAL_STATE` / `SNAPSHOT_DELETE_FORBIDDEN` vs tip test still writing terminal rows | Disable insert+evidence guards for seed; terminal rows `status_version=2`+`terminal_at`; cleanup disables delete guards |
| `c03-p11c-security-audit.postgres.test.ts` | unique `token_digest` / `reference_digest` | Dirty `c03_p11c_fresh` | Drop/recreate DB + migrate |
| `c03-p11e-manifest-negatives.postgres.test.ts` | approval path | Missing Collaboration fixture after APPROVED | Fixture align (prior pass) |
| `legacy-handoff-regression.postgres.test.ts` | media notification job missing | HEAD CollaborationService lacked tip `NotificationDispatch` on `submitMedia` | Wire dispatch + enqueue; suite timeout 30s |

## Still PENDING for gate close

- Optional: local UI smoke if Product asks
- Commit / push / PR to `origin/development` when you ask (not deploy)
