# 03 — Automated smoke (non-auth)

**Rule:** Do not require user login or OTP. Postmark may be paused.

## Targets

- Prefer ALB DNS / SST output URL (no Wix CNAME needed).  
- Record exact base URL used:

`BASE=`

## Automated checks (extend as needed)

| # | Check | How | Pass? | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Liveness | `GET {BASE}/health/live` (or configured health path) | | status + body snippet |
| 2 | Gatekeeper admission (public) | Automated POST to brand gatekeeper validate/admission route with fixture payload | | status + safe response fields |
| 3 | Other public non-auth routes | As Product lists for this rehearsal | | |
| 4 | ALB target health | AWS CLI describe target health | | |

## Explicitly skipped (OK)

- Login / OTP / password reset (Postmark)  
- Paid Razorpay flows unless Product adds test keys checklist  
- Pretty hostname `api.thecreatorshop.in`

## Commands log

(paste non-secret CLI / curl)
