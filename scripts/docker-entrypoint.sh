#!/bin/sh
set -e

# Dev ECS: RUN_MIGRATIONS_ON_START=true runs migrate deploy before the app (see docs/deployment/README.md).
# Optional recovery: PRISMA_MIGRATE_RESOLVE_ROLLED_BACK=<migration_name> before deploy (one-off failed migration).
#
# TEMPORARY: RUN_SEED_DEV_CREATOR_ON_START=true seeds test@creator.com after migrate (idempotent).
# Remove this block + SST flag + Dockerfile COPY after QA verifies the user on dev.

if [ "${RUN_MIGRATIONS_ON_START}" = "true" ]; then
  if [ -n "${PRISMA_MIGRATE_RESOLVE_ROLLED_BACK}" ]; then
    echo "[entrypoint] prisma migrate resolve --rolled-back ${PRISMA_MIGRATE_RESOLVE_ROLLED_BACK}"
    npx prisma migrate resolve --rolled-back "${PRISMA_MIGRATE_RESOLVE_ROLLED_BACK}"
  fi
  echo "[entrypoint] RUN_MIGRATIONS_ON_START=true — prisma migrate deploy"
  npx prisma migrate deploy
  echo "[entrypoint] prisma migrate deploy complete"
fi

if [ "${RUN_SEED_DEV_CREATOR_ON_START}" = "true" ]; then
  echo "[entrypoint] RUN_SEED_DEV_CREATOR_ON_START=true — seed test@creator.com (TEMPORARY)"
  npx ts-node --transpile-only scripts/seed-dev-creator.ts
  echo "[entrypoint] seed-dev-creator complete"
fi

exec "$@"
