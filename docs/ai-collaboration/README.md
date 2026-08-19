# Backend AI Collaboration Workflow

Use this folder to manage backend output from AI Studio, schema agents, API
agents, or teammate proposals before it becomes source code.

## Standard Flow

1. Receive artifact: API plan, Prisma schema, generated Nest module, integration
   notes, or migration proposal.
2. Save or summarize it in this folder.
3. Review it against `AGENTS.md` and `BACKEND_DIRECTIVES.md`.
4. Decide whether to accept, split, redo, or reject.
5. If accepted, implement inside a feature module and document database/env
   changes.
6. Run build/lint and Prisma generate when relevant.

## Recent intakes

- `2026-08-13-collaboration-clone-reconcile.md` — Canonical Collaboration from
  frozen clone commit `13ce652` into developer backend-v2.
- `2026-05-14-brand-onboarding-journey-intake.md` — Step 1 discovery API + schema
  extraction from the product onboarding markdown.

## Naming Convention

```text
YYYY-MM-DD-source-topic.md
2026-05-13-ai-studio-brand-profile-api-review.md
2026-05-13-schema-agent-campaign-model-notes.md
```

## Team Prompting Rule

When asking for backend work, include:

- target repo and branch
- API feature owner
- route prefix
- request/response DTOs
- Prisma models involved
- migration expectation
- env vars needed
- acceptance checks
