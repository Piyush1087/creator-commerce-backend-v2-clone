# AWS ops scenario catalog

**Status:** TBD  
**Use:** Monitor / Cost / Capacity workers must map each activation to one or more rows. Expand freely; do not require every row to have an installed alarm yet.

| ID | Scenario | Env | Primary worker | Detect (designed) | Human outcome |
| --- | --- | --- | --- | --- | --- |
| S01 | API down (ALB/ECS) | LIVE / dev wake | Monitor | `ALB-UNHEALTHY`, `HEALTH-LIVE`, `ECS-RUNNING` | Restore / rollback |
| S02 | Elevated 5xx | LIVE / dev | Monitor | `ALB-5XX` | Hotfix or rollback |
| S03 | High latency | LIVE / dev | Monitor + Capacity | `ALB-LAT`, ECS CPU, Aurora ACU | Scale or app fix |
| S04 | ECS CPU saturated | LIVE / dev | Capacity | `ECS-CPU` | More/larger tasks |
| S05 | ECS mem saturated | LIVE / dev | Capacity | `ECS-MEM` | Larger task or leak fix |
| S06 | Aurora at max ACU | LIVE (or if Aurora on env) | Capacity | `AURORA-ACU` | Raise max / optimize queries |
| S07 | Aurora cold start pain | LIVE | Capacity | Latency after idle | Raise min ACU / disable pause |
| S08 | Connection exhaustion | LIVE | Monitor + Capacity | `AURORA-CONN` | Pooling / ACU / limits |
| S09 | Bastion left on | Prod | Cost | `BASTION-ON` | Stop bastion |
| S10 | Dev scheduler miss | Dev | Cost / Monitor | `DEV-SCHEDULER` | Fix schedule |
| S11 | Weekly cost spike | Both | Cost | Budgets / anomaly | Explain + act |
| S12 | Monthly cost trend | Both | Cost | Monthly pack | Budget reset / rightsizing |
| S13 | Traffic surge (campaign) | LIVE | Capacity | ALB RPS + S03–S06 | Pre-scale plan |
| S14 | Traffic cliff / oversize | LIVE | Capacity | Low util + high bill | Scale down recommendation |
| S15 | Placeholder integrity breach | Prod PLACEHOLDER | Monitor + Cost | `PLACEHOLDER-*` | Escalate; do not “tune” |
| S16 | Unauthorized prod deploy | Prod | Deploy gate + Monitor | New stack appears | Stop; Product review |
| S17 | SST vs live drift | Both | Auditor | Inventory ≠ config | Doc + fix path |
| S18 | DNS / cert mismatch | Both | Auditor + Monitor | Public DNS + ACM | Wix/cert fix |
| S19 | FE up, API down | LIVE | Monitor | CF 200 + API fail | BE incident |
| S20 | Health OK, feature broken | LIVE | Eng (not only AWS) | App metrics / logs | App incident |
| S21 | ECR/Secrets cost creep | Both | Cost | Cost Explorer | Lifecycle / secret hygiene |
| S22 | Storage growth (Aurora/S3) | LIVE | Cost + Capacity | Storage metrics | Retention / cleanup |
| S23 | Failed migrate on boot | Dev (auto-migrate) | Deploy + Monitor | Task crash loops | Fix migration |
| S24 | Prod migrate needed | LIVE | Deploy | Manual process | Bastion + reviewed migrate |
| S25 | Hotfix during incident | LIVE / dev | Hotfix | Running service | Overlay image |
| S26 | Cost anomaly, traffic flat | Both | Cost | Anomaly + Auditor | Find orphan |
| S27 | Single task, no HA | LIVE | Capacity | Architecture review | Multi-task decision |
| S28 | ALB cost while unused | Dev / mistaken prod | Cost | Always-on ALB | Accept or redesign DNS |
| S29 | Pause storm / flapping | Aurora pause envs | Monitor | Connect failures pattern | Min ACU / pause policy |
| S30 | Email notify missing | Both | Monitor setup | Test alarm | Fix SNS confirm |

---

## Mechanism options (reference)

Workers choose among these; Product picks install order at LIVE:

1. CloudWatch metric alarms → SNS email  
2. CloudWatch composite alarms  
3. AWS Budgets (actual + forecast)  
4. Cost Anomaly Detection  
5. CloudWatch dashboards  
6. Synthetics or external HTTP check on `/health/live`  
7. Scheduled Auditor → Git commit + email summary  
8. EventBridge schedule for weekly/monthly packs  
9. ECS Application Auto Scaling (future SST)  
10. Aurora min/max ACU changes via SST PR  
11. ChatOps later (out of v1 — email only)

v1 notify remains **email to `brian@growthverse.in` only**.
