# Backend Runbook And Tracker

This is the main entrypoint for continuing backend work. Start here before
opening source files, adding APIs, changing Prisma, or asking an AI agent to
generate backend code.

## Current Status

- Repo purpose: clean v2 backend skeleton for TheCreatorShop.
- Current API: root, health, and **`POST /api/v1/discovery/validate`** (brand
  discovery Step 1 gatekeeper).
- Current database: Prisma models for discovery tables plus minimal `User` and
  `Organization` (see `docs/database/brand-discovery-and-users.md`).
- Current migration policy: manual migrations only.
- Current deploy identity: kept as `creatorshop-be`.
- Current env baseline: `PORT`, `STAGE`, `DATABASE_URL`, `DEV_DATABASE_URL`.
- Git status: not initialized/committed by the agent yet.
- Branch policy: long-lived branches are `main` and `development`. Remotes:
  `origin` (growth-verse, source of truth / PRs) and `piyush` (clone mirror).
  See `BRANCHING.md`.

## Completed Setup

- Clean NestJS/TypeScript app.
- Prisma module/service.
- `GET /`.
- `GET /health/live` for load balancer.
- `GET /health` with database check.
- Brand discovery module: `POST /api/v1/discovery/validate`.
- Dockerfile.
- Local Postgres `docker-compose.yml`.
- SST config with old app name/profile/domain conventions.
- Root docs and AI collaboration guardrails.

## Temporary Items To Remove Or Replace Later

Track temporary work here so it does not get forgotten.

| Item | Location | Why It Exists | Remove/Replace When |
| --- | --- | --- | --- |
| Stub industry classifier | `src/features/brand-discovery/discovery-industry.stub.ts` | Real AI classifier not wired yet | Replace with classifier service + async job IDs |
| Placeholder tunnel scripts | `scripts/start-dev-tunnel.ps1`, `scripts/start-prod-tunnel.ps1` | Keep workflow names without guessing DB hosts | v2 DB/tunnel hosts are finalized |
| Root endpoint placeholder | `src/app.controller.ts` | Smoke test for API shell | Real public/root API policy is decided |

## Next Work Queue

Use this list as the default pickup queue.

1. Add auth boundary (session/JWT) and optional `user_id` on discovery creates.
2. Replace stub classifier with approved AI service + async status polling if
   needed.
3. Implement `POST /api/v1/discovery/waitlist` (email capture) using
   `waitlist_leads`.
4. Add contract tests or e2e smoke for discovery responses.
5. Update `docs/database` for every schema/migration decision.
6. Add CI workflow when repo hosting is ready (build, lint, prisma generate).

## Start-Of-Session Checklist

When resuming work:

1. Read this file.
2. Read `AGENTS.md`.
3. Read `BACKEND_DIRECTIVES.md`.
4. Read `BRANCHING.md` before creating or switching branches.
5. Check `Temporary Items To Remove Or Replace Later`.
6. Pick exactly one item from `Next Work Queue` or add a new tracked item here.
7. If using outside AI output, review it with
   `docs/ai-collaboration/backend-review-checklist.md`.
8. If schema changes are involved, update `docs/database`.

## How To Ask For Work

Use this format with teammates or AI agents:

```md
Repo: creator-commerce-backend-v2
Start from: RUNBOOK.md
Task:
Work type: API module | Prisma schema | migration | integration | docs
Feature owner:
Route prefix:
Database changes: yes | no
Docs to read:
- AGENTS.md
- BACKEND_DIRECTIVES.md
- docs/database/README.md
Acceptance checks:
- npm run prisma:generate
- npm run build
- npm run lint
```

## Docs Map

- `README.md` quick repo overview.
- `BRANCHING.md` long-lived branch, remotes (`origin` + `piyush`), and PR policy.
- `AGENTS.md` non-negotiable agent rules.
- `BACKEND_DIRECTIVES.md` module/API/schema naming and structure rules.
- `docs/database/README.md` Prisma and migration workflow.
- `docs/database/brand-discovery-and-users.md` first schema slice notes.
- `docs/api/README.md` OpenAPI index.
- `docs/api/brand-discovery.openapi.yaml` Step 1 discovery contract.
- `docs/deployment/README.md` SST/ECS/domain deployment notes.
- `docs/local-development/README.md` local run commands.
- `docs/ai-collaboration/README.md` process for outside AI/team artifacts.
- `docs/ai-collaboration/backend-review-checklist.md` review checklist.
- `docs/ai-collaboration/team-request-template.md` request template.

## Verification Commands

```bash
npm run prisma:generate
npm run build
npm run lint
```

## Decision Log

| Date | Decision |
| --- | --- |
| 2026-05-13 | Start backend v2 clean instead of carrying old deprecated schema/API mappings. |
| 2026-05-13 | Keep old SST app name/profile/domain conventions for future takeover. |
| 2026-05-13 | Keep migrations manual until deployment flow is reviewed. |
| 2026-05-13 | Use feature-owned modules for future APIs. |
| 2026-05-14 | First domain module: `brand-discovery` with `POST /api/v1/discovery/validate`, Prisma slice for discovery + users, OpenAPI contract, throttling, redacted logs. |
| 2026-08-12 | Dual remotes: PRs to `development` on `origin` only; `piyush` clone is an optional mirror, not a second PR path. |
