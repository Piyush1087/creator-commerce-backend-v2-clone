# Alarm and notification register

**Status:** TBD — **design only**. Nothing in this file is installed in AWS yet.  
**v1 notify:** email → `brian@growthverse.in` (SNS email subscription when Product authorizes install)  
**Install trigger:** production LIVE activation (or an explicit “install on creator-dev rehearsal” order)

When alarms are created, replace `ARN/ID` placeholders and set **Installed** to the date.

---

## Notification channel (designed)

| Channel | Target | When |
| --- | --- | --- |
| Email | `brian@growthverse.in` | All severities until Product adds Slack/etc. |
| Git docs | `docs/aws-environments/*` + this register | Always for durable record |

Severities:

- **P1** — user-facing down / PLACEHOLDER integrity breach on prod  
- **P2** — degraded (elevated 5xx, single task unhealthy, ACU at max sustained)  
- **P3** — cost anomaly, scheduler miss on dev, capacity advisory  

---

## Intended alarms (catalog)

### Shared ideas (threshold numbers live in `env/*.md`)

| Code | Name | Signal | Applies | Severity | ARN/ID | Installed |
| --- | --- | --- | --- | --- | --- | --- |
| `ALB-5XX` | ALB high 5xx | HTTPCode_Target_5XX / ELB 5xx | LIVE + rehearsal | P1/P2 | — | no |
| `ALB-LAT` | ALB target latency | TargetResponseTime | LIVE + rehearsal | P2 | — | no |
| `ALB-UNHEALTHY` | Unhealthy hosts | UnHealthyHostCount | LIVE + rehearsal | P1 | — | no |
| `ECS-CPU` | ECS CPU high | CPUUtilization | LIVE + rehearsal | P2 | — | no |
| `ECS-MEM` | ECS memory high | MemoryUtilization | LIVE + rehearsal | P2 | — | no |
| `ECS-RUNNING` | Running tasks ≠ desired | RunningTaskCount | LIVE + rehearsal | P1 | — | no |
| `AURORA-ACU` | ACU near max | ServerlessDatabaseCapacity | When Aurora exists | P2 | — | no |
| `AURORA-CONN` | Connections high | DatabaseConnections | When Aurora exists | P2 | — | no |
| `AURORA-PAUSE-STORM` | Excessive resume/pause | Pause/resume metrics or connect failures after idle | Optional LIVE | P3 | — | no |
| `BASTION-ON` | Bastion running too long | EC2 status / custom | Prod when bastion exists | P3 | — | no |
| `BUDGET-ACTUAL` | Budget actual | AWS Budgets | Both accounts | P3/P2 | — | no |
| `BUDGET-FORECAST` | Budget forecast | AWS Budgets | Both accounts | P3 | — | no |
| `COST-ANOMALY` | Cost anomaly | Cost Anomaly Detection | Both accounts | P2 | — | no |
| `PLACEHOLDER-ECS` | Unexpected ECS | Resource existence | Prod PLACEHOLDER only | P1 | — | no |
| `PLACEHOLDER-ALB` | Unexpected ALB | Resource existence | Prod PLACEHOLDER only | P1 | — | no |
| `PLACEHOLDER-AURORA` | Unexpected Aurora/RDS | Resource existence | Prod PLACEHOLDER only | P1 | — | no |
| `DEV-SCHEDULER` | Dev still up in stop window | ECS desired / RDS status vs schedule | Dev only | P3 | — | no |
| `HEALTH-LIVE` | `/health/live` fail | Synthetics or external check | LIVE + rehearsal | P1 | — | no |

### AWS Budgets (designed)

| Budget | Account | Amount (TBD at install) | Notify |
| --- | --- | --- | --- |
| `creatorshop-dev-monthly` | creator-dev | Set from `env/dev.md` | email |
| `creatorshop-prod-placeholder` | creator-prod | Low ceiling (~few USD) while PLACEHOLDER | email |
| `creatorshop-prod-live` | creator-prod | Set at LIVE go-live | email |

---

## Dashboards (designed, not built)

| Dashboard | Purpose |
| --- | --- |
| `creatorshop-dev-ops` | ALB + ECS + DB + cost widget |
| `creatorshop-prod-live` | Same for LIVE |
| `creatorshop-prod-placeholder` | Integrity: should show **empty** compute |

---

## Install checklist (for later — do not run now)

1. Product authorizes install env (dev rehearsal and/or prod LIVE).  
2. Create SNS topic → subscribe `brian@growthverse.in` → confirm email.  
3. Create alarms from this register using `env/*.md` thresholds.  
4. Create budgets + anomaly subscription.  
5. Fill ARN/ID columns; commit.  
6. Send one test email; verify inbox + spam.  
7. Enable Monitor worker on continuous/incident posture.

---

## Explicitly out of scope for “design complete”

- Creating the SNS topic or alarms in this documentation pass  
- PagerDuty / Slack  
- Auto-remediation (belongs to mutate mode + Capacity/Monitor allow-list later)
