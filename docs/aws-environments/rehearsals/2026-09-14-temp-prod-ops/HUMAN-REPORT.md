# HUMAN-REPORT

**Rehearsal:** 2026-09-14 → 2026-09-16 TEMP_PROD_OPS  
**Authorized by:** Brian (chat)  
**FX used:** $1 ≈ ₹95.40 (2026-09-14)

## One-paragraph summary

We stood up prod under TEMP_PROD_OPS_REHEARSAL (ALB DNS only, no Wix, no login). After an entrypoint CRLF crash, Aurora pause (P1001), and a one-shot Prisma migrate, non-auth smoke passed (health + gatekeeper admit). Monitor/Cost/Capacity each ran once read-only. Four rehearsal alarms were installed; a forced ALARM→OK worked in CloudWatch, and the SNS email to `brian@growthverse.in` **was confirmed and received** (alarm + mail PASS). Stack was torn back to PLACEHOLDER (no ALB/ECS/Aurora; bastion stopped).

## Results

| Area | Pass? | One line |
| --- | --- | --- |
| Bring-up (SST) | Yes | Complete after CRLF fix + redeploy |
| Automated smoke (non-auth) | Yes | `/health/live` 200, DB up, validate ADMITTED |
| Auditor before/after | Yes | PLACEHOLDER → full stack → PLACEHOLDER again |
| Monitor (read-only) | Yes | Healthy; flagged bastion left on |
| Cost (USD+INR) | Yes | MTD ~$1.26 / ~₹120 lagging; run-rate ~$25–45/mo while up |
| Capacity (recommend-only) | Yes | Oversized for traffic; did not scale |
| Alarms + email to brian@ | Yes | Alarms + forced state **PASS**; SNS confirmed; inbox delivery **PASS** |
| Boundary refusals | Yes | No standing-worker writes |
| Return to PLACEHOLDER | Yes | ECS/ALB/Aurora gone; bastion stopped |

## Cost snapshot

| | USD | INR (≈) |
| --- | --- | --- |
| Before (PLACEHOLDER) | ~$2 | ~₹190 |
| During (stack + monitoring) | ~$25–45/mo class; ~1–2 days up incl. overnight ALB | ~₹2,400–4,300/mo class |
| Monitoring extras alone | ~$0.40/mo if kept; **deleted** | ~₹38 |
| After teardown (expected band) | back toward ~$2 after CE lag | ~₹190 |

## Follow-ups

- SNS alarm email to `brian@growthverse.in`: **CLOSED** — confirmed; inbox delivery proven during rehearsal.  
- Next prod deploy: expect stale SST/Pulumi ARNs; refresh/state-remove before recreate.  
- Aurora min ACU 0.5 was a pause workaround — decide at real LIVE.  
- Overnight ALB: tear down same calendar day next time.
