# Backend API image hotfix (optional)

**Status:** DOCUMENTED. No hotfix script in this pass.  
**Default release remains full SST** — [`../README.md`](../README.md) and the [AWS Deploy worker](../../aws-environments/aws_deploy_ai_worker_initiation.md).  
**This path is backend API only.** Frontend SST is already fast enough; do not invent an FE hotfix here.

A hotfix overlays a new API image (and, when Prisma changed, a migrate) onto an **already-running** ECS service. It does not recreate VPC, ALB, RDS/Aurora, or certs. It does not change `sst.config.ts`.

Accounts, standing “do not light up prod,” and live inventory live in [`../../aws-environments/`](../../aws-environments/). Read that folder before any hotfix. Hotfix is **not** a way to create the prod stack.

## Workers and manifests

| File | What it is |
| --- | --- |
| [`../../aws-environments/aws_hotfix_ai_worker_initiation.md`](../../aws-environments/aws_hotfix_ai_worker_initiation.md) | Paste-into-chat start |
| [`../../aws-environments/charters/aws_hotfix_ai_worker_charter.md`](../../aws-environments/charters/aws_hotfix_ai_worker_charter.md) | Principal charter |
| [`manifests/hotfix-dev.md`](./manifests/hotfix-dev.md) | Dev envelope (jumpbox + manual RDS) |
| [`manifests/hotfix-prod.md`](./manifests/hotfix-prod.md) | Prod envelope (**blocked** until a real prod stack exists) |

The operator does not remember whether Prisma changed. The worker (or a future script) diffs `prisma/` against the last deployed SHA and chooses schema-then-image vs image-only.

## When to use this vs SST

| Use | Path |
| --- | --- |
| Routine release, first plant of an env, Dockerfile / `sst.config.ts` / Playwright version change | **Full SST** |
| Already-running ECS, app code (and maybe Prisma) only, skip Chromium download | **Hotfix** (this folder) |

Refuse hotfix and use SST when any of these changed vs the running image: `sst.config.ts`, `Dockerfile`, `scripts/docker-entrypoint.sh`, Playwright version in `package-lock.json`. Those are not an overlay.

## Prisma (detect, then act)

Compare `prisma/` to the last successful SST or hotfix SHA for that stage (ECS task tag, image label, or recorded SHA — do not ask the human to remember).

| Detection | Action |
| --- | --- |
| No `prisma/` diff | Do **not** start jumpbox/bastion. Do **not** `migrate deploy`. Overlay image only. |
| `prisma/` diff (new migrations and/or `schema.prisma`) | **First** tunnel to that env’s DB and `npm run db:migrate:deploy`, **then** overlay the new image. |
| `schema.prisma` changed but no new migration folder | **STOP** (`STOP_PRISMA_DRIFT`). Not a hotfix. |

Live `prisma migrate status` is only required **after** git already said Prisma changed. Do not start the tunnel box on every hotfix just to count migrations.

Additive migrations: schema first, then rolling new tasks, is the intended order. Destructive migrations (drop/rename still read by old tasks) are not safe as a rolling hotfix — STOP and use a planned SST/downtime path.

`prisma migrate reset` is forbidden on every env.

## Chromium

Full SST (`Dockerfile`) installs Playwright Chromium in a **version-keyed layer**. App-only SST rebuilds reuse that layer when the Playwright version is unchanged.

Hotfix **must not** run `playwright install`. Build **from the image already running** in that stage’s ECR (last SST, or last hotfix). Copy new `dist` / needed `node_modules` / `prisma`. `/ms-playwright` and apt browser deps stay.

If Playwright’s lockfile version changed, refuse hotfix (`STOP_PLAYWRIGHT_BUMP`) and use full SST so browsers match the package.

## Dev vs prod (do not mix boxes)

Same decision tree. Different account, tunnel, and migrate flag.

| | Dev hotfix | Prod hotfix |
| --- | --- | --- |
| Manifest | [`manifests/hotfix-dev.md`](./manifests/hotfix-dev.md) | [`manifests/hotfix-prod.md`](./manifests/hotfix-prod.md) |
| Profile / account | `creator-dev` / `841162679642` | `creator-prod` / `250037328530` |
| SST stage (for naming only — hotfix is not `sst deploy`) | `dev` | `prod` |
| Tunnel | Existing **jumpbox** (`scripts/start-dev-tunnel.ps1`, confirm id with `node scripts/get-jumpbox-id.mjs`) | SST **bastion** (`scripts/start-prod-tunnel.ps1` — stub until first LIVE deploy) |
| Database | Manual RDS `creator-dev-postgres-small` | Aurora from SST (does not exist while prod is placeholder) |
| Auto-migrate on new ECS task | `true` (do **not** rely on it for schema-first hotfix) | `false` (tunnel is required if Prisma changed) |
| Available today | When ECS api is running (see [`current-state.md`](../../aws-environments/current-state.md)) | **No.** Placeholder: no ECS, no image, no bastion. First plant is authorized **SST** `--stage prod` (Deploy worker / LIVE), not hotfix. |

Wrong profile or wrong box = wrong database.

## Operator sketch (no script yet)

1. Confirm SSO for the named profile. Confirm `aws sts get-caller-identity` matches the manifest account.
2. Confirm a **running** ECS api service and a current image (prod: if missing, `STOP_PROD_HOTFIX_NO_STACK`).
3. Diff `prisma/` (and Playwright / Dockerfile / `sst.config.ts`) vs last deployed SHA.
4. If Prisma changed: start the **correct** tunnel box, `migrate deploy` against `localhost:5435`, then stop the tunnel when done.
5. Overlay image from current ECR (no Chromium install). Rolling ECS replace.
6. Smoke `GET /health/live` (does **not** prove Postgres).
7. Optional: Auditor refresh of `current-state.md`.

Prefer WSL for Docker/arm64 image work, same as SST. Human runs `aws sso login`.

## Authority

```text
1. Explicit Product assignment (HOTFIX + named manifest)
2. docs/aws-environments/README.md standing recommendation
3. This README + named manifests/
4. Current sst.config.ts (do not change it to hotfix)
5. docs/deployment/README.md (SST default; jumpbox fallback details)
```

Freeze (`docs/ai-collaboration/mvp-canonical-freeze/`) owns product SHAs. This folder does not declare freeze PASS or authorize `development`/`main` merges.
