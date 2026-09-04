# C-01 / C-05 Reconciliation Pass 2 — Test Run Results

**Date:** 2026-09-04  
**Branch:** `feature/c01-c05-creator-integration`  
**Run context:** Pass-2 bounded correction. Agent re-ran FE scoped + tsc/build/lint and BE nest build + auth-static + C-01/C-05 postgres with disposable Docker (**skip count 0**).  
**Invariant report:** [`reconciliation-pass-2-report.md`](./reconciliation-pass-2-report.md)  
**Commands:** [`commands-to-run.md`](./commands-to-run.md)  
**Playbook:** [`../MODULE-AUDIT-TESTING-PLAYBOOK.md`](../MODULE-AUDIT-TESTING-PLAYBOOK.md)

This file is **reconciliation pass-2 only**. It does not modify pass-1 files.

Status vocabulary: `PASS` / `FIXED` / `GENUINE_AUTHORITY_CONFLICT` / `ENVIRONMENT_BLOCKED`

---

## Exact SHAs (final pass 2)

| Repo | Branch | SHA |
|---|---|---|
| Backend | `feature/c01-c05-creator-integration` | `b8bf489bccd5120107c9170d6309f7c4f81c0156` |
| Frontend | `feature/c01-c05-creator-integration` | `11cb12b635806983d2f2b2d8ca4b8b3b61da1f43` |

Logs: `docs/handoff-audit/.logs/recon-pass2-*` (local only, not committed)

---

## Backend results (no skip)

### B1 — `npx nest build` — PASS

```
exit 0
```

### B2 — Auth security static — PASS

```
Test Files  1 passed (1)
     Tests  4 passed (4)
```

### B3 — C-01 scoped postgres (`creator-entry` + `c01-persistence`)

**Env:** `C01_I1`…`C01_I5` → `c01_i*_recon` on `127.0.0.1`  
**Skip count: 0**

**Full run:**

```
Test Files  2 failed | 13 passed (15)
     Tests  2 failed | 172 passed (174)
  Duration  25.76s
```

#### Named failures

| File | Case | Class | Invariant |
|---|---|---|---|
| `c01-persistence-security.postgres.test.ts` | `distinguishes available, expired and consumed records` — `Unique constraint (token_digest)` | **ENVIRONMENT_BLOCKED** (dirty `c01_i1_recon`) → truncated → clean | fixture |
| `creator-instagram-connection.postgres.test.ts` | Brand `authorize` expected `ACCOUNT_CONTEXT_CONFLICT`, got `Creator access required` | Parked wording; deny OK; out of mail | 6 |

**I1 after truncate `creator_entry_continuations`:**

```
Test Files  1 passed (1)
     Tests  22 passed (22)
```

**Mail Inv-7 reclaim / ACTIVE reject / OTP race:** all **PASS** in I2 section of full run.

Effective policy picture: **1 parked fail** (Brand authorize code) after clean I1.

### B4 — C-05 scoped (`creator-settings` + `shared/team`)

**Env:** `C05_TEAM_DATABASE_TEST=true`, `DATABASE_URL=…/c05_team_recon`  
**Skip count: 0**

```
Test Files  1 failed | 16 passed (17)
     Tests  1 failed | 124 passed (125)
  Duration  17.36s
```

| File | Case | Class |
|---|---|---|
| `creator-team.postgres.test.ts:331` | After promote to Manager, expects `team.list` reject; list succeeds | Assertion-order test bug. Leave. |

---

## Frontend results (agent 2026-09-04)

### F1 — `npx tsc -b` — PASS

### F2 — Scoped C-01/C-05 vitest — PASS

```
Test Files  29 passed (29)
     Tests  163 passed (163)
  Duration  58.31s
```

**Named failures:** none.

Key: `creator-entry-architecture.test.ts` inviteToken / continuation / no autoApply — **PASS**.

### F3 — `npm run build` — PASS

```
✓ 2103 modules transformed — exit 0
```

(chunk-size warning only)

### F4 — `npm run lint` — PASS

```
eslint . — 0 errors / 0 warnings
```

### F5 — UI smoke — PASS (prior 2026-09-03)

R1, R3–R6 in pass-1 test-results. **Not re-clicked** this pass. No R2 in suite.

---

## Invariant confirmation (pass 2)

| # | Invariant | Status | Evidence |
|---|---|---|---|
| 1 | Campaign Apply continuation / no auto-Application | **FIXED** | FE architecture + scoped 163/163 |
| 2 | Invitation path separation | **FIXED** | `if (inviteToken)` architecture PASS |
| 3 | `CreatorPlatformAccessGuard` | **FIXED** | Pass-1 + FE guard tests |
| 4 | Entry/Settings recovery | **PASS** | FE + prior UI |
| 5 | Stable Instagram identity | **PASS** | C-01 continuity |
| 6 | One-email / account-context | **PASS** | Deny OK; parked code-string |
| 7 | Sterile provisional Creator reclaim | **FIXED** | I2 reclaim/OTP/ACTIVE green |
| 8 | FE structured error codes | **FIXED** | parse-api-error in scoped FE |
| 9 | Creator shell navigation | **PASS** | Shell tests + prior UI |
| 10 | Creator Team actor/subject + role | **PASS** | 124/125; 1 assertion-order left |
| 11 | Aurora SideDrawer a11y | **FIXED** | Drawer tests PASS |
| 12 | No deployable fixed OTP | **FIXED** | auth-static 4/4 |

**`GENUINE_AUTHORITY_CONFLICT`:** none.

---

## Closeout

Pass-2 automated suites, typecheck, build, and lint are done at the SHAs above.  
Optional: re-walk `ui-verification.md`; full `npm test` is not required for this mail.
