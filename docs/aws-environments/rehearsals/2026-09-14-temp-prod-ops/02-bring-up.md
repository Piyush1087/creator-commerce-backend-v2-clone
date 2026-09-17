# 02 — Bring-up

**ENVELOPE:** TEMP_PROD_OPS_REHEARSAL (Deploy)  
**Backend SHA (start):** `1a2d25b` (+ local uncommitted entrypoint/Dockerfile fix for crash)  
**Profile:** `creator-prod` / `250037328530`

## Attempt log

| # | Result | Notes |
| --- | --- | --- |
| 1 | FAIL | Stale Pulumi state: ALB/TG ARNs deleted in PLACEHOLDER teardown |
| 2 | FAIL | Aurora param group PG16 in state vs provider PG17 |
| Fix A | DONE | refresh + delete PG16 groups + `sst state remove` |
| 3 | HUNG → KILLED | Docker engine down mid image build |
| 4 | PASS (infra) | `✓ Complete` — Aurora, ALB, ECS service, image; SST url `https://api.thecreatorshop.in/` |
| 5 | FAIL (runtime) | Tasks crash: `exec docker-entrypoint.sh failed: No such file or directory` ← **CRLF** |
| Fix B | DONE (repo) | LF entrypoint + Dockerfile `sed` strip `\r` + `.gitattributes` |
| 6 | FAIL | Redeploy died mid `npm run build`: docker-build RPC EOF + aws provider exited |
| 7 | IN FLIGHT | Retry `sst deploy --stage prod` after failure |

## Outputs (after attempt 4)

- ALB: `apiLoadBalancer-hmkxnkxh-711068316.ap-south-1.elb.amazonaws.com`  
- ECS cluster + service `api` (desired 1; was running 0 while crashing)  
- Aurora cluster available  

## Notes

- No Wix CNAME.  
- `C03_INVITATION_IDENTITY_HMAC_PEPPER_PROD` generated in local `.env` for rehearsal.  
- `RUN_MIGRATIONS_ON_START=false` — migrate via bastion if schema needed after healthy boot.  
- Billable stack is live until `RETURN_TO_PLACEHOLDER`.
