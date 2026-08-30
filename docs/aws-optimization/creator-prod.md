# AWS optimization — creator-prod

## Status (2026-08-30)

| Area | State |
|------|-------|
| Audit | **Complete** (CLI, read-only) |
| Intent | **Minimal-cost placeholder** — no live prod app yet |
| Serverless Aurora | **Removed** (no RDS clusters/instances) |
| Fixes | **P1 cleanup applied** (2026-08-30) |

---

## Context

| Field | Value |
|-------|-------|
| AWS profile | `creator-prod` |
| Account ID | `250037328530` |
| Region | `ap-south-1` |
| SST backend | `creatorshop-be` · stage **`prod`** |
| SST frontend | `creatorshop-fe` · stage **`prod`** |
| API | `api.thecreatorshop.in` |
| Dashboard | `dashboard.thecreatorshop.in` |
| Last audit | **2026-08-30** |

**Prod intent:** Keep DNS, certs, and a **lean SST skeleton** (VPC, frontend CDN) so `sst deploy --stage prod` is fast when ready — **without** paying for ECS, ALB, RDS, or Aurora while idle.

**Differs from dev:** No DB stop/start schedules. No manual RDS yet. Backend compute (ECS + ALB) **removed**. Aurora serverless **removed**.

**SST config today** ([`sst.config.ts`](../../sst.config.ts)): Aurora prod-only · bastion on prod VPC · `RUN_MIGRATIONS_ON_START=true` on dev and prod ECS.

---

## Cost impact summary

From **Cost Explorer Aug 2026 MTD** (estimated). Prod is already cheap.

### Current run-rate

| Service | Aug MTD | Notes |
|---------|---------|-------|
| Route 53 | $0.50 | Hosted zone / records |
| Secrets Manager | $0.37 | Aurora proxy secret artifact |
| ECR `sst-asset` | $0.53 | ~116 images, no lifecycle |
| ALB (residual) | $0.12 | ALB **deleted**; small residual billing |
| VPC | $0.05 | Skeleton VPC, no NAT, no running EC2 |
| ECS | $0.01 | No cluster/service; task-def revisions only |
| RDS | ~$0 | No instances/clusters |
| CloudFront | ~$0 | Placeholder origin |
| S3 | ~$0.01 | Frontend assets bucket |
| Tax | $0.29 | |
| **Total** | **~$2/mo** | incl. tax |

**Pre-tax:** ~**$1.70/mo**. This is already near-minimal for “keep prod ready.”

### If prod were fully deployed (future — not current)

Rough comparison for planning only (not billed today):

| Component | Idle placeholder (now) | Full prod (future est.) |
|-----------|------------------------|-------------------------|
| ECS + ALB | ~$0 | ~$25–30/mo (1 task + ALB) |
| RDS / Aurora | ~$0 | ~$15–40+/mo depending on choice |
| VPC / IPv4 | ~$0.05 | ~$5–15/mo |
| CloudFront + S3 | ~$0 | ~$0–5/mo traffic-dependent |

---

## Current audit (2026-08-30)

### Live endpoints

| URL | Result | Notes |
|-----|--------|-------|
| `https://api.thecreatorshop.in/health/live` | **NXDOMAIN** (no public DNS record) | DNS is on **Wix**, not AWS Route 53. Record removed or never repointed after ALB delete. |
| `https://dashboard.thecreatorshop.in/` | **200** | CloudFront serves **`placeholder.sst.dev`** — not the S3 frontend bucket |

### Compute — none running

| Resource | Count / state |
|----------|----------------|
| ECS clusters | **0** |
| ECS services | **0** |
| Fargate tasks | **0** |
| EC2 instances | **0** (no bastion running) |
| ALB | **0** |
| Orphan target group | **0** (deleted 2026-08-30) |
| ECS task definitions | **~58 revisions** (historical, no active service) |

### Database — none

| Resource | State |
|----------|-------|
| RDS instances | **0** |
| Aurora clusters | **0** |
| Aurora artifacts (SST) | Subnet group, cluster PG, instance PG, Secrets Manager `creatorshop-be-prod-coreProxySecret` |

### Network

| Resource | State |
|----------|-------|
| SST VPC | `vpc-0fae337daeaf1bab0` · `creatorshop-be-prod-vpc2 VPC` |
| Default VPC | `vpc-0afd9983dfbc6f5b5` |
| NAT Gateway | **0** |
| Elastic IPs | **0** |
| Subnets / IGW / route tables | Present (SST skeleton) |

### Frontend

| Resource | State |
|----------|-------|
| CloudFront | `E3O06GGVRRZSRL` → alias `dashboard.thecreatorshop.in` |
| Origin | **`placeholder.sst.dev`** (not prod S3) |
| S3 bucket | `creatorshop-fe-prod-reactappassets-bemzvdxm` — has `index.html`, `assets/` (Nov 2025 build) |

### Certificates

| Cert (ap-south-1) | Status | In use |
|-------------------|--------|--------|
| `api.thecreatorshop.in` | ISSUED | **No** (ALB gone) |

### Storage & registry

| Bucket / repo | Role |
|---------------|------|
| `creatorshop-fe-prod-reactappassets-bemzvdxm` | Frontend build artifacts |
| `sst-asset-vfuutdokxeau` | SST deploy assets |
| `sst-state-vfuutdokxeau` | Pulumi/SST state |
| `do-not-delete-ssm-diagnosis-*` | AWS support/diag — leave |
| ECR `sst-asset` | ~**116** images · **lifecycle policy applied** (2026-08-30) |

### Other

| Item | State |
|------|-------|
| EventBridge DB/ECS schedules | **None** (correct for prod placeholder) |
| CloudWatch log group | `/sst/cluster/creatorshop-be-prod-apiclusterCluster/api/api` · ~470 KB · 30-day retention |
| Lambda | None for scheduling |

### Architecture snapshot (today)

```text
dashboard.thecreatorshop.in → CloudFront → placeholder.sst.dev (200, not real app)
api.thecreatorshop.in       → DNS → deleted ALB hostname (broken)

AWS (prod account):
  VPC skeleton (no compute)
  Aurora metadata only (no cluster)
  Frontend S3 (unused by CloudFront origin)
  ECR images + SST state
```

---

## Recommendations

Ranked for **placeholder prod** — discuss before any changes.

### P0 — Understand / accept (no action now)

| # | Item | Cost | Notes |
|---|------|------|-------|
| 1 | **~$2/mo placeholder is reasonable** | ~$2/mo | Route 53 + secret + ECR + VPC crumbs. Cheaper than redeploying from zero later. |
| 2 | **Broken API DNS is expected** | — | No ALB until first prod backend deploy. Dashboard 200 is **placeholder**, not v2 app. |
| 3 | **Do not copy dev stop/start schedules** | — | Prod should not scale on dev hours. |

### P1 — Optional cleanup (small savings)

| # | Item | Est. saving | Risk | Notes |
|---|------|-------------|------|-------|
| 4 | Delete **orphan target group** | ~$0 | Low | No ALB attached |
| 5 | **ECR lifecycle** on `sst-asset` (same as dev) | ~$0.20–0.40/mo | Low | 116 images today |
| 6 | Remove **Aurora artifacts** (subnet group, PGs, proxy secret) | ~$0.40/mo | Medium | SST prod deploy may recreate if Aurora still in config. **Only after** deciding prod DB strategy. |
| 7 | Deregister old **ECS task definition** revisions | ~$0 | Low | Cosmetic; no service uses them |

### P2 — When ready to go live (not now)

| # | Item | Notes |
|---|------|-------|
| 8 | **Prod DB decision** | Manual RDS (like dev) vs Aurora (in SST today). Removing serverless was right for cost; pick before first prod deploy. |
| 9 | **`sst deploy --stage prod`** (backend + frontend) | Recreates ALB, ECS, Aurora, links CloudFront → S3. Migrations run on ECS task start (same as dev). |
| 10 | **Fix CloudFront origin** | Will happen on frontend prod deploy (off placeholder). |
| 11 | **Bastion** | SST config enables prod bastion — will create EC2 on deploy. Only needed if tunneling to prod RDS. |

### P3 — Probably not worth it

| # | Item | Why skip |
|---|------|----------|
| 12 | `sst remove --stage prod` entire stack | Saves ~$2/mo but loses VPC/certs/DNS wiring; more work to restore |
| 13 | Delete VPC skeleton | Saves pennies; slower first prod deploy |

---

## Discussion

_Updated 2026-08-30._

### 1. Is ~$2/mo placeholder acceptable?

**Decision: Yes.** Keep the skeleton until go-live.

### 2. Prod database at go-live

**Decision: Aurora Serverless v2** — same as initial SST setup in [`sst.config.ts`](../../sst.config.ts):

- Postgres engine
- **0–2 ACU** scaling
- **Pause after 15 minutes** idle (cost control when prod is quiet)
- Prod-only (dev uses manual RDS)

First prod backend deploy will provision Aurora; ECS runs `prisma migrate deploy` on task start (review migrations before deploy).

**Cost note when live:** Aurora Serverless v2 at 0 ACU when paused is much cheaper than always-on RDS, but storage + minimum billing still apply. Budget **~$15–40+/mo** depending on usage and pause behavior — revisit after first month of prod traffic.

### 3. Optional cleanup now?

**Decision: Yes — partial (per recommendation).**

| Action | Status |
|--------|--------|
| Delete orphan target group | **Done** 2026-08-30 |
| ECR lifecycle on `sst-asset` | **Done** 2026-08-30 (same policy as dev) |
| Remove Aurora artifacts | **Skipped** — Aurora Serverless v2 at go-live |

### 4. Dashboard shows placeholder

**Decision: No action** — not shared publicly.

### 5. API DNS points to deleted ALB

**Decision: Pause/remove record (option B).**

- **DNS is not in AWS.** `thecreatorshop.in` is on **Wix** (`ns14/15.wixdns.net`). Prod account Route 53 only has a private `sst.` Cloud Map zone.
- Public DNS check (2026-08-30): `api.thecreatorshop.in` → **NXDOMAIN** — already not resolving. Confirm in Wix that no stale CNAME to the old ALB remains.
- **Go-live steps:** [../deployment/README.md#prod-go-live](../deployment/README.md#prod-go-live) (deploy, Wix CNAME).

---

## Final fix

| Date | Action | Result |
|------|--------|--------|
| 2026-08-30 | Delete orphan target group `HTTP20250414111447076800000002` | Removed |
| 2026-08-30 | ECR lifecycle on `sst-asset` | Applied (same as dev) |
| 2026-08-30 | API DNS pause (Wix) | Already NXDOMAIN publicly — verify in Wix |

---

## Comparison to dev (reference)

| | Dev | Prod (now) |
|--|-----|------------|
| Monthly cost | ~$53–58 est. after fixes | ~**$2** |
| ECS / ALB | Yes (scheduled off nights) | **None** |
| RDS | Manual `t4g.small`, scheduled | **None** |
| Aurora | Removed from config (dev) | Artifacts only; in config for prod |
| Stop/start schedule | Yes | **No** |
| App reachable | Dev API when ECS up | API broken; dashboard placeholder |
