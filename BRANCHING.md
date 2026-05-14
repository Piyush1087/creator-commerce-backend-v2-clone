# Branching Strategy

This repo uses two long-lived branches:

- `main` - deployment-ready baseline.
- `development` - integration branch for active work before it is promoted to
  `main`.

Use the exact spelling `development`.

## Rules

- New work branches should branch from `development`.
- Merge completed feature/API/schema work back into `development` first.
- Promote `development` to `main` only after review and verification.
- Do not deploy from both old and v2 repos to the same SST stage at the same
  time.
- Keep `RUNBOOK.md` updated when temporary work, APIs, or schema decisions
  change.
- Run migrations manually only after schema review.

## Suggested Flow

```bash
git checkout development
git pull
git checkout -b feature/<short-task-name>
```

After review:

```bash
git checkout development
git merge feature/<short-task-name>
```

When ready to promote:

```bash
git checkout main
git merge development
```

## Required Checks Before Merge

```bash
npm run prisma:generate
npm run build
npm run lint
```
