# Hotfix manifest — creator-prod

**Status:** BLOCKED until `docs/aws-environments/current-state.md` shows a running ECS api, an ECR image that already contains Chromium, Aurora, and an SST bastion.

Hotfix is **not** the first prod deploy. The first plant is an authorized **SST** `--stage prod` (AWS Deploy worker, LIVE/go-live assignment). Until that exists, return:

```text
STOP_PROD_HOTFIX_NO_STACK
```

If Product has not named LIVE/go-live, the standing recommendation still applies — do not create the stack in order to hotfix:

```text
STOP_PROD_NOT_AUTHORIZED
```

**Procedure:** [`../README.md`](../README.md)  
**Live inventory:** [`../../../aws-environments/current-state.md`](../../../aws-environments/current-state.md)  
**Standing rec:** [`../../../aws-environments/README.md`](../../../aws-environments/README.md)

```text
path                     HOTFIX (not sst deploy)
stage name               prod
profile                  creator-prod
account                  250037328530
region                   ap-south-1
sst.app                  creatorshop-be
repos                    creator-commerce-backend-v2
frontend hotfix          NO
sst.config.ts            UNCHANGED
Dockerfile / entrypoint  refuse hotfix if these changed vs running image
playwright lockfile      refuse hotfix if version changed (STOP_PLAYWRIGHT_BUMP)
```

## Once a real prod stack exists

```text
tunnel box               SST bastion (bastion: true on --stage prod). Not the dev jumpbox.
tunnel script            scripts/start-prod-tunnel.ps1 (placeholder until instance id/host exist)
database                 SST Aurora (not creator-dev-postgres-small)
local tunnel             localhost:5435 (same local port pattern; different host behind SSM)
RUN_MIGRATIONS_ON_START  false — if Prisma changed, tunnel migrate is required
```

Do not put passwords, Aurora hostnames, or bastion instance ids in this file until they exist; then record **ids only** in aws-environments current-state, not secrets.

## Prisma

```text
detect                   git diff <last-deployed-sha>..HEAD -- prisma/
if no diff               image overlay only; do not start bastion; do not migrate
if prisma/ changed       bastion tunnel → npm run db:migrate:deploy → then image
if schema without migration  STOP_PRISMA_DRIFT
migrate reset            FORBIDDEN
```

Prod will not migrate on new task start. Skipping the tunnel when Prisma changed ships new code against the old schema.

## Image

```text
base                     current running ECR image for this service (Chromium from the LIVE SST plant)
playwright install       NEVER
smoke                    GET https://api.thecreatorshop.in/health/live
                         (NXDOMAIN until Wix api CNAME exists — that is LIVE cutover, not hotfix)
```

## Refuse / STOP

```text
STOP_PROD_NOT_AUTHORIZED        (no LIVE assignment; do not light up placeholder)
STOP_PROD_HOTFIX_NO_STACK       (LIVE not planted: no ECS/image/bastion)
STOP_WRONG_ACCOUNT
STOP_HOTFIX_NO_SERVICE
STOP_PLAYWRIGHT_BUMP
STOP_SST_OR_DOCKERFILE_CHANGED
STOP_PRISMA_DRIFT
SSO_EXPIRED
```

Never point this manifest at the creator-dev jumpbox or `DEV_DATABASE_URL`.
