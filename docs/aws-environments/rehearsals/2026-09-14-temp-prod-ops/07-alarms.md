# 07 — Alarms test

**Envelope:** `INSTALL_MONITORING` (authorized in `00-authorization.md`)  
**Time (IST):** 2026-09-16 ~12:47  
**Budgets:** not installed (`INSTALL_BUDGETS` not used)

## Installed

| Code | ARN/ID | Notes |
| --- | --- | --- |
| SNS | `arn:aws:sns:ap-south-1:250037328530:creatorshop-prod-ops-rehearsal` | Email sub **PendingConfirmation** |
| `ALB-UNHEALTHY` | `creatorshop-prod-ALB-UNHEALTHY` | UnHealthyHostCount ≥ 1 / 2×60s |
| `ALB-5XX` | `creatorshop-prod-ALB-5XX` | Target 5xx sum ≥ 10 / 5×60s |
| `ECS-CPU` | `creatorshop-prod-ECS-CPU` | CPU avg > 80% / 3×300s |
| `AURORA-ACU` | `creatorshop-prod-AURORA-ACU` | ACU avg ≥ 1.8 / 3×300s |

SNS topic → `brian@growthverse.in` **created**, confirmation **not yet clicked** (AWS will not deliver alarm mail until confirmed).

## Tests performed

| Test | How triggered | Email received? | Cleared? |
| --- | --- | --- | --- |
| Forced unhealthy / alarm | `set-alarm-state ALARM` on `ALB-UNHEALTHY` | **Not proven** (sub pending) | Yes — `set-alarm-state OK` |
| OK state (no false page) | Restored OK | n/a | **PASS** (state OK) |
| Budget threshold | skipped | | |

## Monitoring cost note

Four custom alarms ≈ **$0.40/mo** (~₹38) if left up. SNS email ~$0. Design: **delete in teardown** so incremental ≈ $0 after PLACEHOLDER.

## Teardown of alarms

Must delete these four alarms + SNS topic in `10-teardown.md`.
