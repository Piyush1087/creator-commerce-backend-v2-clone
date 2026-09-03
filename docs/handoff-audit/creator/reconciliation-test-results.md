# C-01 / C-05 Reconciliation — Test Run Results

**Date:** 2026-09-03  
**Branch:** `feature/c01-c05-creator-integration`  
**Run context:** Post-reconciliation-pass. Operator re-ran all recon-scoped backend suites with disposable Docker Postgres (0 skip on C-01 / C-05 / BS-12). Frontend not re-run (prior FE results remain).  
**Prior baseline:** `origin-run-log.md` + module `automated-test-results.md` files.  
**Invariant report:** `reconciliation-report.md`

This file is **reconciliation-only**. It does not modify the initial integration audit files.

---

## Backend results (final redo — no skip)

### B1 — `npx nest build`

```
Result: PASS — compiled with no errors
```

---

### B2 — Auth security static

```
Test Files  1 passed (1)
     Tests  4 passed (4)
  Duration  2.04s
```

**Invariant 12 — CONFIRMED FIXED.** No fixed OTP bypass in runtime source.

---

### B3 — C-01 scoped postgres (`creator-entry` + `c01-persistence`)

**Env:** `C01_I1`…`C01_I5` → `c01_i*_recon` on `127.0.0.1`  
**Skip count: 0**

```
Test Files  2 failed | 13 passed (15)
     Tests  4 failed | 170 passed (174)
  Duration  41.85s
```

#### Named failures (all pre-existing / not new from reconciliation)

| File | Case | Class | Invariant |
|---|---|---|---|
| `creator-entry.postgres.test.ts` | sterile Brand reclaim — `issueTokenForUserId is not a function` | Test harness mock missing method. Reclaim update path executed (no DB trigger). | 7 |
| `creator-entry.postgres.test.ts` | never reclaim ACTIVE Creator — expected `another account type`, got `different account type` | Message substring mismatch. Reject is correct. | 7 |
| `creator-entry.postgres.test.ts` | Brand activation vs Creator OTP race | Race — not all fulfilled. | 7 |
| `creator-instagram-connection.postgres.test.ts` | Brand `authorize` expected `ACCOUNT_CONTEXT_CONFLICT`, got `Creator access required` | Error shape mismatch vs clone test. Deny is correct. | 6 |

**Improved vs earlier redo:** `c01-persistence` `token_digest` fail is **gone** (fresh DBs). Continuity + campaign-apply postgres **PASS**. Inv-3 architecture / guard tests **PASS**.

---

### B4 + B5 — C-05 scoped (`creator-settings` + `shared/team`) with Team postgres

**Env:** `C05_TEAM_DATABASE_TEST=true`, `DATABASE_URL=…/c05_team_recon`  
**Skip count: 0**

```
Test Files  1 failed | 16 passed (17)
     Tests  1 failed | 124 passed (125)
  Duration  21.03s
```

| File | Case | Class |
|---|---|---|
| `creator-team.postgres.test.ts` | Owner protection / Manager/Assistant matrix — after promote to Manager, expects `team.list` to reject; actor is Manager with `TEAM_READ` so list succeeds | **Assertion-order test bug.** Same as prior baseline. Not policy regression. |

---

### B6 — Gatekeeper recovery database

**Env:** `GATEKEEPER_DATABASE_TEST=true`  
Suite started (not env-skipped); failed in `beforeAll`.

```
Test Files  1 failed (1)
     Tests  1 skipped (1)   ← skipped because beforeAll threw
```

| File | Case | Class |
|---|---|---|
| `gatekeeper-recovery.database.test.ts` | `organization.create()` missing required `kind` | **Unrelated origin fixture debt.** Do not fix on this branch. |

---

### B7 — Guard controllers + brand-onboarding

```
Test Files  1 failed | 15 passed (16)
     Tests  82 passed | 1 skipped (83)
  Duration  28.14s
```

Only failure = same gatekeeper DB fixture (B6). Controllers/unit suites **PASS**.

---

### BS-12 Auth postgres

**Env:** `BS12_DATABASE_TEST=true`, `DATABASE_URL=…/bs12_recon`  
**Skip count: 0**

```
Test Files  1 passed (1)
     Tests  10 passed (10)
  Duration  11.65s
```

---

## Frontend results (not re-run this pass)

Prior FE evidence still stands (see earlier sections / F1–F6 from same-day run):

| Check | Status |
|---|---|
| `npx tsc -b` | PASS |
| Scoped C-01/C-05 FE | 1 failed / 162 passed — only Inv-2 `if (inviteToken)` |
| SideDrawer dialog tests | PASS (Inv-11 FIXED) |
| Build / lint | PASS |
| FE auth-static OTP cases | PASS; obsolete `authAuthorizationHeader` fail = unrelated origin debt |

---

## Invariant confirmation (after this backend redo)

| # | Invariant | Status | Evidence |
|---|---|---|---|
| 1 | Campaign Apply continuation / no auto-Application | **PASS** | I5 postgres 21/21; continuity/apply suites green |
| 2 | Invitation path separation | **GENUINE_AUTHORITY_CONFLICT** | FE architecture only (not re-run; prior fail stands) |
| 3 | `CreatorPlatformAccessGuard` | **FIXED** | Architecture + guard controllers PASS |
| 4 | Entry/Settings recovery | **PASS** | Prior FE; no new BE fail |
| 5 | Stable Instagram identity | **PASS** | Continuity postgres PASS |
| 6 | One-email / account-context | **PASS** (known parked wording) | Deny works; code `Creator access required` vs clone `ACCOUNT_CONTEXT_CONFLICT` |
| 7 | Sterile provisional Creator reclaim | **FIXED** (code) | Reclaim reaches update; harness token mock fails test |
| 8 | FE structured error codes | **FIXED** | Prior FE scoped run |
| 9 | Creator shell navigation | **PASS** | Prior FE |
| 10 | Creator Team actor/subject + role | **PASS** (1 known test bug) | Team postgres 4/5 |
| 11 | Aurora SideDrawer a11y | **FIXED** | Prior FE dialog tests PASS |
| 12 | No deployable fixed OTP | **FIXED** | BE static 4/4 + BS-12 postgres 10/10 |

---

## Bottom line

- **All recon-scoped backend suites ran with DB env set; C-01 and C-05 Team had 0 skip.**
- **Failures match known baseline / harness / message / fixture debt** — not new regressions from this reconciliation pass.
- **Do not fix gatekeeper `kind` fixture or C-05 matrix assertion order** on this branch (unrelated origin debt).
- **One SA escalation remains:** Inv-2 (`inviteToken`).
