# Creator Commerce Backend

Clean backend skeleton for TheCreatorShop.

This repo keeps the old deployment identity and database connection shape while
removing legacy APIs, workers, queues, third-party integrations, and the old
Prisma schema.

## Start Here

Use `RUNBOOK.md` as the main tracker and session entrypoint. It records current
status, temporary items, next work, docs references, and decision history.

## Stack

- NestJS 10
- Prisma
- PostgreSQL
- Docker
- SST ECS/Aurora

## Local Setup

```bash
npm install
cp .env.example .env
docker compose up -d
npm run prisma:generate
npm run start:dev
```

The local database URL is:

```text
postgresql://postgres:password@localhost:5432/thecreatorshop?schema=public
```

## Scripts

- `npm run start:dev` starts the Nest API locally.
- `npm run dev` is the short alias for `npm run start:dev`.
- `npm run build` builds to `dist`.
- `npm run prisma:generate` regenerates the Prisma client.
- `npm run db:migrate:dev` creates and applies local dev migrations.
- `npm run db:migrate:deploy` applies existing migrations manually.
- `npm run db:studio` opens Prisma Studio.

## Project Layout

- `src/main.ts` API bootstrap.
- `src/app.module.ts` root Nest module.
- `src/health` health endpoints.
- `src/prisma` shared Prisma service.
- `prisma` clean schema and future migrations.
- `docs` operational and setup notes.

## Deployment Notes

The SST app name, AWS profiles, region, domains, and certificates intentionally
match the old backend repo. Do not deploy from both old and v2 repos to the
same stage at the same time.

Migrations are intentionally not run automatically in Docker or SST. Run them
manually only after reviewing the target database.

## Agent Instructions

Before adding generated or teammate code, read:

- `AGENTS.md`
- `BRANCHING.md`
- `BACKEND_DIRECTIVES.md`
- `docs/ai-collaboration/README.md`
- `docs/database/README.md`
