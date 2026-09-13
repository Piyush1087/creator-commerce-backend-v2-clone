# Creator Shop AWS Platform Ops — Program Charter

**Version:** 0.1  
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
- Worker charters under this folder  
- Later (not this doc pass): installed alarms, budgets, dashboards, email confirmed  
- Later: deeper IAM and data-access files replacing the overviews 

## 3. Non-negotiables

- Status remains **TBD** until Product freezes after a real install pilot.  
- **No AWS mutations** from these workers until Product unlocks mutate mode **or** names an install envelope.  
- **No secret values** in docs.  
- Email v1 target is `brian@growthverse.in` only.  
- Design for **prod LIVE**; use **dev** as rehearsal; respect **prod PLACEHOLDER** integrity.  
- Prefer Git artifacts over chat memory.  

## 4. Modes

| Mode | Default? | Meaning |
| --- | --- | --- |
| Recommend-only | **Yes** | Docs + email + proposed changes |
| Mutate-authorized | No | Allow-listed actions only after Product unlock |

Both modes are designed in `control-plane.md`. Product decides later.

## 5. Activation (future)

```text
docs complete                         YES (this package)
alarms/budgets installed              NO until ordered
prod profile                          PLACEHOLDER | LIVE (must be named)
mutation                              recommend-only unless unlocked
```

## 6. Child workers

| Charter | Focus |
| --- | --- |
| `aws_monitor_ai_worker_charter.md` | Health, outages, alarm install/ops |
| `aws_cost_ai_worker_charter.md` | Spend, budgets, historic packs |
| `aws_capacity_ai_worker_charter.md` | Scale advice / optional apply |

Initiation prompts sit beside each charter.
