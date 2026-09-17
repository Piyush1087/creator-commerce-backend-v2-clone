# 04 — Monitor (read-only)

**ACCESS:** `READ_ONLY`  
**Profile:** `creator-prod` / `250037328530`  
**Time (IST):** 2026-09-15 ~18:40  
**Identity:** `arn:aws:sts::250037328530:assumed-role/AWSReservedSSO_AdministratorAccess_c91a837ebc90ca5c/brian`

Charter: standing Monitor does **not** create alarms in this pass (`INSTALL_MONITORING` is a later envelope).

## Health

| Check | Result |
| --- | --- |
| `GET /health/live` | 200 `{"status":"ok"}` |
| `GET /health` | 200 database `up` |
| ALB target | `10.0.3.123:80` **healthy** |
| ECS `api` | desired 1 / running 1 / pending 0 / rollout COMPLETED |
| Task def | `…-api:2` |
| Aurora | `available` · aurora-postgresql · MinACU **0.5** / MaxACU **2.0** |
| ECS CPU (1h) | avg ~0.4–3.9%; spike max **52%** (migrate window) then idle |
| ECS mem (1h) | avg ~13–15%; max **23%** |
| Bastion | `i-01586cb9465e9fbc5` **running** t4g.nano — flag for Cost/teardown, not a user-facing outage |

## Verdict

**HEALTHY** for the rehearsal surface (ALB DNS, non-auth). No user-facing outage.

## Handoffs

- Capacity: ECS oversized vs load; Aurora min 0.5 is a pause-storm workaround, not a LIVE recommendation.
- Cost: bastion still on; ALB is the overnight bill driver.
- Deploy: migrations applied via ECS Exec (not on-start).
