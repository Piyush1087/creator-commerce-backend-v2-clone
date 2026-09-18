# 10 — Teardown (`RETURN_TO_PLACEHOLDER`)

**ENVELOPE:** `RETURN_TO_PLACEHOLDER` (named in `00-authorization.md`)  
**Actor:** Deploy (not standing Monitor/Cost/Capacity)  
**Started (IST):** 2026-09-16 ~12:49  
**Finished (IST):** 2026-09-16 ~13:05  

`sst.config.ts` has `removal: "retain"` — **did not** use `sst remove`. CLI-deleted bill drivers. CloudFront dashboard kept.

## Plan vs result

1. Delete rehearsal alarms + SNS  
2. ECS desired 0 → delete service `api` → delete cluster  
3. Delete ALB + target group  
4. Delete Aurora instance + cluster (`--skip-final-snapshot`, disposable)  
5. Stop bastion `i-01586cb9465e9fbc5`  
6. After-auditor (`11-after-auditor.md`)

## Log

| Step | Result | Notes |
| --- | --- | --- |
| Alarms/SNS | **PASS** | 4 alarms deleted; topic `creatorshop-prod-ops-rehearsal` deleted (sub had been **Confirmed**; inbox proven earlier) |
| ECS | **PASS** | desired 0 → service `api` DRAINING/deleted → cluster **INACTIVE** |
| ALB | **PASS** | `apiLoadBalancer-hmkxnkxh` deleted; TG deleted after LB gone (`ResourceInUse` on first TG try) |
| Aurora | **PASS** | instance `…-coreinstance-ctbevuzr` deleted; cluster `…-corecluster-xobvxxnw` delete submitted; after-auditor lists **0** clusters/instances |
| Bastion | **PASS** | `i-01586cb9465e9fbc5` **stopped** (t4g.nano; not terminated — EBS pennies) |
| NAT | none listed after teardown | EIPs from mid-run also gone from describe-addresses |

## SST state

Resources were deleted **outside** Pulumi. Next `sst deploy --stage prod` will likely hit stale ARNs (same class as bring-up attempt 1). Expect `sst refresh` / `sst state remove` before recreate. CloudFront `E3O06GGVRRZSRL` untouched (frontend).
