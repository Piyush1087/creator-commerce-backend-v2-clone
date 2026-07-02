#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS_ON_START}" = "true" ]; then
  if [ -n "${PRISMA_MIGRATE_RESOLVE_ROLLED_BACK}" ]; then
    echo "[entrypoint] prisma migrate resolve --rolled-back ${PRISMA_MIGRATE_RESOLVE_ROLLED_BACK}"
    npx prisma migrate resolve --rolled-back "${PRISMA_MIGRATE_RESOLVE_ROLLED_BACK}"
  fi
  echo "[entrypoint] RUN_MIGRATIONS_ON_START=true — prisma migrate deploy"
  npx prisma migrate deploy
  echo "[entrypoint] prisma migrate deploy complete"
fi

exec "$@"
