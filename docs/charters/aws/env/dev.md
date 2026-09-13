# Environment overlay — creator-dev

**Profile:** `creator-dev` · Account `841162679642` · Region `ap-south-1`  
**SST:** `--stage dev` · App URLs: `api.dev.thecreatorshop.in`, `dashboard.dev.thecreatorshop.in`  
**Role of this env:** smoke tests and rehearsal — **not** the long-term capacity home. Design workers here so prod LIVE activation is copy-paste ready.

---

## Posture

| Topic | Dev expectation |
| --- | --- |
| Uptime | Best-effort; nights/Sunday **may be down** if scheduler works |
| Auto-migrate | `RUN_MIGRATIONS_ON_START=true` (SST) |
| Bastion | SST `bastion: false`; optional jumpbox for tunnels |
| Database | Often **manual RDS** + `DEV_DATABASE_URL` (not live Aurora) — confirm via Auditor |
| ECS size (SST intent) | 0.5 vCPU / 1 GB, arm64 |
| Cost order of magnitude | ~$50–70/mo class when stack is up (see aws-environments cost docs) |

“Off at night” is **normal**, not an incident — unless the stop window fails (`DEV-SCHEDULER`).

---

## Threshold starters (for alarm install later)

Tune at install time; these are design defaults.

| Alarm code | Starter idea |
| --- | --- |
| `ALB-5XX` | Sustained target 5xx > small N for 5–10 min during **wake** hours only |
| `ALB-UNHEALTHY` | Unhealthy hosts ≥ 1 for 5 min during wake hours |
| `ECS-CPU` | > 80% for 15 min (wake) |
| `ECS-MEM` | > 85% for 15 min |
| `ECS-RUNNING` | Running below desired for 5 min during wake |
| `DEV-SCHEDULER` | Desired/tasks/RDS available during known stop window |
| `BUDGET-ACTUAL` | Monthly budget near recent run-rate (~$70 pre-tax ballpark — reset from latest Cost Explorer) |
| `HEALTH-LIVE` | Failures only alert in wake window |

Suppress or do not page on scheduled stop windows.

---

## Worker behavior on dev

| Worker | Dev behavior |
| --- | --- |
| Monitor | Softer; respect schedule; email P1 only for wake-hour user-facing down |
| Cost | Weekly skim; flag scheduler miss and orphan resources |
| Capacity | Low priority; practice recommendations; do not over-invest |
| Auditor | Primary rehearsal inventory |

Mutation mode on dev still requires Product unlock (even for “just desired count”).

---

## Success criteria for “dev rehearsal of ops”

- Docs + charters understood  
- One successful Auditor refresh committed  
- (Later) alarms installed with email confirmed to `brian@growthverse.in`  
- No expectation that dev equals prod sizing
