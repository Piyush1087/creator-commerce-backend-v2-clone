# Backend Deployment

- SST app: `creatorshop-be`
- Region: `ap-south-1`
- Dev profile: `creator-dev` · domain: `api.dev.thecreatorshop.in`
- Prod profile: `creator-prod` · domain: `api.thecreatorshop.in`
- Health check: `/health/live`

Run **install, Prisma, and `sst deploy` from WSL** (`~/Work/creator-commerce-backend-v2`), not from `/mnt/c/`.

Stop deploying the **old v1 backend** for the same stage before v2 cutover.

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
2. AWS SSO: `aws sso login --profile creator-dev`
3. **Jumpbox EC2 running** (dev SSM target). Confirm ID if needed:

   ```bash
   export AWS_PROFILE=creator-dev
   node scripts/get-jumpbox-id.mjs
   ```

4. WSL: AWS CLI v2 + [Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html).

---

## Reuse Pulumi (skip slow download)

SST downloads **one shared Pulumi** per WSL user — not per repo. After the first `sst deploy` (frontend or backend), binaries live at:

```text
~/.config/sst/bin/pulumi
```

Check it exists:

```bash
ls -la ~/.config/sst/bin/pulumi
~/.config/sst/bin/pulumi version
```

Before `sst deploy`, point SST at that binary and skip re-install:

```bash
export SST_PULUMI_PATH="$HOME/.config/sst/bin/pulumi"
export SST_SKIP_DEPENDENCY_CHECK=1
export AWS_PROFILE=creator-dev
npx sst deploy --stage dev --print-logs
```

Use the **same Linux user** for frontend and backend deploys (`root` vs `brian` have different `~/.config/sst/`). Windows deploys use a separate path (`%USERPROFILE%\.config\sst\bin`) — WSL cannot reuse that copy.

Optional: add the two `export` lines to `~/.bashrc` after Pulumi is installed once.

If deploy still hangs on “Installing pulumi…”, the first install may be incomplete — wait once, or download manually, then use the exports above.

---

## Dev deploy — full flow (WSL)

Use **two WSL terminals**. Tunnel and Prisma must run in the **same** environment (both WSL, or both Windows — not mixed).

### Terminal A — SSM tunnel (keep open)

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

Replace `--target` if `get-jumpbox-id.mjs` shows a different instance. Session must stay running.

**Windows alternative (same machine as Prisma):**

```powershell
cd D:\Work\cursor-repos\creator-commerce-backend-v2
aws sso login --profile creator-dev
.\scripts\start-dev-tunnel.ps1
```

### Terminal B — migrations, then deploy

```bash
cd ~/Work/creator-commerce-backend-v2
export AWS_PROFILE=creator-dev
```

Point Prisma at the tunnel. Copy **user, password, and database** from `DEV_DATABASE_URL` in `.env` — only host/port change:

```bash
export DATABASE_URL="postgresql://postgres:YOUR_REAL_PASSWORD@localhost:5435/creatorshop_be?schema=public&sslmode=require"
```

> **YOUR_REAL_PASSWORD** is a placeholder. Paste the actual password from your `.env` `DEV_DATABASE_URL` in the terminal only. Never commit it or edit this README with a real password.

Sanity check:

```bash
npx prisma migrate status
```

#### First-time v2 cutover (wipes dev RDS data)

```bash
npx prisma migrate reset --force
```

#### Later deploys (new migrations only)

```bash
npx prisma migrate deploy
```

You can stop the tunnel (`Ctrl+C` in Terminal A) after migrate succeeds.

Deploy (tunnel not required). Reuse Pulumi if already installed (see above):

```bash
export AWS_PROFILE=creator-dev
export SST_PULUMI_PATH="$HOME/.config/sst/bin/pulumi"
export SST_SKIP_DEPENDENCY_CHECK=1
npx sst deploy --stage dev --print-logs
```

Verify:

```bash
curl -s https://api.dev.thecreatorshop.in/health/live
```

---

## Deploy without migrations

If `prisma/migrations` did not change and the dev DB is already up to date:

```bash
export AWS_PROFILE=creator-dev
export SST_PULUMI_PATH="$HOME/.config/sst/bin/pulumi"
export SST_SKIP_DEPENDENCY_CHECK=1
aws sso login --profile creator-dev
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
| `InvalidLeftHandSide` on `.ps1` | Use latest `start-dev-tunnel.ps1` (`param` block is first line) |
| SSM `TargetNotConnected` | Start jumpbox; refresh instance id |
| Stuck on “Installing pulumi…” | `export SST_PULUMI_PATH` + `SST_SKIP_DEPENDENCY_CHECK=1` after `~/.config/sst/bin/pulumi` exists |
| Frontend has Pulumi, backend re-downloads | Deploy both from same WSL user; Windows vs WSL paths differ |

---

## Prod (outline)

- `aws sso login --profile creator-prod`
- Tunnel: `.\scripts\start-db-tunnel.ps1 -Stage prod`
- Do not run `migrate reset` on prod without explicit approval
- `npx sst deploy --stage prod`
