# AWS control plane — auto vs manual

**Status:** TBD (living design)  
**Audience:** eng + product + anyone deciding “do we scale?”  
**Source of intended stack:** backend `sst.config.ts` (and FE SST for CloudFront/S3)

When in doubt: **AWS auto** means it moves inside limits we already set. **Our control** means a human or authorized worker changes config, SST, or a console/CLI action.

---

## 1. Picture of the intended LIVE backend stack

```text
Internet → ALB (HTTPS) → ECS Fargate task(s) → Aurora Postgres (Serverless v2)
                              ↓
                         S3 files bucket
Prod only: VPC bastion for controlled DB/admin access (migrations, tunnels)
```

Dev often differs in **which database is actually used** (manual small RDS + URL override) and has **no bastion** in SST. See `env/dev.md`.

---

## 2. Resource matrix

| Resource | Who creates it | Auto-managed behavior | We control | Typical scale lever |
| --- | --- | --- | --- | --- |
| **VPC** | SST | Routing/DNS plumbing | CIDR, bastion on/off | Rarely touched after create |
| **Bastion** (prod SST) | SST when `bastion: true` | None meaningful | Start/stop, who can SSM | Stop when idle; never leave on “for convenience” |
| **ALB** | SST with ECS service | Health checks to targets | Idle timeout, cert, whether ALB exists | Mostly **on/off** (delete = DNS pain). Cost ~always-on |
| **ECS service / Fargate** | SST | Restarts unhealthy tasks; **no autoscaling in current SST** | CPU/memory size, desired count, image | **Manual / SST:** bump CPU/mem or task count |
| **Aurora Serverless v2** | SST (when not overridden) | Scales **ACU between min–max**; can **pause** if min 0 + pause policy | min/max ACU, pauseAfter, engine | Raise **max ACU** for headroom; raise **min** to avoid cold starts |
| **Manual RDS** (dev pattern) | Humans / older scripts | Instance does not elastic-scale like Sv2 | Instance class, start/stop schedule | `t4g.small` ↔ larger; scheduler stop/start |
| **S3 + CloudFront (FE)** | SST FE | CDN caching | Invalidations, aliases | Rarely “scale”; watch error rates + cost |
| **ECR** | SST/deploy | Image storage | Lifecycle policies | Cost crumbs unless garbage piles up |
| **Secrets Manager** | SST/app | Rotation only if configured | What secrets exist | Cost per secret/version |
| **Dev stop/start scheduler** | Custom scripts | EventBridge-style schedule | Windows (IST), what it stops | Fix schedule if “still up Sunday” |

### Aurora Serverless v2 — plain language

- **Yes, elastic inside the band:** if traffic rises, Aurora can add ACUs up to **max** (today designed `2 ACU`). If quiet and min is `0` with pause, it can pause after idle (today `15 minutes` in SST).  
- **Not “set and forget capacity planning”:** choosing 0–2 ACU, whether prod should pause, and investigating stuck-high ACU or storage growth is **our** job.  
- **Cold start:** after pause, first queries are slower. Fine for cheap/dev-like; often wrong for customer-facing LIVE (Product may set min ≥ 0.5 ACU later).  
- **Does not replace** ECS sizing. App can be CPU-bound on Fargate while DB is idle.

### ECS today — plain language

Current backend SST pins **0.5 vCPU / 1 GB** and does **not** declare autoscaling. So “1000 users showed up” is **not** automatically more tasks. Capacity worker recommends; Product/Deploy apply via SST (or mutate mode later).

---

## 3. Scale-up / scale-down guide (signals → action)

Use ALB request count + target response time + ECS CPU/mem + Aurora ACU/connections as the core four. Exact thresholds live in `env/*.md` and `register-alarms.md`.

| Symptom | Likely bottleneck | Prefer first | Avoid |
| --- | --- | --- | --- |
| High ECS CPU, DB ACU low | App compute | More tasks **or** larger task CPU | Blindly raising Aurora max |
| High Aurora ACU / connections, ECS idle | Database | Raise Aurora **max** ACU; check slow queries | Adding many ECS tasks with no DB headroom |
| ALB 5xx, targets unhealthy | Deploy/bad task/health | Rollback / hotfix / fix health path | Scaling up broken tasks |
| Latency only after idle | Aurora pause / cold start | Raise **min** ACU or disable pause on LIVE | Oversizing ECS |
| Cost up, traffic flat | Leak / left-on bastion / pause failed / orphan | Cost worker + auditor inventory | Scaling up |
| Night cost on **dev** | Scheduler failed | Fix stop schedule | Treating as LIVE capacity issue |
| PLACEHOLDER prod suddenly has ECS/ALB/Aurora | Unexpected create or deploy | Page human; confirm authorization | “Tuning” an unauthorized stack |

### User-growth thought experiment (for Capacity worker)

1. Estimate RPS / concurrent from ALB metrics (or product forecast).  
2. Compare to current ECS CPU/mem headroom and p95 latency.  
3. Compare to Aurora ACU % of max and connection use.  
4. Output a **written recommendation**: change nothing / raise ECS / raise Aurora max / both / investigate app.  
5. If mutate mode unlocked: apply only allow-listed changes; otherwise open a Deploy/SST change path.

---

## 4. What Monitor vs Cost vs Capacity own

| Concern | Owner | Standing access |
| --- | --- | --- |
| Down / degraded / alarm firing now | Monitor | **Read-only** |
| $ spike, idle waste, budget forecast | Cost | **Read-only** |
| “Will we survive next week’s campaign?” | Capacity | **Read-only** (mutate only with Product envelope) |
| “What is actually in the account?” | Auditor (`docs/aws-environments`) | **Read-only** |
| “Ship a new image / change SST” | Deploy / Hotfix | Elevated inside **their** charters only |

Program law (roles, envelopes, hard denials): `charters/aws_platform_ops_program_charter.md` §4.

---

## 5. Mutation policy (designed, gated)

| Mode | Who | Workers may | Workers must not |
| --- | --- | --- | --- |
| **Recommend-only** (default) | All three ops workers | Update docs, email `brian@growthverse.in`, propose SST diffs | Any AWS write; deploy; secrets |
| **`INSTALL_MONITORING`** | Monitor only if Product names it | Alarms, SNS email sub, dashboards per register | ECS/RDS/Aurora/ALB/VPC; deploy |
| **`INSTALL_BUDGETS`** | Cost only if Product names it | Budgets + anomaly → email | Delete compute; deploy |
| **`MUTATE_CAPACITY`** | Capacity only if Product names allow-list | Exact allow-list only | Expand allow-list; delete ALB/VPC; prod deploy; migrate reset; secrets |
| **`MUTATE_COST_STOP`** | Cost only if Product names allow-list | e.g. stop bastion if listed | Anything not listed |

**Charter beats SSO:** AdministratorAccess in the human session does not authorize crossing these boundaries.

Allow-list candidates (for later Product call): ECS desired count within a band; Aurora max ACU within a band; stop bastion; **not** delete ALB/VPC; **not** prod deploy.

---

## 6. Related live facts

Prefer `docs/aws-environments/current-state.md` and `differential-and-costs.md` for “what is true this week.” This file is the **operating model**, not the latest inventory.
