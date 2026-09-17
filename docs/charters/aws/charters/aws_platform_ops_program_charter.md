# Creator Shop AWS Platform Ops — Program Charter

**Version:** 0.2  
**Status:** TBD — not frozen  
**Role:** Program umbrella for Monitor, Cost, and Capacity workers  
**Notify design:** `brian@growthverse.in`

## 1. Mission

Automate the ongoing **AWS expert** role for Creator Shop: health, cost, and capacity — with durable docs and email — so production LIVE can activate workers immediately without reinventing process in chat.

This program does **not** replace Deploy, Hotfix, or Auditor. It sits beside them.

```text
Auditor / Deploy / Hotfix     →  docs/aws-environments/
Monitor / Cost / Capacity      →  docs/charters/aws/  (this program)
```

## 2. Deliverables

- Human README + processes + control-plane + scenarios + alarm register  
- Env overlays `env/dev.md`, `env/prod.md`  
- Resilience & access overviews: backup, logging, edge/WAF, external deps, IAM/SSO, data access, DR/region  
- Worker charters under this folder (each with **hard role / IAM / boundary** sections)  
- Later: installed alarms, budgets, dashboards, email confirmed  
- Later: deeper IAM and data-access files  
- Rehearsal + return-to-placeholder + worker runtime docs (this package) 

## 3. Non-negotiables

- Status remains **TBD** until Product freezes after a real install pilot.  
- **Least privilege:** each worker’s *standing* posture is defined below; broader SSO must not be used as an excuse to cross boundaries.  
- **No secret values** in docs (`GetSecretValue` / print env secrets = forbidden).  
- Email v1 target is `brian@growthverse.in` only.  
- Design for **prod LIVE**; use **dev** as rehearsal; respect **prod PLACEHOLDER** integrity.  
- Prefer Git artifacts over chat memory.  
- Workers **hand off** — they do not absorb Deploy, Hotfix, migrate, or each other’s mutate rights.

## 4. Roles, access, and boundaries (program law)

Standing posture = what the worker may do on a normal assignment **without** a Product envelope named `INSTALL_*` or `MUTATE_*`.

| Worker | Standing AWS access | May write Git docs? | May email? | May change AWS resources? | Hands off to |
| --- | --- | --- | --- | --- | --- |
| **Monitor** | **Read-only** (describe/get metrics/logs metadata, health HTTP) | Yes | Yes | **No** (not even alarms) | Cost, Capacity, Deploy, Hotfix |
| **Cost** | **Read-only** (Cost Explorer, list/describe billable resources, budgets *read*) | Yes | Yes | **No** | Monitor, Capacity, Product |
| **Capacity** | **Read-only** (CloudWatch metrics, describe ECS/Aurora/ALB) | Yes | Yes | **No** | Monitor (if unhealthy), Deploy (SST), Product |
| **Auditor** (other folder) | **Read-only** | Yes | If asked | **No** | Deploy / Product |
| **Deploy / Hotfix** (other folder) | Elevated **only** inside their charters | Yes | If asked | **Yes** (their envelope only) | — |

### Product envelopes (temporary, named, logged)

| Envelope | Who may run | Allowed writes (max) | Still forbidden |
| --- | --- | --- | --- |
| `INSTALL_MONITORING` | Named human or Monitor **only for that assignment** | CloudWatch alarms, dashboards, SNS topic/subscription for `brian@growthverse.in` | ECS/RDS/Aurora/ALB/VPC/S3 data, SST deploy, secrets |
| `INSTALL_BUDGETS` | Named human or Cost **only for that assignment** | AWS Budgets + anomaly subscription → email | Delete compute, deploy, secrets |
| `MUTATE_CAPACITY` | Capacity **only if Product unlocks allow-list** | Exact allow-list items only (e.g. ECS desired count band, Aurora max ACU band, stop bastion) | Expand allow-list, delete ALB/VPC, prod `sst deploy`, migrate reset, secrets |
| `MUTATE_COST_STOP` | Cost **only if Product unlocks** | e.g. stop bastion / jumpbox if listed | Anything not listed |
| `RETURN_TO_PLACEHOLDER` | Deploy / Product (not standing ops workers) | Teardown per `return-to-placeholder.md` | Ops workers executing delete under read-only |

If the human has AdministratorAccess SSO but the charter says read-only, the **charter wins**: do not perform writes.

### Hard shared denials (all ops workers)

- `sst deploy` / `sst remove`  
- ECS image hotfix / task def register (Hotfix only)  
- Prisma migrate / `migrate reset`  
- `GetSecretValue`, print `.env`, paste tokens  
- Wix DNS edits  
- Delete ALB, VPC, Aurora cluster, or “cleanup prod” without Product  
- Treat PLACEHOLDER prod as LIVE  
- Use another worker’s envelope without Product renaming the assignment  

## 5. Modes

| Mode | Default? | Meaning |
| --- | --- | --- |
| Recommend-only / read-only | **Yes** | Observe, write Git, email, propose changes |
| Install envelope | No | Product names `INSTALL_*`; narrow writes only |
| Mutate-authorized | No | Product names `MUTATE_*` + allow-list |

See also `control-plane.md` §5 and `iam-and-sso.md`.

## 6. Activation (future)

```text
docs complete                         YES (this package)
alarms/budgets installed              NO until INSTALL_* ordered
prod profile                          PLACEHOLDER | LIVE (must be named)
standing worker access                READ-ONLY unless envelope named
```

## 7. Child workers

| Charter | Focus | Standing access |
| --- | --- | --- |
| `aws_monitor_ai_worker_charter.md` | Health, incidents, alarm *design* | Read-only |
| `aws_cost_ai_worker_charter.md` | Spend, budgets *design*, packs | Read-only |
| `aws_capacity_ai_worker_charter.md` | Scale advice; mutate only if unlocked | Read-only |

Initiation prompts sit beside each charter and must restate boundaries.
