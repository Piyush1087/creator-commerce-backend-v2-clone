# 11 — After Auditor (PLACEHOLDER)

**ACCESS:** READ_ONLY  
**Profile:** `creator-prod`  
**Account:** `250037328530`  
**Time (IST):** 2026-09-16 ~13:10  

## Identity

Same SSO role as baseline (`AdministratorAccess` / `brian`).

## Inventory

| Resource | Count / state |
| --- | --- |
| ECS clusters | **0** (list empty; former cluster INACTIVE) |
| ECS services | **0** |
| ALB | **0** |
| Target groups | **0** |
| RDS instances | **0** |
| Aurora clusters | **0** |
| EC2 running | **0** |
| EC2 stopped | `i-01586cb9465e9fbc5` t4g.nano (bastion) |
| Rehearsal alarms `creatorshop-prod-*` | **0** |
| Rehearsal SNS | **0** |
| CloudFront | `E3O06GGVRRZSRL` · `dqhsgqysek6if.cloudfront.net` · alias `dashboard.thecreatorshop.in` · **kept** |

## Verdict

**PLACEHOLDER restored** for bill drivers (no ECS/ALB/Aurora). Bastion exists but **stopped**. Dashboard CloudFront unchanged.

Cost Explorer will lag 1–2 days toward the ~$2 / ~₹190 band (ALB hours already accrued overnight).
