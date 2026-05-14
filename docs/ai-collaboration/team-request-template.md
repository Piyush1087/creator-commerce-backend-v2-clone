# Backend Team Request Template

Use this when asking a teammate or AI agent to produce backend work.

```md
Repo: creator-commerce-backend-v2
Work type: API module | Prisma schema | migration | integration | docs
Feature owner:
Route prefix:
Auth required: yes | no | later
Database changes: yes | no
Frontend dependency: yes | no

Required references:
- AGENTS.md
- BACKEND_DIRECTIVES.md
- docs/database/README.md

Expected output:
- Module:
- Controller:
- Service:
- DTOs:
- Schemas/types:
- Prisma model/migration:
- Env vars:
- Docs to update:

Rules:
- Keep controllers thin.
- No secrets.
- No automatic prod migrations.
- No `any`.
- Do not copy old deprecated schema unless explicitly approved.

Acceptance checks:
- npm run prisma:generate
- npm run build
- npm run lint
- endpoint smoke test if routes are added
```
