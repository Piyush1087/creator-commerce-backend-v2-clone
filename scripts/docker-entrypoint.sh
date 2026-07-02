#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS_ON_START}" = "true" ]; then
  echo "[entrypoint] RUN_MIGRATIONS_ON_START=true — prisma migrate deploy"
  npx prisma migrate deploy
  echo "[entrypoint] prisma migrate deploy complete"
fi

exec "$@"
