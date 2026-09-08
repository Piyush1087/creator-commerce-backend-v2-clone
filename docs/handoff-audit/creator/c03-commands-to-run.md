# Commands to run — C-03 origin integration

Do **not** run against production or shared AWS databases.

**Module packet:** [`03-c03-campaign-participation/`](./03-c03-campaign-participation/)  
**Playbook:** [`../MODULE-AUDIT-TESTING-PLAYBOOK.md`](../MODULE-AUDIT-TESTING-PLAYBOOK.md)  
**Run log:** [`c03-origin-run-log.md`](./c03-origin-run-log.md)

Branches: BE/FE `integration/c03-campaign-participation`.

### Non-negotiables

- Disposable Docker Postgres only (`creatorshop-postgres-v2`, user `postgres`, password `password`).
- Many C-03 suites require host **`localhost`** (not `127.0.0.1`) and **exact** DB names.
- Postgres lanes: set flags so **skip count is 0**.
- Tee into `docs/handoff-audit/.logs/c03-*.log` and paste tails into `c03-origin-run-log.md`.

---

## Already green (no need to re-run unless you want confirmation)

BE unit 4959 · P5 · P11A–E · P12 · P13 · P14 legacy · Nest build.  
See `03-c03-campaign-participation/automated-test-results.md`.

---

## Remaining — Backend lint (prettier off)

From `d:\Work\cursor-repos\creator-commerce-backend-v2`:

`npm run lint` always includes Prettier (`eslint-plugin-prettier/recommended`). For the **code-rule** gate used on C-01/C-05:

```powershell
npx eslint "{src,test}/**/*.ts" --rule "prettier/prettier: off" 2>&1 |
  Tee-Object -FilePath docs/handoff-audit/.logs/c03-be-lint-prettier-off.log
```

- Exit 0 + little/no output = code rules clean (TS 5.9 vs eslint-parser support warning is OK).
- Do **not** `eslint --fix` / `npm run format` on this branch.
- Optional: `npm run lint` still shows ~1000+ prettier-only nits — classify as format debt, not a C-03 product fail.

```powershell
# Optional noisy full suite (expect unrelated origin debt)
# npm test 2>&1 | Tee-Object -FilePath docs/handoff-audit/.logs/c03-be-full-npm-test.log
```

Re-confirm postgres lanes after further code edits (example P14 + P11B):

```powershell
$base = "postgresql://postgres:password@localhost:5432"
$env:C03_P11B_DATABASE_TEST = "true"
$env:DATABASE_URL = "$base/c03_p11b_fresh"
npx vitest run --config vitest.config.ts src/features/brand-uce/persistence/c03-p11b-application-snapshot.postgres.test.ts 2>&1 |
  Tee-Object -FilePath docs/handoff-audit/.logs/c03-be-p11b-confirm.log

$env:C03_P11B_DATABASE_TEST = $null
$env:C03_P14_DATABASE_TEST = "true"
$env:DATABASE_URL = "$base/c03_p14_handoff"
npx vitest run --config vitest.config.ts `
  src/features/campaign-applications/application-handoff.postgres.test.ts `
  src/features/collaboration/legacy-handoff-regression.postgres.test.ts 2>&1 |
  Tee-Object -FilePath docs/handoff-audit/.logs/c03-be-p14-confirm.log
```

If P11C unique-digest flakes: drop/recreate `c03_p11c_fresh`, `prisma migrate deploy`, re-run with `C03_P11C_DATABASE_TEST=true`.

---

## Remaining — Frontend (not run yet — do these)

From `d:\Work\cursor-repos\creator-commerce-frontend-v2`:

```powershell
npx tsc -b 2>&1 | Tee-Object -FilePath ..\creator-commerce-backend-v2\docs\handoff-audit\.logs\c03-fe-tsc.log

npx vitest run --config vitest.config.ts src/features/creator-campaigns 2>&1 |
  Tee-Object -FilePath ..\creator-commerce-backend-v2\docs\handoff-audit\.logs\c03-fe-creator-campaigns.log

npm run build 2>&1 | Tee-Object -FilePath ..\creator-commerce-backend-v2\docs\handoff-audit\.logs\c03-fe-build.log

npm run lint 2>&1 | Tee-Object -FilePath ..\creator-commerce-backend-v2\docs\handoff-audit\.logs\c03-fe-lint.log
```

Mail allows unchanged FE lint baseline **26 errors / 13 warnings** — record actual counts; do not treat that baseline as a C-03 product fail.

Optional broader FE creator regression (C-01/C-05 overlap):

```powershell
npx vitest run --config vitest.config.ts `
  src/features/creator-onboarding `
  src/features/creator-campaigns `
  src/layouts/app-shell 2>&1 |
  Tee-Object -FilePath ..\creator-commerce-backend-v2\docs\handoff-audit\.logs\c03-fe-creator-scoped.log
```

---

## After green FE

1. Paste tails into `c03-origin-run-log.md`.
2. Update `03-c03-campaign-participation/automated-test-results.md` FE rows.
3. Ask for commit / push / PR to **`origin/development`** when ready.
4. **Do not** deploy AWS/prod from this packet.

---

## What to paste back

```text
Test Files  xx passed | yy failed (zz)
     Tests  aa passed | bb failed (cc)
```

Plus lint error/warning counts and whether postgres **skip was 0**.
