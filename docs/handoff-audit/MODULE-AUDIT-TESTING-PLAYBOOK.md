# Module audit & testing playbook (reusable)

Use this for **any** origin module port / reconciliation cycle (C-01/C-05 pattern).
Copy the file set below into `docs/handoff-audit/<area>/` and fill it ΓÇö do not invent ad-hoc filenames.

Creator example that already follows this: `docs/handoff-audit/creator/`.

---

## 1. Required files per module area

| File | Purpose |
|---|---|
| `README.md` | Branch, clone SHAs, gate before merge, pointers |
| `commands-to-run.md` | Exact PowerShell commands; operator paste target |
| `origin-run-log.md` | Chronological command batches + paste tails |
| `ui-verification.md` | Local click-through (R1ΓÇªRn); operator-only |
| `reconciliation-report.md` | Invariant-by-invariant: PASS / FIXED / GENUINE_AUTHORITY_CONFLICT / ENVIRONMENT_BLOCKED |
| `reconciliation-test-results.md` | Exact suite counts, named fails, SHAs, skip count |
| `NN-<module-slug>/handoff-summary.md` | Module handoff summary |
| `NN-<module-slug>/checklist-compliance.md` | Checklist vs Product |
| `NN-<module-slug>/clone-refs-verification.md` | Clone SHA / path verification |
| `NN-<module-slug>/automated-test-results.md` | Per-module copy of origin counts |
| `../.logs/` | TeeΓÇÖd full logs (`recon-*`, `be-*`, `fe-*`) |

**Later correction passes:** add **new** files
`reconciliation-pass-N-report.md` + `reconciliation-pass-N-test-results.md`.
**Never overwrite** pass-1 (or earlier) reconciliation docs.

---

## 2. Status vocabulary (every invariant)

Return **exactly** one of:

| Status | Meaning |
|---|---|
| `PASS` | Already matched accepted authority; no change this pass |
| `FIXED` | Was wrong/missing; corrected this pass; evidenced by tests |
| `GENUINE_AUTHORITY_CONFLICT` | Accepted clone/Product vs origin cannot be resolved without SA |
| `ENVIRONMENT_BLOCKED` | Could not prove (missing disposable DB, secrets, flaky fixture pollution) ΓÇö **not** a Product conflict |

Every invariant section in the report must include: status, evidence (files + tests), and files changed if FIXED.

---

## 3. Hard rules for running tests

1. **Do not skip database tests.** Set the suiteΓÇÖs env flags / `*_DATABASE_URL`s so postgres suites run (`skip count: 0`). Document env in test-results.
2. **Disposable local Postgres only** (e.g. Docker `creatorshop-postgres-v2`). Never production / shared AWS.
3. Prefer **`127.0.0.1`** when a suite refuses `localhost`.
4. Migrate each disposable DB (`prisma migrate deploy`) before scoped postgres runs.
5. If a unique-constraint / leftover-row flake appears: truncate the dirty table (or recreate that DB), re-run **that** file, record both the blocked run and the clean run.
6. **Scoped suites first** (module paths), then typecheck / build / lint. Full `npm test` only when asked ΓÇö it is slower and noisier with unrelated origin debt.
7. **Named failures required:** file path, case title, expected vs actual, class (policy / harness / assertion-order / env / out-of-scope).
8. Lint: report code-rule errors separately from Prettier format debt. Do **not** `eslint --fix` whole trees on integration branches unless asked.
9. Build: Nest `npx nest build` (BE); `npx tsc -b` + `npm run build` (FE).
10. UI smoke: only where locally executable; cite `ui-verification.md` rows. If not re-run, say **prior PASS** with date ΓÇö do not invent clicks.
11. Do **not** fix unrelated origin debt (Gatekeeper fixtures, pricing, DE, Collaboration, etc.) unless the mail/scope says so.

---

## 4. Standard command shape (adapt paths)

### Backend

```powershell
cd <backend-repo>
npx prisma validate
npx prisma generate
# per disposable DB:
$env:DATABASE_URL = "postgresql://postgres:password@127.0.0.1:5432/<db_name>"
npx prisma migrate deploy

npx nest build
npx vitest run --config vitest.config.ts <module-paths...>

# tee
npx vitest run ... 2>&1 | Tee-Object -FilePath docs/handoff-audit/.logs/<label>.log
```

### Frontend

```powershell
cd <frontend-repo>
npx tsc -b
npx vitest run --config vitest.config.ts <feature-paths...>
npm run build
npm run lint
```

Paste final `Test Files` / `Tests` blocks into `*-test-results.md`.

---

## 5. Report template (invariant section)

```markdown
### N. <Invariant name> ΓÇö **PASS|FIXED|GENUINE_AUTHORITY_CONFLICT|ENVIRONMENT_BLOCKED**

**Evidence:**
- <file / behavior>
- Tests: <path> ΓÇö <result>

**Fix applied:** (only if FIXED)
- ΓÇª

**Files changed:**
```
path/to/file
```
```

Close with a **Summary Table**, **Remaining named failures**, **Changed files**, and **exact SHAs** (committed HEAD + note if uncommitted).

---

## 6. Test-results template (minimum sections)

1. Exact SHAs (BE/FE)
2. Env for postgres (URLs/flags, **skip count: 0**)
3. Backend: build, static security, scoped module suites, named fails table
4. Frontend: tsc, scoped vitest, build, lint, named fails
5. UI smoke (or ΓÇ£prior / not re-runΓÇ¥)
6. Invariant confirmation table mirroring the report
7. Log file names under `.logs/`

---

## 7. Gate before merge (any module)

1. Commands in area `commands-to-run.md` executed with **0 skip** on required DB suites
2. Results in `reconciliation-*-test-results.md` (or pass-N)
3. Matrix in `reconciliation-*-report.md` with the four statuses only
4. UI rows in `ui-verification.md` where Product requires them
5. Unrelated debt explicitly listed as left / out of scope
6. Commit + push only when operator asks; then replace working-tree SHAs with final commit SHAs
