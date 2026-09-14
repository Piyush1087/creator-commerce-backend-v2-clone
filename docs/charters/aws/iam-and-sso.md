# IAM and SSO (overview)

**Status:** TBD — **overview only**  
**Deeper follow-up:** later this topic gets its own expanded file (roles, least-privilege maps, break-glass drill). Treat this as the standing summary until then.

## Accounts and profiles

| AWS account | SSO / CLI profile | SST stage | Purpose |
| --- | --- | --- | --- |
| `841162679642` | `creator-dev` | `dev` | Test / smoke |
| `250037328530` | `creator-prod` | `prod` | PLACEHOLDER today → LIVE later |

Region default: `ap-south-1`.

## Current reality (honest)

Ops and deploy work today often use **broad admin SSO** (e.g. AdministratorAccess-style roles) because the team is small. That is convenient and **risky** as LIVE traffic and data grow.

## Standing rules (now)

1. Prefer **SSO short-lived credentials** over long-lived access keys.  
2. Never commit access keys, session tokens, or `.env` secrets.  
3. Workers must not call `get-secret-value` / print secret payloads into docs.  
4. Prod deploy and mutate-ops require **named Product authorization**, not only “I have SSO.”  
5. If SSO expired → document `SSO_EXPIRED`; do not invent account state.

## Target direction (for the deeper file later)

| Role idea | Intended use |
| --- | --- |
| ReadOnly / Auditor | Inventory, Cost Explorer, describe_* |
| Operator | Alarms, dashboards, start/stop bastion (limited) |
| Deployer | ECS/SST deploy path (still gated by process) |
| Admin break-glass | Rare; logged; Product aware |

Exact managed policies and group names: **TBD in deeper IAM doc**.

## Worker expectations (strict)

Standing posture is **read-only** for Monitor, Cost, Capacity, and Auditor. Broader SSO (including AdministratorAccess) **does not** override the worker charter.

| Worker | Standing IAM intent | Writes only if Product names |
| --- | --- | --- |
| Monitor | Read-only metrics/logs/describe/health | `INSTALL_MONITORING` (alarms/SNS/dashboards only) |
| Cost | Read-only Cost Explorer + inventory | `INSTALL_BUDGETS`; optional `MUTATE_COST_STOP` allow-list |
| Capacity | Read-only metrics + describe | `MUTATE_CAPACITY` + allow-list |
| Auditor | Read-only | Never (other folder) |
| Deploy / Hotfix | Elevated inside **their** envelopes | Per `docs/aws-environments` charters |

Shared denials for ops workers: no `GetSecretValue`, no SST deploy, no hotfix, no migrate, no deleting ALB/VPC/Aurora “to save money” without Product.

Full matrix: `docs/charters/aws/charters/aws_platform_ops_program_charter.md` §4.

## Related

- Data path / bastion: `data-access.md`  
- Prod deploy block: `docs/aws-environments/` Deploy charter  
