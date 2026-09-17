# 03 — Automated smoke (non-auth)

**Rule:** Do not require user login or OTP. Postmark may be paused.

## Targets

`BASE=https://apiLoadBalancer-hmkxnkxh-711068316.ap-south-1.elb.amazonaws.com`  
(No Wix CNAME. ALB listener is **HTTPS:443 only** — use `https://` + `curl -k` for self-signed/ACM mismatch in CLI.)

## Findings trail

| When | Check | Result |
| --- | --- | --- |
| Earlier | ECS running 0 / CRLF entrypoint | Fixed (LF + Dockerfile `sed`) + redeploy |
| Earlier | `/health` DB P1001 (Aurora pause) | Raised Aurora Sv2 **MinCapacity 0.5** |
| Earlier | validate 500 missing relations | ECS Exec `npx prisma migrate deploy` → **94 migrations applied** |
| 2026-09-15 ~18:30 IST | Smoke retest | PASS (below) |

## Results (2026-09-15)

| # | Check | How | Pass? | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Liveness | `GET {BASE}/health/live` | **PASS** | HTTP 200 `{"status":"ok"}` |
| 2 | Readiness | `GET {BASE}/health` | **PASS** | HTTP 200 database `up` |
| 3 | Public support | `GET {BASE}/api/v1/discovery/support` | **PASS** | HTTP 200 |
| 4 | Gatekeeper validate | `POST {BASE}/api/v1/discovery/validate` | **PASS** | HTTP 200; `decision.outcome=ADMITTED`; leadId `8cb3143f-e076-421e-a6ed-ed7a586c0acc` |
| 5 | ALB target healthy | AWS CLI | **PASS** | TG `HTTP20260914093556276000000001` → `10.0.3.123:80` **healthy** |
| 6 | ECS steady | AWS CLI | **PASS** | service `api` desired=1 running=1 |

### Validate body used

```json
{
  "url": "https://example.com",
  "ownershipAuthorizationAttested": true,
  "termsAccepted": true,
  "privacyPolicyAccepted": true
}
```

### Notes

- Path is `/api/v1/discovery/validate` (not `/gatekeeper/validate`).
- PowerShell `Invoke-WebRequest` TLS to this ALB failed; `curl.exe -sk` worked.
- JSON body must be passed via `--data-binary @file` (inline `-d` mangled under PowerShell).
