# Commands to run — Chat Home V1 origin integration

Do **not** run against production or shared AWS databases.

**Playbook:** [`../MODULE-AUDIT-TESTING-PLAYBOOK.md`](../MODULE-AUDIT-TESTING-PLAYBOOK.md)  
**Part 1 report:** [`integration-part1-report.md`](./integration-part1-report.md)  
**Part 1 results:** [`integration-part1-test-results.md`](./integration-part1-test-results.md)

Working tree: `integration/chat-home-v1` in both repos.

### Non-negotiables

- **Do not skip DB tests** when recording Part 1 evidence. Set the env flags below so `describe.skipIf` does not skip.
- Disposable Docker Postgres only (`creatorshop-postgres-v2`, user `postgres`, password `password`, host **`127.0.0.1`**).
- Record named failures (file + case + expected/actual + `PASS`/`FIXED`/`GENUINE_AUTHORITY_CONFLICT`/`ENVIRONMENT_BLOCKED`).
- Do **not** modify Gatekeeper, OTP Product behavior, pricing, DE, Collaboration, or C-01/C-05 as part of this module (merge hygiene restores of origin files only if the merge dropped them).

### Postgres suite kinds

| Kind | Suites | Prep |
|------|--------|------|
| **Self-seeding** | Chat conversation, Chat HTTP, Brand workspace auth | Create empty disposable DB → `migrate deploy` → run (tests create rows) |
| **Pre-seeded fixture** | P5-A consumers, P5-B Brand Home postgres | Exact DB name `chat_home_p3_module_boundary_01` **with clone acceptance fixture rows** (ledger). Empty migrate-only DB is **not** enough → `ENVIRONMENT_BLOCKED` until fixture restored |

---

## 0. Disposable DBs

```powershell
docker start creatorshop-postgres-v2

$base = "postgresql://postgres:password@127.0.0.1:5432"
foreach ($db in @(
  "chat_home_integ",                 # migration rehearsal
  "chat_home_p3_integ",              # self-seeding Chat conversation + HTTP
  "bs07_chat_home_integ",            # workspace auth (bs07_* name required)
  "chat_home_p3_module_boundary_01"  # P5-A/P5-B name required; needs fixture seed
)) {
  # CREATE DATABASE if missing, then:
  $env:DATABASE_URL = "$base/$db"
  npx prisma migrate deploy
}
```

Integrated tip has **more than 66** migrations (origin `development` + history). Handoff: do not require exact 66. Harness on this branch uses `toBeGreaterThanOrEqual(66)`.

---

## 1. Backend — static / build

From `d:\Work\cursor-repos\creator-commerce-backend-v2`:

```powershell
npx prisma validate
npx prisma generate
npx nest build
git diff --check
```

Optional (CLI may require `--source` / `--commit` on this line):

```powershell
npm run intelligence:contracts:verify
```

---

## 2. Backend — unit / architecture (no DB)

```powershell
npx vitest run --config vitest.config.ts `
  src/features/chat `
  src/features/brand-home `
  src/features/intelligence-consumer `
  src/features/brand-centre/brand-workspace-authorization.service.test.ts
```

---

## 3. Backend — self-seeding postgres (**skip count 0**)

```powershell
$base = "postgresql://postgres:password@127.0.0.1:5432"
$env:CHAT_HOME_DATABASE_TEST = "true"
$env:CHAT_HOME_P3_DATABASE_TEST = "true"
$env:BRAND_WORKSPACE_DATABASE_TEST = "true"
$env:DATABASE_URL = "$base/chat_home_p3_integ"

npx vitest run --config vitest.config.ts `
  src/features/chat/conversation/chat-conversation.postgres.test.ts `
  src/features/chat/chat-http.postgres.test.ts `
  2>&1 | Tee-Object docs/handoff-audit/.logs/chat-home-be-pg-self-seed.log

$env:DATABASE_URL = "$base/bs07_chat_home_integ"
npx vitest run --config vitest.config.ts `
  src/features/brand-centre/brand-workspace-authorization.postgres.test.ts `
  2>&1 | Tee-Object docs/handoff-audit/.logs/chat-home-be-pg-bs07.log
```

---

## 4. Backend — P5-A / P5-B fixture postgres

Only when `chat_home_p3_module_boundary_01` has the **acceptance fixture** (fixed user/brand IDs from ledger), not empty migrate:

```powershell
$env:CHAT_HOME_P5_A_DATABASE_TEST = "true"
$env:CHAT_HOME_P5_B_DATABASE_TEST = "true"
$env:DATABASE_URL = "postgresql://postgres:password@127.0.0.1:5432/chat_home_p3_module_boundary_01"

npx vitest run --config vitest.config.ts `
  src/features/chat/chat-p5a-consumers.postgres.test.ts `
  src/features/brand-home/brand-home.postgres.test.ts
```

If fixture is absent: leave flags on (so not skipped), record **ENVIRONMENT_BLOCKED**, do not invent seed data that changes Product semantics.

---

## 5. Frontend — typecheck / scoped / build

From `d:\Work\cursor-repos\creator-commerce-frontend-v2`:

```powershell
npx tsc -b

npx vitest run --config vitest.config.ts `
  src/features/chat `
  src/features/brand-dashboard `
  src/features/auth/navigation/brand-destination-navigation.test.ts `
  2>&1 | Tee-Object ..\creator-commerce-backend-v2\docs\handoff-audit\.logs\chat-home-fe-scoped.log

npm run build
npm run lint   # optional for Part 1 if time-boxed; note if deferred
```

---

## 6. UI smoke

Local Brand Home + Chat click-through when backend+frontend run locally. Not a substitute for Part B deployed smoke. Record rows in Part 1 test-results if executed.

---

## What to paste back

```text
Test Files  xx passed | yy failed (zz)
     Tests  aa passed | bb failed | cc skipped (dd)
```

Include command name and whether **skip count was 0** for DB suites.

---

## 7. Part B — Dev deploy (only after human auth)

**Gate packet:** [`integration-candidate-gate.md`](./integration-candidate-gate.md)  
**Runbook:** [`docs/deployment/README.md`](../../deployment/README.md)

Do **not** run until:

1. `INTEGRATION_MERGE_AUTHORIZED` — PR/merge `integration/chat-home-v1` → `origin/development`, freeze SHAs  
2. `DEV_DEPLOY_AUTHORIZED` — then D1–D3 below  

Production requires separate `PRODUCTION_RELEASE_AUTHORIZED` + exact SHAs.

### D0 — Preflight (no deploy)

Confirm tip SHAs, Gemini intent `gemini-3.5-flash`, pending migrations vs target DB, WSL path (not `/mnt/c/`).

### D1 — Backend `sst deploy --stage dev` (WSL)

```bash
# From WSL clone of backend (not /mnt/c/)
export AWS_PROFILE=creator-dev
npx sst deploy --stage dev
```

Verify deployed task env includes **`GEMINI_MODEL=gemini-3.5-flash`** (SST default / Secrets).

Identity: API `https://api.dev.thecreatorshop.in`, health `/health/live`.

### D2 — Deployed backend smoke

- `/health/live` and `/health/ready`  
- Authenticated Brand Chat / Brand Home happy path against **dev**  
- Cross-brand deny still holds  

### D3 — Frontend `sst deploy --stage dev` (WSL)

```bash
export AWS_PROFILE=creator-dev
npx sst deploy --stage dev
```

Dashboard: `https://dashboard.dev.thecreatorshop.in` — Brand Home + Chat smoke.
