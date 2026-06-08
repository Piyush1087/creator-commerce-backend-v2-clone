# Backend Deployment

- SST app: `creatorshop-be`
- Region: `ap-south-1`
- Dev profile: `creator-dev` · domain: `api.dev.thecreatorshop.in`
- Prod profile: `creator-prod` · domain: `api.thecreatorshop.in`
- Health check: `/health/live`

Run **install, Prisma, and `sst deploy` from WSL** (`~/Work/creator-commerce-backend-v2`), not from `/mnt/c/`.

Stop deploying the **old v1 backend** for the same stage before v2 cutover.

---

## Quick reference (dev RDS)

Typical release when `prisma/migrations` changed:

1. AWS SSO login + confirm jumpbox is running
2. **Terminal A** — start SSM tunnel (`localhost:5435`)
3. **Terminal B** — export `DATABASE_URL` → `migrate deploy`
4. Stop tunnel
5. **`sst deploy`** (tunnel **not** required; can run on another WSL machine)

| Step | Tunnel required? | Reads from |
|------|------------------|------------|
| `npx prisma migrate deploy` | Yes | `DATABASE_URL` in shell |
| `npx sst deploy --stage dev` | No | `DEV_DATABASE_URL` in `.env` |

---

## Two URLs (do not mix them up)

| Variable | Used for |
|----------|----------|
| `DEV_DATABASE_URL` in `.env` | `npx sst deploy --stage dev` (ECS → RDS inside VPC). **No tunnel.** |
| `DATABASE_URL` you **export in the shell** | `npx prisma migrate …` from your laptop |

Prisma does **not** read `DEV_DATABASE_URL` unless you copy it into `DATABASE_URL`.

For Prisma through the tunnel, use **`localhost:5435`**, not the RDS hostname and not port `5432`.

**Do not put your real database password in this doc or in git.** Copy user, password, and database name from `DEV_DATABASE_URL` in your local `.env` only.

---

## Prerequisites

1. `.env` with `DEV_DATABASE_URL` and API keys (see `sst.config.ts`).
2. AWS SSO:

   ```bash
   aws sso login --profile creator-dev
   ```

3. **Jumpbox EC2 running** (dev SSM target). Confirm instance id:

   **WSL / macOS / Linux**

   ```bash
   export AWS_PROFILE=creator-dev
   node scripts/get-jumpbox-id.mjs
   ```

   **Windows PowerShell**

   ```powershell
   $env:AWS_PROFILE = "creator-dev"
   node scripts/get-jumpbox-id.mjs
   ```

   Expected dev jumpbox (verify — do not hardcode if this changes): `i-03447f2aba0c94173` (`temp-dev-db-ssm-jump`).

4. [Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html) installed (WSL and/or Windows, depending where you run the tunnel).

---

## Dev RDS — tunnel + migrate

Use **two terminals in the same OS**. Tunnel and Prisma must run together — **both WSL** or **both Windows** (not mixed).

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

Replace jumpbox `--target` / `$InstanceId` if `get-jumpbox-id.mjs` shows a different instance.

**Tunnel is healthy when you see:**

```text
Port 5435 opened for sessionId ...
Waiting for connections...
```

Leave Terminal A open until migrate finishes.

### Terminal B — point Prisma at the tunnel

Copy **user, password, and database** from `DEV_DATABASE_URL` in `.env`. Only change host to `localhost` and port to `5435`.

**WSL**

```bash
cd ~/Work/creator-commerce-backend-v2
export AWS_PROFILE=creator-dev

export DATABASE_URL="postgresql://postgres:YOUR_REAL_PASSWORD@localhost:5435/creatorshop_be?schema=public&sslmode=require"
```

**Windows PowerShell**

```powershell
cd D:\Work\cursor-repos\creator-commerce-backend-v2

$env:DATABASE_URL = "postgresql://postgres:YOUR_REAL_PASSWORD@localhost:5435/creatorshop_be?schema=public&sslmode=require"
```

> **YOUR_REAL_PASSWORD** is a placeholder. Paste the actual password from `DEV_DATABASE_URL` in the terminal only. Never commit it or edit this README with a real password.

### Terminal B — sanity check

```bash
npx prisma migrate status
```

### Terminal B — apply migrations (normal deploy — no reset)

Use this for routine deploys when new migration folders exist under `prisma/migrations`:

```bash
npx prisma migrate deploy
```

Equivalent npm script:

```bash
npm run db:migrate:deploy
```

Optional after deploy:

```bash
npx prisma generate
```

**Do not run** `npx prisma migrate reset --force` on dev RDS unless you intentionally want to wipe all dev data.

#### First-time v2 cutover only (wipes dev RDS data)

```bash
npx prisma migrate reset --force
```

### Stop the tunnel

`Ctrl+C` in Terminal A after migrate succeeds.

---

## Dev deploy — `sst deploy` (no tunnel)

ECS tasks connect to RDS via `DEV_DATABASE_URL` in `.env` inside the VPC. You do **not** need the SSM tunnel for deploy.

This step can run on a **different machine** (e.g. migrations from Windows, deploy from WSL) as long as that machine has the repo, `.env`, AWS SSO, and Node deps.

Reuse Pulumi if already installed (see below):

```bash
cd ~/Work/creator-commerce-backend-v2
export AWS_PROFILE=creator-dev
export SST_SKIP_DEPENDENCY_CHECK=1
aws sso login --profile creator-dev
npx sst deploy --stage dev --print-logs
```

Verify:

```bash
curl -s https://api.dev.thecreatorshop.in/health/live
```

### WSL pre-flight (before backend deploy)

On the **same WSL machine** you use for `sst deploy`:

```bash
cd ~/Work/creator-commerce-backend-v2
git pull
npm install
npm run build
test -f dist/main.js && echo "OK: dist/main.js exists"
```

If `dist/main.js` is missing but `dist/src/main.js` exists, `tsconfig.build.json` is wrong — it must set `"rootDir": "src"` (already fixed in repo).

Optional — confirm the Docker image builds:

```bash
docker build -t creatorshop-be-test .
docker run --rm creatorshop-be-test ls -la dist/main.js
```

ECS crash `Cannot find module '/usr/src/app/dist/main.js'` means the image was built without a compiled `dist/main.js` (TypeScript build config or failed `npm run build` in Dockerfile).

---

## Deploy without migrations

If `prisma/migrations` did not change and dev RDS is already up to date:

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

Check it exists and runs:

```bash
ls -la ~/.config/sst/bin/pulumi
~/.config/sst/bin/pulumi version
```

To skip SST re-checking/installing Pulumi on each deploy:

```bash
export SST_SKIP_DEPENDENCY_CHECK=1
```

**Do not set** `SST_PULUMI_PATH` to `~/.config/sst/bin/pulumi`. That path is the **binary file**. If you set `SST_PULUMI_PATH` there, SST appends `/bin/pulumi` and fails with:

```text
fork/exec .../pulumi/bin/pulumi: not a directory
```

If you previously added `SST_PULUMI_PATH` to `~/.bashrc`, remove it:

```bash
unset SST_PULUMI_PATH
```

Use the **same Linux user** for frontend and backend deploys (`root` vs `brian` have different `~/.config/sst/`). Prefer your normal user (`brian`), not `root`. Windows deploys use a separate path (`%USERPROFILE%\.config\sst\bin`) — WSL cannot reuse that copy.

Optional: add `export SST_SKIP_DEPENDENCY_CHECK=1` to `~/.bashrc` after Pulumi is installed once.

If deploy still hangs on “Installing pulumi…”, wait for the first install to finish, or delete a broken install and retry:

```bash
rm -rf ~/.config/sst/bin/pulumi
unset SST_PULUMI_PATH
unset SST_SKIP_DEPENDENCY_CHECK
npx sst deploy --stage dev --print-logs
```

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
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `P1001` on `localhost:5432` | Start Docker, or you meant dev RDS — use tunnel + `5435` |
| `relation does not exist` on deployed API | Migrations not applied to dev RDS (only local Docker) |
| Prisma URL uses RDS hostname from laptop | Use `localhost:5435` while tunnel is open |
| Tunnel works in Windows, migrate fails in WSL | Run tunnel and migrate in the **same** OS |
| `[vite] ws proxy error` / socket errors on frontend | Start local API on `:3000`, or you are on collaboration pages with auth — see frontend env `socketUrl` |
| `InvalidLeftHandSide` on `.ps1` | Use latest `start-dev-tunnel.ps1` (`param` block is first line) |
| SSM `TargetNotConnected` | Start jumpbox EC2; refresh instance id via `get-jumpbox-id.mjs` |
| Tunnel starts but migrate times out | Confirm `Port 5435 opened` in tunnel terminal; check `DATABASE_URL` password matches `DEV_DATABASE_URL` |
| `pulumi/bin/pulumi: not a directory` | `unset SST_PULUMI_PATH` — never point it at the binary; use only `SST_SKIP_DEPENDENCY_CHECK=1` |
| Stuck on “Installing pulumi…” | Wait for first install, or `rm -rf ~/.config/sst/bin/pulumi` and redeploy without `SST_PULUMI_PATH` |
| Frontend has Pulumi, backend re-downloads | Deploy both from same WSL user; Windows vs WSL paths differ |

---

## Prod (outline)

- `aws sso login --profile creator-prod`
- Tunnel: `.\scripts\start-db-tunnel.ps1 -Stage prod`
- Do not run `migrate reset` on prod without explicit approval
- `npx sst deploy --stage prod`
