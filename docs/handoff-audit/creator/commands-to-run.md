# Commands to run (C-01 / C-05 origin branch)

Do **not** run these against production or any shared AWS database.

**Playbook:** [`../MODULE-AUDIT-TESTING-PLAYBOOK.md`](../MODULE-AUDIT-TESTING-PLAYBOOK.md)  
**Pass-2 results:** [`reconciliation-pass-2-test-results.md`](./reconciliation-pass-2-test-results.md)  
**Pass-2 matrix:** [`reconciliation-pass-2-report.md`](./reconciliation-pass-2-report.md)

Paste the last status block of each command (pass/fail counts, or the error)
back into chat, or drop the full log into `docs/handoff-audit/.logs/` and tell
me the filename.

Working tree: `feature/c01-c05-creator-integration` in both repos.

### Non-negotiables

- **Do not skip DB tests.** Set `C01_I*_DATABASE_URL` / `C05_TEAM_DATABASE_TEST` so skip count is **0**.
- Disposable Docker Postgres only (`creatorshop-postgres-v2`, user `postgres`, password `password`, host **`127.0.0.1`**).
- Record named failures (file + case + expected/actual).
- Do not “fix” Gatekeeper / pricing / DE / Collaboration unless the mail says so.

---

## 0. Disposable DBs (once per machine / after wipe)

```powershell
docker start creatorshop-postgres-v2
# create if missing: c01_i1_recon … c01_i5_recon, c05_team_recon
$base = "postgresql://postgres:password@127.0.0.1:5432"
foreach ($db in @("c01_i1_recon","c01_i2_recon","c01_i3_recon","c01_i4_recon","c01_i5_recon","c05_team_recon")) {
  $env:DATABASE_URL = "$base/$db"
  npx prisma migrate deploy
}
```

If I1 hits `token_digest` unique constraint:

```powershell
docker exec creatorshop-postgres-v2 psql -U postgres -d c01_i1_recon -c 'TRUNCATE TABLE creator_entry_continuations CASCADE;'
```

---

## 1. Backend — Prisma

From `d:\Work\cursor-repos\creator-commerce-backend-v2`:

```powershell
npx prisma validate
npx prisma generate
```

Expected migrations on this branch: **82**.

---

## 2. Backend — build + auth static

```powershell
npx nest build
npx vitest run --config vitest.config.ts src/features/auth/auth-security.static.test.ts
```

---

## 3. Backend — scoped C-01 (0 skip)

```powershell
$base = "postgresql://postgres:password@127.0.0.1:5432"
$env:C01_I1_DATABASE_URL = "$base/c01_i1_recon"
$env:C01_I2_DATABASE_URL = "$base/c01_i2_recon"
$env:C01_I3_DATABASE_URL = "$base/c01_i3_recon"
$env:C01_I4_DATABASE_URL = "$base/c01_i4_recon"
$env:C01_I5_DATABASE_URL = "$base/c01_i5_recon"
$env:DATABASE_URL = "$base/c01_i1_recon"

npx vitest run --config vitest.config.ts src/features/creator-entry src/features/c01-persistence 2>&1 |
  Tee-Object -FilePath docs/handoff-audit/.logs/recon-pass2-be-c01.log
```

---

## 4. Backend — scoped C-05 (0 skip)

```powershell
$base = "postgresql://postgres:password@127.0.0.1:5432"
$env:C05_TEAM_DATABASE_TEST = "true"
$env:DATABASE_URL = "$base/c05_team_recon"

npx vitest run --config vitest.config.ts src/features/creator-settings src/shared/team 2>&1 |
  Tee-Object -FilePath docs/handoff-audit/.logs/recon-pass2-be-c05.log
```

---

## 5. Backend — lint / full suite (optional / noisy)

Lint: code rules may be clean while Prettier debt remains (~1042). Do **not** `eslint --fix` on this branch.

```powershell
npm test 2>&1 | Tee-Object -FilePath docs/handoff-audit/.logs/be-full-npm-test.log
```

Full `npm test` is **not** required for pass-2 mail closeout (scoped + build + static are).

---

## 6. Frontend — typecheck + scoped C-01/C-05

From `d:\Work\cursor-repos\creator-commerce-frontend-v2`:

```powershell
npx tsc -b

npx vitest run --config vitest.config.ts `
  src/features/creator-onboarding `
  src/features/creator-campaigns `
  src/features/creator-payout-settings `
  src/shared/creator `
  src/layouts/app-shell `
  src/features/settings/components/creator `
  src/features/brand-onboarding `
  src/shared/api/parse-api-error.test.ts 2>&1 |
  Tee-Object -FilePath ..\creator-commerce-backend-v2\docs\handoff-audit\.logs\recon-pass2-fe-c01-c05.log
```

Architecture-only gate (Inv-1/2):

```powershell
npx vitest run --config vitest.config.ts src/features/creator-onboarding/creator-entry-architecture.test.ts
```

---

## 7. Frontend — build + lint

```powershell
npm run build
npm run lint
```

---

## 8. Frontend — Brand Settings / full suite (optional)

```powershell
npx vitest run --config vitest.config.ts src/features/settings/components/brand src/features/settings/components/shared-account-security.architecture.test.ts src/features/settings/api/brand-settings-client.test.ts
npm test
```

---

## 9. UI smoke

Local click-through: [`ui-verification.md`](./ui-verification.md) (C-01 then C-05).  
Pass-2 automated closeout used **prior** R1, R3–R6 (2026-09-03). Re-walk only if Product asks.

---

## What to paste back

```text
Test Files  xx passed | yy failed (zz)
     Tests  aa passed | bb failed (cc)
```

Include command name + whether **skip count was 0** for DB suites.

Skip AWS, `db:tunnel:prod`, live Meta, and `RUN_MIGRATIONS_ON_START` changes.
