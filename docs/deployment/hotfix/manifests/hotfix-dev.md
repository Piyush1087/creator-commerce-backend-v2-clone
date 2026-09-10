# Hotfix manifest — creator-dev

**Status:** READY TO DESCRIBE. Use only when Product names HOTFIX + this manifest.  
**Procedure:** [`../README.md`](../README.md)  
**Live inventory:** [`../../../aws-environments/current-state.md`](../../../aws-environments/current-state.md)

```text
path                     HOTFIX (not sst deploy)
stage name               dev
profile                  creator-dev
account                  841162679642
region                   ap-south-1
sst.app                  creatorshop-be
repos                    creator-commerce-backend-v2
frontend hotfix          NO
sst.config.ts            UNCHANGED
Dockerfile / entrypoint  refuse hotfix if these changed vs running image
playwright lockfile      refuse hotfix if version changed (STOP_PLAYWRIGHT_BUMP)
```

## Tunnel and database

```text
tunnel box               jumpbox (not SST bastion; stage dev has bastion: false)
discover instance        node scripts/get-jumpbox-id.mjs
tunnel script            scripts/start-dev-tunnel.ps1
database                 manual RDS creator-dev-postgres-small
local tunnel             localhost:5435
RUN_MIGRATIONS_ON_START  true on ECS (backup only; schema-first hotfix still tunnels first)
```

Jumpbox is often stopped. Start it only when Prisma detection said schema changed (or for Studio/debug). Code-only hotfix: leave the jumpbox down.

Do not put passwords or `DATABASE_URL` in this file. Copy from local `.env` into the shell only.

## Prisma

```text
detect                   git diff <last-deployed-sha>..HEAD -- prisma/
if no diff               image overlay only; do not migrate
if prisma/ changed       jumpbox tunnel → npm run db:migrate:deploy → then image
if schema without migration  STOP_PRISMA_DRIFT
migrate reset            FORBIDDEN
```

Last-deployed SHA: ECS task / image metadata or the SHA recorded from the last SST or hotfix. Do not ask the human to remember whether Prisma changed.

## Image

```text
base                     current running ECR image for this service (Chromium already present)
playwright install       NEVER
smoke                    GET https://api.dev.thecreatorshop.in/health/live
```

## Refuse / STOP

```text
STOP_WRONG_ACCOUNT
STOP_HOTFIX_NO_SERVICE          (no running ECS api)
STOP_PLAYWRIGHT_BUMP
STOP_SST_OR_DOCKERFILE_CHANGED
STOP_PRISMA_DRIFT
SSO_EXPIRED
```

Do not use this manifest against creator-prod or the prod bastion.
