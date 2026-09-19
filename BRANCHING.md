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

## Current deploy / promotion map (keep updated)

Snapshot date: **2026-09-19** (afternoon). Branch names below are exact; do not invent aliases.

### Long-lived lines (not the current deploy pair)

| Line | Exact branch | Role right now |
|------|--------------|----------------|
| Integration (legacy) | `development` | Ordinary merge target later. **Kept as-is.** Do **not** park Meta / freeze / Postmark / C-06 work here yet. |
| Future integration candidate | `canonical-development` | New long-lived tip cut from freeze (same SHA as freeze at creation). Candidate to replace `development` later; **do not** merge into `development` until Parent says so. |
| Production baseline | `main` | Older promote line. **Not** what creator-dev / creator-prod are tracking for the MVP canonical pair. |

### Deploy pair — MVP Canonical (includes canonical data, **excludes C-06**)

Exact branch on **both** repos: `freeze/mvp-canonical-application-v1`

| Repo | Exact branch | `origin` tip (2026-09-19) | C-06? |
|------|--------------|---------------------------|-------|
| Backend | `freeze/mvp-canonical-application-v1` | `3b7f63f` | **No** — C-06 is not in this history |
| Frontend | `freeze/mvp-canonical-application-v1` | `6ea628b` | **No** — C-06 is not in this history |

| Environment | AWS profile / stage | Deploy from |
|-------------|---------------------|-------------|
| **creator-dev** | `creator-dev` / `--stage dev` | FE + BE `freeze/mvp-canonical-application-v1` |
| **creator-prod** | `creator-prod` / `--stage prod` | **Same** FE + BE freeze pair (paired; do not promote one side alone) |

This freeze pair **already includes** the MVP canonical Brand application. It does **not** include C-06 Creator Payouts.

Do **not** merge freeze into `development` or `main` until Parent / product says so.
Freeze registers: `docs/ai-collaboration/mvp-canonical-freeze/`.

### Active side work — Postmark mail + Meta App Review — `origin` only (not `piyush`, not `development`)

Same tip is recorded on **two** backend branch names so either label can be used in review:

| Branch | Role |
|--------|------|
| `feature/postmark-notification-copy` | Primary feature label: notification copy, Postmark tags, deep-link alignment, Postmark message catalog, Meta App Review doc refresh |
| `docs/meta-app-review` | Same commits; keep for Meta App Review track naming |

| Repo | Branches to push | Notes |
|------|------------------|-------|
| Backend | `feature/postmark-notification-copy` + `docs/meta-app-review` | Push **`origin` only** (no `piyush` for this track) |
| Frontend | `docs/meta-app-review` | Meta / Brand Centre docs map; no Postmark code on FE |

**How to land Postmark into the deploy pair:**

1. Open origin PR: `feature/postmark-notification-copy` → `freeze/mvp-canonical-application-v1`.
2. After merge, move `canonical-development` forward to the new freeze tip when you want that line current.
3. Do **not** merge into `development` as part of this track.
4. Env deploys stay on the **freeze** pair above.

### C-06 Creator Payouts (side integration — parked, still OUT of freeze)

Exact branch on **both** repos: `integration/c06-creator-payouts`

| Repo | Exact branch | `origin` tip (2026-09-19) |
|------|--------------|---------------------------|
| Backend | `integration/c06-creator-payouts` | `11ce7f6` |
| Frontend | `integration/c06-creator-payouts` | `e9ba66d` |

Related (not the integration line; do not confuse):

| Kind | Exact branch | Notes |
|------|--------------|-------|
| Earlier provider-disabled work (clone) | `c06/creator-payouts-provider-disabled-v1` | Historical / piyush mirror |
| Gate-B reconcile (clone) | `reconcile/mvp-canonical-application-v1-gate-b-c06-backend` / `…-frontend` | Scratch only |

**Gate order (do not skip):**

1. **Product approve** C-06 scope / UX / provider posture.
2. **Reconcile** FE + BE `integration/c06-creator-payouts` against the then-current freeze (or later `canonical-development` / `development`) tip.
3. **Then** merge the reconciled pair into the chosen integration line (origin PRs).
4. **Then** promote to prod only after that merge is accepted.

Until steps 1–2 pass: keep C-06 only on `integration/c06-creator-payouts`. Do **not** fold into freeze, `docs/meta-app-review`, `feature/postmark-notification-copy`, `canonical-development`, `development`, creator-dev, or creator-prod.

---

## Required Checks Before Merge

```bash
npm run prisma:generate
npm run build
npm run lint
```
