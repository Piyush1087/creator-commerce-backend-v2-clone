# AWS optimization — creator-dev

## Status (2026-08-30)

| Area | State |
|------|-------|
| Audit | Complete (CLI, read-only) |
| Fixes #1–2, #4–5 | **Applied in AWS** |
| Fix #3 (Aurora prod-only) | **Config committed** · SST state sync **pending** |
| Pending action | One `npx sst deploy --stage dev` from **WSL** |
| Prod audit | Not started — log in with `creator-prod` when ready |

---

## Context

| Field | Value |
|-------|-------|
| AWS profile | `creator-dev` |
| Account ID | `841162679642` |
| Region | `ap-south-1` |
| SST backend | `creatorshop-be` · stage **`dev`** |
| SST frontend | `creatorshop-fe` · stage **`dev`** |
| API | `api.dev.thecreatorshop.in` |
| Dashboard | `dashboard.dev.thecreatorshop.in` |
| Last audit | **2026-08-30** |
| Last fixes | **2026-08-30** |

**Deploy:** `npx sst deploy --stage dev` — never `--stage creator-dev` (that was an orphan stack).

**Dev DB:** manual RDS `creator-dev-postgres-small` via `DEV_DATABASE_URL` in `.env`. Aurora is **prod-only** in [`sst.config.ts`](../../sst.config.ts).

**Dev schedule (DB + ECS):**

| Event | When (IST) | Lambda |
|-------|------------|--------|
| Stop | 9 PM Mon–Sat | `stop-dev-db` → RDS stop + ECS `desiredCount=0` |
| Start | 8 AM Mon–Sat | `start-dev-db` → RDS start (wait) + ECS `desiredCount=1` |
| Sunday | Off all day | No start rule |

Scheduler source: [`scripts/aws-dev-scheduler/`](../../scripts/aws-dev-scheduler/) · redeploy Lambdas: `.\scripts\aws-dev-scheduler\deploy.ps1`

---

## Cost impact summary

Figures from **Cost Explorer Aug 2026 MTD** (estimated, ap-south-1). Tax excluded unless noted.

### Baseline (before fixes)

| Line item | Aug MTD | Notes |
|-----------|---------|-------|
| **Total** | **~$87** | incl. ~$11.89 tax |
| ALB | $16.40 | Always on — unchanged |
| RDS (`t4g.small`, scheduled) | $16.04 | Already on night/weekend stop |
| VPC / public IPv4 | $13.73 | Largest avoidable slice was orphan bastion + ECS task IP |
| ECS Fargate | $9.97 | Was **24/7** while DB slept |
| ECR `sst-asset` | $4.30 | ~491 images, no lifecycle |
| EC2 | ~$3.26 | Included orphan `t4g.nano` bastion 24/7 |
| Route 53 | $1.50 | |
| Secrets Manager | $0.74 | Aurora proxy secrets |
| CloudFront + S3 | ~$0.15 | Leave as-is |

**Pre-tax baseline:** ~**$75/mo** run-rate.

### Estimated savings (fixes applied)

| Fix | Est. monthly saving | Confidence | When it shows up |
|-----|---------------------|------------|------------------|
| Remove orphan `creator-dev` stack (bastion + extra VPC/IP) | **$6–8** | High | Immediate |
| ECS scale-to-0 with DB schedule (~54% fewer Fargate hours) | **$8–10** | High | Immediate |
| ECR lifecycle (cap 60 images, expire untagged >14d) | **$2–3** | Medium | Over 2–4 weeks as images expire |
| Delete Aurora proxy secret | **~$0.40** | High | Immediate |
| Delete empty legacy S3 buckets | **<$0.50** | High | Immediate |
| **Total** | **~$17–22/mo** | | **~23–29%** off pre-tax baseline |

### Projected run-rate (after fixes settle)

| | Pre-tax | With tax (~16%) |
|--|---------|-----------------|
| **Before** | ~$75/mo | ~$87/mo |
| **After (est.)** | **~$53–58/mo** | **~$62–67/mo** |

**Not saved (by design):** ALB (~$16), scheduled RDS (~$16), Route 53 (~$1.50). Further cuts would need ALB removal (not worth it for dev) or RDS class/downsize (deferred — stay on `t4g.small`).

**Risk avoided (not in table):** Aurora prod-only in config prevents accidental recreation (**~$20–40+/mo** if the next deploy re-provisioned serverless v2).

---

## Post-fix infrastructure (live)

_Last verified 2026-08-30 after fixes._

| Resource | State |
|----------|-------|
| ECS `api` | `desiredCount=0`, `runningCount=0` (Sunday / post-stop) |
| RDS `creator-dev-postgres-small` | `stopped` |
| Aurora clusters | **None** |
| Aurora proxy secrets | **Deleted** |
| RDS subnet group `creatorshop-be-dev-coresubnetgroup` | **Kept** — manual RDS uses it |
| Orphan `creator-dev` SST stack | **Removed** (backend `sst remove`; frontend bucket/state manual) |
| Orphan tags remaining | ~4 (terminated bastion volume/SG) — no compute, ~$0 |
| ECR lifecycle on `sst-asset` | **Active** |
| Active files bucket | `creatorshop-v2-files-dev` |
| Active frontend bucket | `creatorshop-fe-dev-reactappassets-caztffes` |
| Jumpbox `temp-dev-db-ssm-jump` | **Stopped** (only for manual tunnel) |

**API now:** `503` when ECS is 0 (expected). `/health/live` does not check Postgres.

**SST/Pulumi dev state:** still lists `sst:aws:Aurora::core` until deploy completes — see [Pending](#pending).

---

## Current audit (baseline 2026-08-30)

Historical snapshot taken **before** fixes. Use [Post-fix infrastructure](#post-fix-infrastructure-live) for live state.

<details>
<summary>Full pre-fix audit (click to expand)</summary>

### Cost Explorer (Aug 1–29 MTD)

Total ~$87 incl. tax. Top: ALB $16.40, RDS $16.04, VPC $13.73, ECS $9.97, ECR $4.30.

### RDS

- `creator-dev-postgres-small` · `db.t4g.small` · Postgres 16 · 20 GiB gp3
- Stop 9 PM / start 8 AM Mon–Sat IST; Sunday off
- 14-day metrics: ~4% CPU avg, 2–3 connections, ~1 GiB free RAM of 2 GiB, CPU credits hit 0 on busy days → **stay on `small`**, defer `micro`

### ECS (pre-fix)

- 1 Fargate task 24/7 · 0.5 vCPU / 1 GB arm64 · min=max=1
- Ran overnight/Sunday while DB stopped; ALB showed healthy via `/health/live`

### Orphan `creator-dev` stage (pre-fix)

- Duplicate VPC, 24/7 `t4g.nano` bastion, empty ECS cluster, empty S3 buckets
- Root cause: deploy used `--stage creator-dev` instead of `--stage dev`

### Other

- No NAT Gateway (good)
- No Aurora clusters in AWS (SST artifacts + config drift remained)
- CloudFront ~$0 · frontend not worth changing

</details>

---

## Recommendations

### Done (2026-08-30)

| # | Item | Est. saving |
|---|------|-------------|
| 1 | Remove orphan `creator-dev` SST stage | $6–8/mo |
| 2 | ECS scale-to-0 with DB schedule | $8–10/mo |
| 3 | Aurora prod-only in `sst.config.ts` | Risk avoid $20–40+/mo |
| 4 | ECR lifecycle on `sst-asset` | $2–3/mo (ramp) |
| 5 | Delete empty S3 buckets | <$0.50/mo |

### Deferred (optional later)

| # | Item | Est. saving | Notes |
|---|------|-------------|-------|
| 6 | RDS stay on `t4g.small` | — | Metrics support current choice |
| 7 | RDS backup retention 7 → 3 days | $1–2/mo | Dev data disposable |
| 8 | Disable Performance Insights on dev RDS | $1–3/mo | |
| 9 | Delete legacy S3 buckets (non-empty) | <$1/mo | `btfvebmx` (510), `bzwcruft` (32), `local-test` (850) — confirm no old URLs |
| 10 | Frontend CloudFront / S3 | — | ~$0 — leave as-is |

---

## Final fix log

| # | Action | Result | Date |
|---|--------|--------|------|
| 1 | `npx sst remove --stage creator-dev` (backend) | VPC, bastion, Aurora, buckets removed | 2026-08-30 |
| 1 | Frontend orphan cleanup (Windows SST CLI failed) | Bucket + SST state deleted manually | 2026-08-30 |
| 2 | Updated `start-dev-db` / `stop-dev-db` Lambdas + IAM | ECS scales 1↔0 with RDS | 2026-08-30 |
| 2 | Invoked `stop-dev-db` on Sunday | ECS at 0; API 503 until Monday 8 AM | 2026-08-30 |
| 3 | `sst.config.ts` Aurora prod-only | Local config committed | 2026-08-30 |
| 3 | Deleted `creatorshop-be-dev-coreProxySecret` | Done | 2026-08-30 |
| 4 | ECR lifecycle policy on `sst-asset` | Active | 2026-08-30 |
| 5 | Deleted empty buckets `bfnaabut`, `brian-filesbrianbucket` | Done | 2026-08-30 |

---

## Pending

### Required: SST deploy from WSL

Pulumi dev state **still references Aurora**. Without one deploy, the next code release could recreate Aurora.

```bash
cd ~/Work/creator-commerce-backend-v2
export AWS_PROFILE=creator-dev
export SST_SKIP_DEPENDENCY_CHECK=1
aws sso login --profile creator-dev
npm run build   # if needed
npx sst deploy --stage dev --print-logs
```

**Expected:** Aurora resources dropped from dev stack. Subnet group delete may fail (manual RDS uses it) — **keep the subnet group**.

**Not needed:** another `sst remove --stage creator-dev`.

### Monday verification

```bash
aws sso login --profile creator-dev
aws ecs describe-services --cluster creatorshop-be-dev-apiclusterCluster --services api \
  --query "services[0].{desired:desiredCount,running:runningCount}" --region ap-south-1
curl -s https://api.dev.thecreatorshop.in/health/live
# expect desired=1, running=1, HTTP 200 after 8 AM IST
```

### Re-check costs (optional, ~2 weeks after fixes)

Cost Explorer → monthly by service → compare to Aug baseline (~$75 pre-tax).

---

## Prod next

When logged into **`creator-prod`** (`250037328530`):

1. Create `docs/aws-optimization/creator-prod.md` (same section layout).
2. Run read-only CLI inventory (whole account).
3. Compare to dev — prod has minimal resources in place for fast cutover.

---

## Discussion

| # | Decision | Outcome |
|---|----------|---------|
| 1 | Remove orphan `creator-dev` stage | Approved · done |
| 2 | ECS scale-to-0 with DB | Approved · done |
| 3 | Aurora prod-only in SST | Approved · config done, deploy pending |
| 4 | ECR lifecycle | Approved · done |
| 5 | Delete empty S3 only | Approved · done |
| RDS class | Stay on `t4g.small` | Deferred — metrics support it |
