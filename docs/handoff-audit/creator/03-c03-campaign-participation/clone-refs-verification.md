# C-03 clone refs vs origin integration

## Took from accepted C-03 tip (merge / path authority)

| Area | Source |
|------|--------|
| Campaign applications / opportunities / creator-entry Apply surfaces | BE tip `aebeb85` |
| Brand-UCE C-03 persistence guards + P11* postgres suites | BE tip `aebeb85` |
| Collaboration provision / approved-application handoff + historicalContext | tip + origin union |
| FE `src/features/creator-campaigns` | FE tip `82ed3c9` |
| C-03 migrations `2026091012*` | tip, then patched for origin lineage |

## Kept on origin (did not overwrite)

| Area | Why |
|------|-----|
| Brand Home / Chat Home modules | Already on `development`; mail excluded re-litigation |
| Collaboration Phase 1+ surface already on origin | Union with tip handoff; do not drop origin stages |
| Origin migration history through Chat Home / C-01 / C-05 | Tip assumed thinner ancestor; migrations had to skip/align overlapping enums/columns |
| FE app-shell / Aurora conventions | Origin shell ownership |

## Schema / migration deltas applied on origin (surgical)

- `20260910120000_c03_campaign_asset_brief_convergence` — skip recreating types/columns already present; nullable-align commercials where needed
- `20260910122000_c03_application_handoff_notifications` — skip re-adding `source_application_id`; keep C-03-only pieces
- `prisma/schema.prisma` — optional `briefId`, Notification workspace/creator-scope unique, NotificationJob optional workspace (merge safety)

## Explicit non-actions

| Item | Why |
|------|-----|
| Force-push / rewrite `origin/development` | Growth-verse SoT; PRs only |
| Duplicate PR on `piyush` clone | BRANCHING.md: PRs to origin only |
| AWS bootstrap / prod migrate | Mail + playbook: out of C-03 acceptance; separately authorized |
| Full `npm test` as merge gate | Playbook: scoped + build + lint first; full suite noisy with unrelated origin debt |
| Treat mail “ancestor” claim as literal | Origin already had Chat Home + C-01/C-05 |
