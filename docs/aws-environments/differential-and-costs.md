# Dev vs prod differential and costs

Figures are Cost Explorer / prior audits, not invoices. Tax ~16% where called out. No secret values.

## Side-by-side

| | creator-dev (design, 2026-08-30) | creator-prod live (2026-09-10) | If someone ran `sst deploy --stage prod` **today** |
| --- | --- | --- | --- |
| Purpose | Daily test of the **development** line | Cheap skeleton until real go-live | Full v2 API + DB + dashboard origin |
| App reachable | Yes, when scheduler has ECS=1 | Dashboard placeholder 200; API NXDOMAIN | Would become reachable only after Wix `api` CNAME + migrate |
| ECS + ALB | Yes (ECS scheduled 0 nights/Sunday) | **None** | Created (0.5 vCPU / 1 GB + ALB) |
| Database | Manual RDS `t4g.small`, scheduled stop | **None** | Aurora 0–2 ACU, pause 15 min + **prod bastion** |
| Auto-migrate | **Yes** (`RUN_MIGRATIONS_ON_START=true`) | n/a | **No** (`false` in current `sst.config.ts`) |
| Stop/start schedule | Yes (IST) | No (correct) | No unless separately built |
| Public pretty URLs | `*.dev.thecreatorshop.in` | dashboard CNAME only | Certs already in config; Wix still manual |
| Est. monthly | **~$53–67** after 08-30 cuts | **~$2** | **+$25–40+** the month it stays up (ALB + Fargate + Aurora/storage). ALB alone ~$16 |

## Cost everywhere it matters

### creator-dev (why it is not “free testing”)

Always-on or weakly scheduled:

| Line | Order of magnitude | Note |
| --- | --- | --- |
| ALB | ~$16/mo | Kept so `api.dev` DNS stays valid. Deleting it saves money but forces a Wix/API-DNS dance every wake. |
| RDS `t4g.small` | ~$16/mo before schedule | Night/Sunday stop already applied. Metrics (08-30) did not justify `micro`. |
| Fargate | ~$5–10/mo after scale-to-0 | Was ~$10 when 24/7. |
| VPC / IPv4, ECR, Route 53 | several $/mo | Orphan stage removal already done. |

Dev is the **expensive** account **on purpose**: it is the only place a full app + small DB already exists with working pretty URLs.

### creator-prod placeholder (~$2/mo)

| Line | Typical | Note |
| --- | --- | --- |
| Route 53 | $0.50/mo | Private `sst.` zone crumbs / hosted zone — not public `thecreatorshop.in` |
| Secrets Manager | ~$0.1–0.4/mo | Leftover Aurora proxy secret artifact from SST |
| ECR | cents–$0.50 | Lifecycle already applied 08-30 |
| CloudFront + S3 | ~$0 | Placeholder traffic |
| ECS / ALB / RDS | **$0** | Deleted for placeholder |

This is already near-minimal for “account still exists and can deploy later.”

### What TEST_MINI on prod would add (not recommended now)

Same kinds of bills as turning prod into a second dev:

| Component | If created | If torn down each PLACEHOLDER |
| --- | --- | --- |
| ALB | ~$16/mo **while it exists** | $0 when deleted; **new hostname** next time → Wix `api` edit |
| ECS 1×0.5/1GB | hours × Fargate | $0 when desiredCount=0 |
| Small RDS or Aurora 0–2 ACU | ~$15–40+/mo if left, less if stopped/paused | Recreate + migrate every wake |
| Bastion (SST prod `bastion: true`) | extra EC2 if left running | Only needed for manual migrate |

Plus **duplicate** of what creator-dev already pays. See recommendation in [`modes-and-recommendation.md`](./modes-and-recommendation.md).

### What LIVE would add (future go-live)

Same stack SST already describes, plus Wix `api` + `dashboard` targets, Postmark/Razorpay/Meta prod URLs, empty apply-bypass, `STAGE=prod` (no OTP in logs). Budget **ALB + ECS + Aurora** as the floor (~$25–40+/mo quiet, more with traffic). Do not copy the **dev** stop-at-21:00 schedule onto LIVE.

## SST / docs drift (cost-relevant)

| Claim in older docs | Code / live 2026-09-10 |
| --- | --- |
| Aurora is prod-only in `sst.config.ts` | Resource is **declared for every stage**; **dev** overrides URL with `DEV_DATABASE_URL` when set. Live **prod has no Aurora**. Live **dev** uses manual RDS. |
| Prod ECS auto-migrates | **`false`** for non-dev stages. |
| Next prod deploy is a no-op skeleton refresh | Next prod deploy **creates** Aurora + ECS + ALB + bastion. |

Pulumi **dev** state still mentioned Aurora on 08-30. A WSL `sst deploy --stage dev` was the intended sync so the next **dev** release does not recreate serverless v2 (~$20–40+/mo risk). That is a **dev** hygiene item, not a reason to open prod.

## Frontend vs backend cost

FE is CloudFront + S3: cheap. The money is **BE**: ALB, ECS, RDS/Aurora, IPv4. Placeholder prod already has the cheap FE half (placeholder origin). The expensive half is what was deleted.
