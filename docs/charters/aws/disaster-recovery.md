# Disaster recovery and region

**Status:** TBD — decision record  
**Audience:** product + eng

## Decision (current)

| Topic | Choice |
| --- | --- |
| **Primary region** | `ap-south-1` (Mumbai) |
| **Multi-region active/active** | **Not planned** for early LIVE |
| **Warm standby in another region** | **Not planned** |
| **Accepted risk** | Full region or severe AZ impairment ⇒ extended outage until AWS recovers or we rebuild in-region from backup |

This matches a small team, cost-sensitive PLACEHOLDER→LIVE path, and SST’s single-region app definition.

## What we still prepare (in-region)

These are **not** multi-region DR; they are survival basics:

1. **Backups / PITR** — `backup-and-restore.md`  
2. **Infrastructure as code** — SST can recreate much of the stack in `ap-south-1`  
3. **DNS at Wix** — may need manual repoint if ALB is recreated  
4. **Runbooks** — Monitor + Deploy + restore outline  
5. **Communication** — email `brian@growthverse.in` with status  

## AZ awareness (still single region)

- ALB and ECS/Fargate are multi-AZ capable by platform default when configured across subnets (confirm on LIVE Auditor pass).  
- Aurora Serverless v2 AZs follow cluster configuration — confirm at go-live.  
- **Single ECS task** ⇒ task death or bad deploy still causes blip even if the region is healthy (capacity/HA choice — see `control-plane.md`).

## Explicitly deferred

- Cross-region Aurora replica  
- Global Accelerator  
- Automated failover playbooks to `us-east-1` / another region  
- Formal DR game day in a second region  

Revisit when Product cites uptime contracts or revenue that justify the cost.

## If ap-south-1 is impaired

1. Confirm via AWS Health + status.  
2. Do not thrash-redeploy blindly.  
3. Communicate outage; protect data (no speculative reset).  
4. When region recovers: health checks, then deeper app verify.  
5. If cluster/data loss: restore path in `backup-and-restore.md`.

## Related

- `backup-and-restore.md`  
- `env/prod.md` LIVE vs PLACEHOLDER  
- `docs/aws-environments/modes-and-recommendation.md`  
