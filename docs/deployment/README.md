# Backend Deployment

- SST app: `creatorshop-be`
- Region: `ap-south-1`
- Dev profile: `creator-dev` · domain: `api.dev.thecreatorshop.in`
- Prod profile: `creator-prod` · domain: `api.thecreatorshop.in`
- Health check: `/health/live`

Run **install, Prisma, and `sst deploy` from WSL** (`~/Work/creator-commerce-backend-v2`), not from `/mnt/c/`.

Stop deploying the **old v1 backend** for the same stage before v2 cutover.

**Cost optimization:** see [../aws-optimization/creator-dev.md](../aws-optimization/creator-dev.md) for dev audit, savings estimates, and scheduler notes.

---

## Default dev release (current workflow)

For the foreseeable future, **dev RDS migrations run automatically** when ECS starts a new task after `sst deploy`. You do **not** need the jumpbox or a manual `migrate deploy` for routine dev releases.

```bash
cd ~/Work/creator-commerce-backend-v2
export AWS_PROFILE=creator-dev
export SST_SKIP_DEPENDENCY_CHECK=1
aws sso login --profile creator-dev

git pull
npm install
npm run prisma:generate
npm run build

npx sst deploy --stage dev --print-logs
```

Verify:

```bash
curl -s https://api.dev.thecreatorshop.in/health/live
```

### What happens on deploy

1. SST builds the Docker image (includes `prisma/migrations`).
2. ECS rolls out new API task(s) in the VPC with `DATABASE_URL` = `DEV_DATABASE_URL` from `.env`.
3. Container entrypoint (`scripts/docker-entrypoint.sh`) runs **`npx prisma migrate deploy`** when `RUN_MIGRATIONS_ON_START=true` (dev and prod).
4. App starts (`node dist/main.js`).
5. ALB health check passes (`healthCheckGracePeriodSeconds` = 120s to allow migrate time).

Watch ECS logs for:

```text
[entrypoint] RUN_MIGRATIONS_ON_START=true — prisma migrate deploy
[entrypoint] prisma migrate deploy complete
```

| Step | Jumpbox / tunnel? |
|------|-------------------|
| `npm run prisma:generate` | No (local client only) |
| `npx sst deploy --stage dev` | No |
| `prisma migrate deploy` on dev RDS | **Automatic** inside ECS on task start |

**Prod** uses the same auto-migrate on ECS task start (`RUN_MIGRATIONS_ON_START=true`). Review migration SQL before prod deploy; use the jumpbox/tunnel path only as a fallback.

---

## QA creator seed + apply bypass (dev/staging)

Env `CREATOR_APPLY_BYPASS_EMAILS` (SST: defaults to `test@creator.com` on non-prod; empty on prod unless set) forces targeting eligibility for those emails so they can see `ELIGIBLE_ONLY` campaigns and apply.

Login: `test@creator.com` · OTP `123456` when stub OTP is on.  
Local re-seed (Docker DB / tunnel): `npm run db:seed:dev-creator`.  
Details: `docs/campaigns-creator-view/engineering/MARKETPLACE_BACKEND.md`.

---

## Quick reference (when to use what)

| Goal | Command |
|------|---------|
| **Routine dev deploy** (schema + code) | `prisma:generate` → `build` → `sst deploy --stage dev` |
| **Local Docker DB only** | `npm run db:migrate:dev` or `db:migrate:deploy` against `localhost:5432` |
| **Dev RDS manual migrate** (fallback) | Jumpbox tunnel → `DATABASE_URL=localhost:5435` → `db:migrate:deploy` |
| **Prisma Studio on dev RDS** (fallback) | Jumpbox tunnel + `DATABASE_URL=localhost:5435` → `npm run db:studio` |
| **Prod deploy** (schema + code) | `prisma:generate` → `build` → `sst deploy --stage prod` |
| **Prod RDS manual migrate** (fallback) | Bastion tunnel → `DATABASE_URL=localhost:5435` → `db:migrate:deploy` |

---

## Two URLs (do not mix them up)

| Variable | Used for |
|----------|----------|
| `DEV_DATABASE_URL` in `.env` | `npx sst deploy --stage dev` (ECS → RDS inside VPC). **No tunnel.** |
| `DATABASE_URL` you **export in the shell** | `npx prisma migrate …` / Studio from your laptop via jumpbox |

Prisma does **not** read `DEV_DATABASE_URL` unless you copy it into `DATABASE_URL`.

For Prisma through the tunnel, use **`localhost:5435`**, not the RDS hostname and not port `5432`.

**Do not put your real database password in this doc or in git.** Copy user, password, and database name from `DEV_DATABASE_URL` in your local `.env` only.

---

## Prerequisites

1. `.env` with `DEV_DATABASE_URL` and API keys (see `sst.config.ts`).
   For brand onboarding Stage 1A, ensure at least:
   - `ZYTE_API_KEY` (+ optional `ZYTE_API_URL`, `ZYTE_REQUEST_TIMEOUT_MS`)
   - `GEMINI_API_KEY`
   - `PLAYWRIGHT_ENABLED` — leave unset (or `true`) so deployed ECS runs Zyte + Playwright; Docker image installs Chromium
   - OTP stays stubbed on **dev** (`CREATOR/BRAND_VERIFICATION_USE_REAL_OTP` forced `false` in SST for non-prod)
2. AWS SSO:

   ```bash
   aws sso login --profile creator-dev
   ```

3. WSL pre-flight (recommended before deploy):

   ```bash
   cd ~/Work/creator-commerce-backend-v2
   git pull
   npm install
   npm run build
   test -f dist/main.js && echo "OK: dist/main.js exists"
   ```

---

## Dev deploy — `sst deploy` (no tunnel)

ECS tasks connect to RDS via `DEV_DATABASE_URL` in `.env` inside the VPC. You do **not** need the SSM tunnel for deploy or for dev migrations (handled at container start).

```bash
cd ~/Work/creator-commerce-backend-v2
export AWS_PROFILE=creator-dev
export SST_SKIP_DEPENDENCY_CHECK=1
aws sso login --profile creator-dev
npx sst deploy --stage dev --print-logs
```

Optional — confirm the Docker image builds locally:

```bash
docker build -t creatorshop-be-test .
docker run --rm creatorshop-be-test ls -la dist/main.js
```

ECS crash `Cannot find module '/usr/src/app/dist/main.js'` means the image was built without a compiled `dist/main.js` (TypeScript build config or failed `npm run build` in Dockerfile).

---

## Fallback — dev RDS via jumpbox + tunnel (manual migrate)

Keep this path for **debugging**, **Prisma Studio on dev RDS**, or if auto-migrate on ECS is disabled/broken. Requires the dev jumpbox EC2 to be **running** (see EC2 vCPU quota notes below).

### Jumpbox instance

Confirm instance id:

```bash
export AWS_PROFILE=creator-dev
node scripts/get-jumpbox-id.mjs
```

Expected dev jumpbox (verify — do not hardcode if this changes): `i-03447f2aba0c94173` (`temp-dev-db-ssm-jump`).

[Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html) required.

Use **two terminals in the same OS** (both WSL or both Windows — not mixed).

### Terminal A — SSM tunnel (keep open)

**WSL**

```bash
cd ~/Work/creator-commerce-backend-v2
export AWS_PROFILE=creator-dev
aws sso login --profile creator-dev

aws ssm start-session \
  --target i-03447f2aba0c94173 \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["creator-dev-postgres-small.czo4e2u0wc9y.ap-south-1.rds.amazonaws.com"],"portNumber":["5432"],"localPortNumber":["5435"]}' \
  --profile creator-dev \
  --region ap-south-1
```

**Windows PowerShell**

```powershell
cd D:\Work\cursor-repos\creator-commerce-backend-v2
aws sso login --profile creator-dev
.\scripts\start-dev-tunnel.ps1
```

**Tunnel is healthy when you see:**

```text
Port 5435 opened for sessionId ...
Waiting for connections...
```

### Terminal B — Prisma via tunnel

```bash
export DATABASE_URL="postgresql://postgres:YOUR_REAL_PASSWORD@localhost:5435/creatorshop_be?schema=public&sslmode=require"
npx prisma migrate status
npm run db:migrate:deploy
```

> **YOUR_REAL_PASSWORD** — paste from `DEV_DATABASE_URL` in the terminal only.

**Do not run** `npx prisma migrate reset --force` on dev RDS unless you intentionally want to wipe all dev data.

Stop the tunnel with `Ctrl+C` in Terminal A when finished.

### Jumpbox / EC2 quota

If the jumpbox fails to start with `VcpuLimitExceeded`, your account may be at the **Standard On-Demand vCPU** limit. Routine dev deploy **does not require the jumpbox** — use the default `sst deploy` flow above. Resolve quota via AWS Support or resize/stop other EC2 instances if you need the tunnel again.

---

## Deploy without schema changes

If `prisma/migrations` did not change, the same deploy command applies; `migrate deploy` on task start is a no-op when already up to date:

```bash
export AWS_PROFILE=creator-dev
export SST_SKIP_DEPENDENCY_CHECK=1
aws sso login --profile creator-dev
npx sst deploy --stage dev --print-logs
```

---

## Reuse Pulumi (skip slow download)

SST downloads **one shared Pulumi** per WSL user — not per repo. After the first `sst deploy` (frontend or backend), the CLI binary lives at:

```text
~/.config/sst/bin/pulumi
```

To skip SST re-checking/installing Pulumi on each deploy:

```bash
export SST_SKIP_DEPENDENCY_CHECK=1
```

**Do not set** `SST_PULUMI_PATH` to `~/.config/sst/bin/pulumi`. That path is the **binary file**. If you set `SST_PULUMI_PATH` there, SST appends `/bin/pulumi` and fails with:

```text
fork/exec .../pulumi/bin/pulumi: not a directory
```

Use the **same Linux user** for frontend and backend deploys (`root` vs `brian` have different `~/.config/sst/`). Prefer your normal user (`brian`), not `root`.

---

## Local development only (Docker, no tunnel)

```bash
docker compose up -d
# .env DATABASE_URL -> localhost:5432
npm run db:migrate:dev
npm run dev
```

This updates **local** Postgres only, not dev RDS.

---

## Environment variables (`.env`)

```env
DEV_DATABASE_URL=postgresql://...
GEMINI_API_KEY=...
PARALLEL_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
CORS_ORIGINS=http://localhost:5173,https://dashboard.dev.thecreatorshop.in

# Postmark, Razorpay, SETTINGS_FIELD_ENCRYPTION_KEY — see sst.config.ts apiEnvironment
```

Frontend deploy (`creator-commerce-frontend-v2`): set `VITE_RAZORPAY_KEY_ID` in that repo’s `.env` before `sst deploy`.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ErrTopLevelImport` in `sst.config.ts` | Use dynamic `await import(...)` inside `run()`, not top-level imports |
| ECS task exits on startup | Check logs for `prisma migrate` failure; fix migration SQL; optional `PRISMA_MIGRATE_RESOLVE_ROLLED_BACK` env for one-off failed migration recovery |
| `P3018` migration failed on deploy | Fix migration file; set `PRISMA_MIGRATE_RESOLVE_ROLLED_BACK=<migration_name>` in `sst.config.ts` for one deploy, or use jumpbox + `prisma migrate resolve` |
| FK type mismatch (`uuid` vs `text`) | Dev RDS uses `TEXT` ids — migrations must match (`brand_profiles.id`, `users.id`) |
| `P1001` on `localhost:5432` | Start Docker, or you meant dev RDS — use tunnel + `5435` |
| `relation does not exist` on deployed API | Check ECS logs — migrate may have failed on task start |
| SSM `TargetNotConnected` / jumpbox won't start | Use default `sst deploy` flow (no jumpbox); or fix EC2 vCPU quota |
| `pulumi/bin/pulumi: not a directory` | `unset SST_PULUMI_PATH`; use `SST_SKIP_DEPENDENCY_CHECK=1` only |
| Onboarding scan **Failed to fetch** but ECS completes | Redeploy — `idleTimeout` 600s on ALB (`sst.config.ts`) |

---

## Prod go-live

**Profile:** `creator-prod` · **Stage:** `prod` (not the profile name)  
**API:** `api.thecreatorshop.in` · **DB:** Aurora Serverless v2 (0–2 ACU, pause after 15 min) — already in [`sst.config.ts`](../../sst.config.ts).  
**DNS:** `thecreatorshop.in` is on **Wix**, not AWS Route 53. SST has `dns: false` — you must point `api` at the ALB yourself after deploy.

Run install, build, and `sst deploy` from **WSL** (`~/Work/creator-commerce-backend-v2`), not `/mnt/c/`.

**Cost note:** Prod placeholder is ~$2/mo. First backend prod deploy turns on ECS + ALB + Aurora (~$25–40+/mo). See [../aws-optimization/creator-prod.md](../aws-optimization/creator-prod.md).

### Prerequisites

1. `.env` with prod secrets (`JWT_SECRET_PROD`, Postmark, Razorpay, etc.) — see `sst.config.ts` `apiEnvironment`.
2. Migrations reviewed and merged before deploy (ECS runs `prisma migrate deploy` on task start, same as dev).
3. Stop deploying the **old v1 backend** for prod before v2 cutover.
4. `aws sso login --profile creator-prod`

### 1. Deploy backend

```bash
cd ~/Work/creator-commerce-backend-v2
export AWS_PROFILE=creator-prod
export SST_SKIP_DEPENDENCY_CHECK=1
aws sso login --profile creator-prod

git pull
npm install
npm run prisma:generate
npm run build

npx sst deploy --stage prod --print-logs
```

From deploy output, note the **ALB DNS name** (for Wix CNAME below). Aurora is created automatically.

On rollout, each new ECS task runs `prisma migrate deploy` before the app starts (`healthCheckGracePeriodSeconds` = 120s). Watch ECS logs for:

```text
[entrypoint] RUN_MIGRATIONS_ON_START=true — prisma migrate deploy
[entrypoint] prisma migrate deploy complete
```

> **Do not** run `npx prisma migrate reset --force` on prod without explicit approval.

**Fallback — manual migrate via bastion:** if auto-migrate fails or you need to inspect prod DB directly, use `.\scripts\start-db-tunnel.ps1 -Stage prod` (update bastion instance id and Aurora host in that script after first deploy), then `npm run db:migrate:deploy` against `localhost:5435`. See [Fallback — dev RDS via jumpbox + tunnel](#fallback--dev-rds-via-jumpbox--tunnel-manual-migrate) for the same tunnel pattern.

### 2. API DNS (Wix)

SST does **not** update Wix. After deploy:

| Field | Value |
|-------|-------|
| Host / name | `api` |
| Type | CNAME |
| Points to | `<alb-dns-name>.elb.amazonaws.com` from deploy output |

Wix → Domains → `thecreatorshop.in` → DNS records.

While prod is idle, `api` may have **no record** (NXDOMAIN) — that is fine. Add or update the CNAME only when go-live.

ACM cert for `api.thecreatorshop.in` is already in `sst.config.ts`; SST attaches it to the new ALB.

### 3. Verify API

```bash
curl -s https://api.thecreatorshop.in/health/live
# expect: {"status":"ok"}
```

Allow a few minutes for Wix DNS propagation after the CNAME change.

### 4. Deploy frontend (when ready)

From `creator-commerce-frontend-v2` (see that repo’s [deployment README](../../../creator-commerce-frontend-v2/docs/deployment/README.md)):

```bash
cd ~/Work/creator-commerce-frontend-v2
export AWS_PROFILE=creator-prod
export SST_SKIP_DEPENDENCY_CHECK=1
aws sso login --profile creator-prod
npx sst deploy --stage prod --print-logs
```

This wires CloudFront → S3 for `dashboard.thecreatorshop.in` (off SST placeholder if still showing).

### 5. Third-party cutover (checklist)

After API + dashboard are live:

- [ ] Razorpay webhooks: `https://api.thecreatorshop.in/api/v1/webhooks/...`
- [ ] Meta OAuth redirect URIs include `https://dashboard.thecreatorshop.in/...`
- [ ] Google OAuth origins / redirect URIs for prod dashboard
- [ ] Postmark sender domain still valid

Details: [../account-migration/THIRD_PARTY_SERVICES.md](../account-migration/THIRD_PARTY_SERVICES.md)

### Prod quick reference

| Goal | Command / action |
|------|------------------|
| Deploy backend | `npx sst deploy --stage prod` (WSL) — migrate runs on ECS task start |
| Apply schema (fallback) | Bastion tunnel → `npm run db:migrate:deploy` |
| Wire API URL | Wix CNAME `api` → ALB hostname |
| Deploy frontend | `npx sst deploy --stage prod` in frontend-v2 repo |

---
