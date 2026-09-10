# Current AWS state

**Audited:** prod CLI **2026-09-10** (profile `creator-prod`, account `250037328530`).  
**Dev:** last full audit **2026-08-30** (`docs/aws-optimization/creator-dev.md`). `creator-dev` SSO was **expired** on 2026-09-10 — do not treat the 08-30 snapshot as proven live until the next auditor pass.

No secrets in this file.

## Accounts

| | creator-dev | creator-prod |
| --- | --- | --- |
| Account | `841162679642` | `250037328530` |
| Profile | `creator-dev` | `creator-prod` |
| BE SST | `creatorshop-be` `--stage dev` | `creatorshop-be` `--stage prod` |
| FE SST | `creatorshop-fe` `--stage dev` | `creatorshop-fe` `--stage prod` |
| Intended API | `https://api.dev.thecreatorshop.in` | `https://api.thecreatorshop.in` |
| Intended dashboard | `https://dashboard.dev.thecreatorshop.in` | `https://dashboard.thecreatorshop.in` |
| Public DNS | Dev records (Wix / existing) | Wix for `thecreatorshop.in`. AWS Route 53 has **only** a private `sst.` Cloud Map zone |

## creator-prod live (2026-09-10)

Identity: `arn:aws:sts::250037328530:assumed-role/AWSReservedSSO_AdministratorAccess_…`

| Resource | State |
| --- | --- |
| ECS clusters | **0** |
| ECS services / Fargate | **0** |
| ALB | **0** |
| RDS instances | **0** |
| Aurora clusters | **0** |
| EC2 | **0** (no bastion running) |
| CloudFront | `E3O06GGVRRZSRL` · `dqhsgqysek6if.cloudfront.net` · alias `dashboard.thecreatorshop.in` · origin **`placeholder.sst.dev`** · enabled |
| `https://dashboard.thecreatorshop.in/` | **200** placeholder (not v2 app) |
| `api.thecreatorshop.in` | **NXDOMAIN** |
| ACM `api.thecreatorshop.in` (ap-south-1) | Issued historically; **not attached** (no ALB) |

Cost Explorer (unblended, estimated where noted):

- 2026-08-11 → 2026-09-01: Secrets Manager ~$0.27, ECR ~$0.36, S3/CloudFront crumbs.
- 2026-09-01 → 2026-09-10: Route 53 **$0.50**, Secrets ~$0.11, Tax $0.11, ECR ~$0.02.

Still a **~$2/mo** placeholder, same order of magnitude as the 2026-08-30 optimization note.

## creator-dev last proven (2026-08-30)

Intent: **real test environment** with small resources and a night/weekend stop.

| Resource | Post-fix design |
| --- | --- |
| RDS | Manual `creator-dev-postgres-small` · `db.t4g.small` · Postgres 16 · 20 GiB gp3 · stop 21:00 / start 08:00 IST Mon–Sat · Sunday off |
| ECS API | 1 task, 0.5 vCPU / 1 GB arm64 · **scales to 0** with the DB schedule |
| ALB | Kept (always-on cost) · `api.dev.thecreatorshop.in` |
| Aurora | **None** in AWS. Dev DB URL is `DEV_DATABASE_URL` (manual RDS). SST/Pulumi still listed Aurora until a WSL `sst deploy --stage dev` syncs state |
| Jumpbox | `temp-dev-db-ssm-jump` stopped except for tunnel |
| Orphan `--stage creator-dev` stack | Removed 2026-08-30 |

Scheduler: `scripts/aws-dev-scheduler/` (`stop-dev-db` / `start-dev-db`).

Projected run-rate after those fixes: **~$53–58/mo pre-tax · ~$62–67/mo with tax**. Re-verify on the next `creator-dev` auditor pass.

## What was deleted on prod, and why (placeholder)

Prod was never a live v2 app. The 2026-08-30 pass treated it as a **minimal-cost skeleton** so a later `sst deploy --stage prod` would not start from zero — **without** paying for compute and a database while idle.

Removed or already absent:

| Item | Why |
| --- | --- |
| ECS cluster / service / Fargate | No users. Fargate + ALB is the large bill (~$25–30/mo if left up). |
| ALB | Idle ALB is ~$16/mo. Deleted with compute. |
| Aurora / RDS | No prod data, no need to store or pause a cluster. Serverless v2 idle is still real money (~$15–40+/mo if left “ready”). |
| Running bastion | No DB to tunnel to. |
| API public DNS | After ALB delete, `api.thecreatorshop.in` was left **NXDOMAIN** so the pretty name does not point at a corpse. **Wix is not updated by SST** (`dns: false`). AWS did not delete Wix; the API record is simply gone on the public internet. |

Kept on purpose:

| Item | Why |
| --- | --- |
| VPC skeleton | First real prod deploy is faster; pennies. |
| ACM certs | `api.thecreatorshop.in` (ap-south-1) and dashboard cert (us-east-1 for CloudFront). |
| CloudFront + S3 assets bucket | Dashboard hostname still answers. Origin is SST **placeholder**, not the v2 build. |
| SST / Pulumi state, ECR | Required to deploy later. |
| Dashboard CNAME | Still `dashboard.thecreatorshop.in` → `dqhsgqysek6if.cloudfront.net`. |

**Deleting the ALB does not delete Wix CNAMEs.** If an API CNAME had been left pointing at the old ELB hostname, public DNS would still have a record whose *target* was dead. Today `api` is NXDOMAIN — the Wix **name** is absent, which is the clean placeholder.

## Config vs live (trap)

[`sst.config.ts`](../../sst.config.ts) (backend) still **declares** for `--stage prod`:

- VPC with **bastion**
- Aurora Serverless v2 (0–2 ACU, pause 15 minutes)
- ECS API 0.5 vCPU / 1 GB, HTTPS ALB, cert for `api.thecreatorshop.in`, `dns: false`
- `RUN_MIGRATIONS_ON_START=false`

A routine `npx sst deploy --stage prod` is not “refresh the placeholder.” It is **create the full billed stack** (ECS + ALB + Aurora + bastion). That is why this folder’s recommendation is: do not deploy to prod until go-live is an explicit decision.

Frontend `sst.config.ts` on `--stage prod` builds with `VITE_API_URL=https://api.thecreatorshop.in` and CloudFront alias `dashboard.thecreatorshop.in`. CORS default on prod API is that dashboard origin only.

## DNS 2026-09-10 (public)

Queried via `8.8.8.8`:

| Name | Result |
| --- | --- |
| `api.thecreatorshop.in` | NXDOMAIN |
| `dashboard.thecreatorshop.in` | CNAME `dqhsgqysek6if.cloudfront.net` (TTL 3600) → CloudFront A records |

That CloudFront id matches the live prod distribution. The CNAME is valid. The page is the placeholder, not v2.
