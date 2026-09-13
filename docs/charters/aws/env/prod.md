# Environment overlay — creator-prod

**Profile:** `creator-prod` · Account `250037328530` · Region `ap-south-1`  
**SST:** `--stage prod` · Intended URLs: `api.thecreatorshop.in`, `dashboard.thecreatorshop.in`  
**Role:** **primary design target** for Monitor / Cost / Capacity once LIVE. Until then, run **PLACEHOLDER** integrity.

---

## Profiles (pick one mentally — workers must know which)

### PLACEHOLDER (current typical)

| Topic | Expectation |
| --- | --- |
| ECS / ALB / Aurora / RDS | **Absent** |
| Bastion | Not running |
| Dashboard | May be CloudFront **placeholder** origin |
| API DNS | Often NXDOMAIN until go-live |
| Cost | ~few USD / month |
| Alarms that matter | `PLACEHOLDER-*`, low `BUDGET-*`, cost anomaly |

Any appearance of full compute/DB without Product LIVE authorization = **P1**.

### LIVE (future)

| Topic | Expectation |
| --- | --- |
| Stack | Matches SST: VPC+bastion, Aurora Sv2 0–2 ACU (tune at go-live), ECS 0.5/1GB starting point, HTTPS ALB |
| Auto-migrate | **`false`** — migrate via controlled process |
| Bastion | Exists; should not stay running casually |
| Alarms that matter | Full `register-alarms.md` LIVE set + health check |
| Cost | ALB+ECS+Aurora floor; budgets reset at go-live |

Do **not** copy the dev night-stop schedule onto LIVE.

---

## SST vs live trap

Backend `sst.config.ts` **declares** the LIVE-shaped stack for `--stage prod`.  
Placeholder **live account** may have deleted compute on purpose.  
→ Next unauthorized `sst deploy --stage prod` creates billable resources. Deploy charter must keep blocking until Product names LIVE.

---

## Threshold starters (LIVE install later)

| Alarm code | Starter idea |
| --- | --- |
| `ALB-5XX` | Any sustained 5xx — tighter than dev |
| `ALB-UNHEALTHY` | ≥ 1 for 2–5 min → P1 |
| `ECS-CPU` / `ECS-MEM` | > 80% / 85% for 10–15 min → Capacity + Monitor |
| `ECS-RUNNING` | Mismatch → P1 |
| `AURORA-ACU` | At max for 15+ min → P2 + Capacity |
| `BASTION-ON` | Running longer than N hours → P3 |
| `BUDGET-ACTUAL` | Set from go-live cost model |
| `HEALTH-LIVE` | Synthetic/external check on `https://api.thecreatorshop.in/health/live` |
| `PLACEHOLDER-*` | **Disable** once LIVE confirmed |

Aurora pause on LIVE: Product decision. If pause left on, expect cold-start latency alarms or raise min ACU.

---

## Worker behavior on prod

| Worker | PLACEHOLDER | LIVE |
| --- | --- | --- |
| Monitor | Integrity + budget only | Full health |
| Cost | Guard ~$2 skeleton | Full FinOps |
| Capacity | N/A (no stack) | Primary advisor |
| Deploy | Blocked unless LIVE | Authorized envelope only |
| Hotfix | No stack → stop | Per hotfix charter |

---

## Go-live ops flip (checklist pointer)

See `processes.md` §F. Flip `env` profile PLACEHOLDER → LIVE in the same change that installs LIVE alarms and disables placeholder integrity alarms.
