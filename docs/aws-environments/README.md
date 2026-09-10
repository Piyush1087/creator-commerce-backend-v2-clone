# AWS environments (creator-dev / creator-prod)

**Date:** 2026-09-10  
**Status:** DOCUMENTATION + RECOMMENDATION. No SST or AWS change in this package.  
**Accounts:** `creator-dev` (`841162679642`) · `creator-prod` (`250037328530`) · region `ap-south-1`

This folder is the working picture of how Creator Shop v2 is hosted, what placeholder prod actually is, what a “test on prod” mode would cost, and **what not to do next**. Optional API hotfix procedure (not SST) is [`../deployment/hotfix/`](../deployment/hotfix/).

Software freeze (`docs/ai-collaboration/mvp-canonical-freeze/`) is a separate program. It owns SHAs and product scope. This folder owns AWS accounts, cost, DNS, and deploy *posture*. It does not authorize freeze PASS, production release, or a prod `sst deploy`.

## Standing recommendation

**Keep the current two-account layout. Keep using `creator-dev` for all application testing. Do not touch `creator-prod` until a real production go-live.**

Do not introduce a third SST stage, a TEST_MINI stack in the prod account, or mode-switch automation now. Those ideas are written down so they are not reinvented; they are **not** the next action. Reasons (complexity, usefulness, redundancy, cost) are in [`modes-and-recommendation.md`](./modes-and-recommendation.md).

## How to read

| File | What it is |
| --- | --- |
| [`current-state.md`](./current-state.md) | Live/last audits, placeholder teardown (what was deleted and why), DNS 2026-09-10 |
| [`differential-and-costs.md`](./differential-and-costs.md) | Dev vs prod vs `sst.config.ts`, costs everywhere |
| [`modes-and-recommendation.md`](./modes-and-recommendation.md) | PLACEHOLDER / TEST_MINI / LIVE as a *future* design; how CNAME and migrate would work; recommendation to stay on two accounts |
| [`aws_auditor_ai_worker_initiation.md`](./aws_auditor_ai_worker_initiation.md) | Start the Auditor worker (paste into a new chat) |
| [`aws_deploy_ai_worker_initiation.md`](./aws_deploy_ai_worker_initiation.md) | Start the Deploy worker (paste into a new chat). Default: `--stage dev` only |
| [`aws_hotfix_ai_worker_initiation.md`](./aws_hotfix_ai_worker_initiation.md) | Start the Hotfix worker (paste into a new chat). Optional API overlay; not SST |
| [`charters/`](./charters/) | Principal worker charters (Auditor, Deploy, Hotfix), same layout as dummy_tcs `docs/organization/charters` |
| [`../deployment/hotfix/README.md`](../deployment/hotfix/README.md) | Hotfix procedure + [`manifests/`](../deployment/hotfix/manifests/) (dev ready; prod blocked until LIVE) |

Older cost-fix logs remain at [`../aws-optimization/`](../aws-optimization/). Prefer this folder for “what should we do with prod.”

## Names that must not be mixed

| Name | Meaning |
| --- | --- |
| AWS profile `creator-dev` / `creator-prod` | Credentials / account |
| SST stage `dev` / `prod` | What `npx sst deploy --stage …` targets |
| SST app `creatorshop-be` / `creatorshop-fe` | Backend vs frontend stacks |

Never `sst deploy --stage creator-dev`. That created an orphan stack and was already cleaned up.

Profile mapping in both repos’ `sst.config.ts`: `stage === "prod"` → `creator-prod`, **anything else** → `creator-dev`. A `--stage preview` deploy today would hit **dev**, not prod.

## Migrate (code vs stale docs)

| Stage | `RUN_MIGRATIONS_ON_START` in `sst.config.ts` (2026-09-10) |
| --- | --- |
| `dev` | `true` — ECS entrypoint runs `prisma migrate deploy` |
| `prod` | `false` — no auto-migrate |

`Dockerfile` does not migrate. `scripts/docker-entrypoint.sh` migrates only when that env is `true`. Several older docs (`docs/deployment/README.md`, `AGENTS.md`, `docs/aws-optimization/creator-prod.md`) still say prod auto-migrates. **Code wins.** Leave prod at `false` until an explicit LIVE decision.

## Do not

- `npx sst deploy --stage prod` while prod is a placeholder (SST would create ECS + ALB + Aurora + bastion).
- Use the [hotfix path](../deployment/hotfix/README.md) to plant prod. Hotfix overlays a running image; placeholder has none (`STOP_PROD_HOTFIX_NO_STACK`).
- `prisma migrate reset` on any RDS.
- Put secrets, OTP codes, or connection strings in this folder.
- Treat CloudFront.net / ALB hostnames as a working FE↔BE pair without DNS or hosts (see modes doc).
