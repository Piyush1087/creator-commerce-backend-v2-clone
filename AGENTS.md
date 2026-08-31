# Backend Agent Directives

These rules apply to every AI agent, schema proposal, API module, and manual
backend change in this repo.

## Mission

Keep the v2 backend clean, typed, modular, and migration-safe. Outside output
from AI tools is a proposal, not repo-ready code.

## Non-Negotiables

- No large catch-all modules.
- No generated API logic pasted directly into `app.module.ts`.
- No `any` unless there is a documented boundary and a narrowing plan.
- No automatic production migrations **except** `RUN_MIGRATIONS_ON_START=true` on prod ECS (same as dev — review migrations before deploy).
- No secrets in source, docs, examples, screenshots, or prompts.
- No schema changes without a migration review.
- No business logic inside controllers.
- No feature code without clear module ownership.

## Required Structure

- `src/main.ts` owns process bootstrap only.
- `src/app.module.ts` wires top-level modules only.
- `src/health` owns health checks.
- `src/prisma` owns Prisma client setup.
- `src/features/<feature-name>` will own real API domains as they are added.
- `prisma/schema.prisma` owns database models.
- `docs/ai-collaboration` owns outside artifact intake and review notes.
- `docs/database` owns schema/migration notes.

## Feature Module Shape

Use this shape for new backend domains:

```text
src/features/<feature-name>/
  <feature-name>.module.ts
  <feature-name>.controller.ts
  <feature-name>.service.ts
  dto/
  schemas/
  types.ts
```

Rules:

- Controllers handle HTTP shape only.
- Services own business logic.
- DTOs/schemas own validation boundaries.
- Prisma access belongs in services or feature repositories when needed.
- Shared helpers move to `src/shared` only after at least two features need them.

## Database Rules

- Start from the clean schema and add only models needed by approved APIs.
- Use clear model names and relation names.
- Do not carry old deprecated schema forward unless explicitly approved.
- Use `npm run db:migrate:dev` locally.
- Use `npm run db:migrate:deploy` manually after review (or rely on ECS auto-migrate on dev/prod deploy).
- Container startup migrations: enabled for **dev and prod** ECS via `RUN_MIGRATIONS_ON_START` in `sst.config.ts`. Documented in `docs/deployment` and `docs/database`.

## Git remotes

Read `BRANCHING.md` before creating branches or opening PRs.

- `origin` (`growth-verse/creator-commerce-backend-v2`) is the source of truth.
- `piyush` (`Piyush1087/creator-commerce-backend-v2-clone`) is a convenience
  mirror for AI-agent review.
- Open PRs to `development` on **origin only**. Do not duplicate PRs on the
  clone.
- Dual-push feature branches to `piyush` only when the clone should see the
  current work. The clone may lag until a catch-up push.

## Definition Of Done

- API module has clear ownership and naming.
- DTOs/types are explicit.
- Prisma changes are documented.
- Build and lint pass.
- Local migration/generate flow is tested when schema changes.
