# 09 — Weekly-style pack (even if window under 7 days)

Use this shape for the **current rehearsal window** (e.g. 4–24 hours). Later weekly jobs fill the same template with a real week.

## Window

- Start (IST): 2026-09-14 (bring-up)  
- End (IST): 2026-09-16 (teardown in progress)  
- Account: `creator-prod` (TEMP test)  
- FX: $1 ≈ ₹95.40 as of 2026-09-14  

## Inventory delta

| Resource | Baseline PLACEHOLDER | During test | After teardown |
| --- | --- | --- | --- |
| ECS | 0 | cluster + service `api` desired 1 | **0** (cluster INACTIVE) |
| ALB | 0 | `apiLoadBalancer-hmkxnkxh` HTTPS | **0** |
| Aurora/RDS | 0 | Sv2 min 0.5 / max 2.0 | **0** |
| Bastion | 0 running | `i-01586cb9465e9fbc5` t4g.nano running | **stopped** |

## Cost (Cost Explorer or estimate)

| Service | USD | INR (≈) | Note |
| --- | --- | --- | --- |
| Route 53 (MTD) | 0.50 | ₹48 | not rehearsal-only |
| ELB (MTD, lagging) | 0.33 | ₹32 | will rise; ALB ~$16/mo class |
| Secrets Manager | 0.19 | ₹18 | |
| RDS (MTD, lagging) | 0.08 | ₹8 | Aurora hours |
| VPC | 0.08 | ₹8 | |
| **MTD visible** | **~$1.26** | **~₹120** | through 2026-09-14 (CE lag) |
| Monitoring extras | ~$0.40/mo if kept | ~₹38 | 4 alarms; delete at teardown |

Vs PLACEHOLDER (~$2 / ~₹190): delta = **full-stack band while up**; overnight ALB is the miss vs “same-day teardown.”

## Health / alarms

- Alarms installed? **Yes** (4 + SNS)  
- Test firings? **Forced ALARM then OK** on `ALB-UNHEALTHY`  
- Email received at `brian@growthverse.in`? **Yes** — SNS subscription confirmed; inbox delivery **PASS**  

## Capacity snapshot

- ECS CPU/mem peak: CPU **52%** (migrate), mem **23%**; idle CPU <1% / mem ~14%  
- Aurora ACU peak: **2.0** brief; floor **0.5**  
- Verdict: **oversized** for traffic / **OK** for one-task smoke  

## Worker runs (each once — not continuous)

| Worker | Ran? | ACCESS / ENVELOPE | Pass? |
| --- | --- | --- | --- |
| Auditor | Yes (baseline) | READ_ONLY | PASS |
| Monitor | Yes | READ_ONLY | PASS |
| Cost | Yes | READ_ONLY | PASS |
| Capacity | Yes | READ_ONLY | PASS |

## Actions / follow-ups

- SNS alarm email inbox proof: **CLOSED** (confirmed + received).  
- `RETURN_TO_PLACEHOLDER` — CLI delete bill drivers (`sst.config` `removal: retain` blocks `sst remove` from deleting).  
- Next deploy must expect stale Pulumi ARNs (same class as bring-up attempt 1) unless state is cleaned.
