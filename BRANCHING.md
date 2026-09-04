# Branching Strategy

This repo uses two long-lived branches:

- `main` - deployment-ready baseline.
- `development` - integration branch for active work before it is promoted to
  `main`.

Use the exact spelling `development`.

## Remotes

Local clones keep two remotes:

| Remote | Repository | Role |
|--------|------------|------|
| `origin` | `growth-verse/creator-commerce-backend-v2` | Source of truth. PRs, `development`, and `main` live here. |
| `piyush` | `Piyush1087/creator-commerce-backend-v2-clone` | Convenience mirror for Piyush / AI-agent review. Not a second integration repo. |

Frontend uses the same pattern (`origin` + `piyush` clone). `dummy_tcs` is a separate repo and is not part of this dual-push.

```bash
git remote -v
# origin  https://github.com/growth-verse/creator-commerce-backend-v2.git
# piyush  https://github.com/Piyush1087/creator-commerce-backend-v2-clone.git
```

## Rules

- New work branches should branch from `development`.
- Merge completed feature/API/schema work back into `development` first.
- Promote `development` to `main` only after review and verification.
- Open pull requests **only on `origin`**, targeting `development`.
- Do **not** open a matching PR on the Piyush clone for every origin PR.
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

After review, merge via GitHub PR on **origin** into `development` (preferred),
or locally:

```bash
git checkout development
git merge feature/<short-task-name>
git push origin development
```

When ready to promote:

```bash
git checkout main
git merge development
git push origin main
```

## Origin vs clone — what to push when

**PRs and `development` / `main`:** origin only.

Keep updating the origin PR as usual. You do **not** need a second PR on
`piyush` every time you PR to `development`. The clone is not the team merge
path.

**Feature branches:** optional dual-push.

Push to `origin` whenever the work should be on GitHub. Push the same branch to
`piyush` when you want the clone / AI agent to see that work:

```bash
git push origin feature/<short-task-name>
git push piyush feature/<short-task-name>
```

If you skip `piyush`, the clone can lag. That is fine.

**Catch-up sync:** when you want the clone to match current local work, push the
branches you care about to `piyush` (feature branches, and `development` /
`main` only if you intentionally want those mirrored). Do not invent a parallel
merge history on the clone.

```bash
git push piyush feature/<short-task-name>
# optional, only when you want clone long-lived branches to catch up:
git push piyush development
```

## In-flight (not yet in `development`)

Hold these until review closes / PR merges. Do **not** base new module work on them
unless the handoff explicitly depends on them.

| Work | Branch (BE + FE) | Status (2026-09-04) |
|------|------------------|---------------------|
| C-01 / C-05 Creator Entry + Settings | `feature/c01-c05-creator-integration` | Under Piyush review (pass-2). **Not** merged to `origin/development`. Resume here for follow-up fixes only. |

Pass-2 tip SHAs (clone review):  
BE `d8a3f23cfac6288b745823b60d8c0e38e3ba8b90` · FE `11cb12b635806983d2f2b2d8ca4b8b3b61da1f43`

---

## Required Checks Before Merge

```bash
npm run prisma:generate
npm run build
npm run lint
```
