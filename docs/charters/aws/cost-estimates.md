# Cost estimates (USD + INR)

**Status:** TBD — planning figures, not invoices  
**FX note:** mid-market ≈ **₹95.40 per $1 USD** (as of **2026-09-14**; Wise/XE ballpark). Recalculate when quoting finance.  
**Formula:** `INR ≈ USD × 95.40` (then round).

Tax (~16% GST-class) may apply on top of AWS — call out separately when using Cost Explorer.

## Stack run-rates (order of magnitude)

| Posture | USD / mo | INR / mo (≈) | Notes |
| --- | --- | --- | --- |
| Prod **PLACEHOLDER** | ~$2 | ~₹190 | Certs, ECR crumbs, CF placeholder — no ECS/ALB/Aurora |
| Prod **temp test / quiet LIVE floor** | ~$25–45 | ~₹2,400–4,300 | ALB (~$16) + small Fargate + Aurora Sv2 idle/storage |
| Prod **busier** | $45+ | ₹4,300+ | More tasks, higher ACU, data transfer |
| **creator-dev** (scheduled) | ~$53–67 | ~₹5,100–6,400 | ALB + small RDS + intermittent Fargate |

Sources: `docs/aws-environments/differential-and-costs.md` (USD); INR converted here.

### Rough building blocks

| Component | USD / mo while up | INR / mo (≈) |
| --- | --- | --- |
| ALB | ~$16 | ~₹1,530 |
| ECS 0.5 vCPU / 1 GB (light) | ~$5–15 | ~₹480–1,430 |
| Aurora Sv2 0–2 ACU + storage | ~$15–40+ | ~₹1,430–3,820 |
| Bastion left on | EC2 hours (avoid) | avoid |
| CloudWatch / misc | see monitoring | see monitoring |

**Temp rehearsal:** expect on the order of **~$1–2/day** (~₹95–190/day) while the full stack sits up, dominated by ALB if left overnight. Tear down same day when possible.

## Monitoring & ops extras (on top of stack)

These are **extra** costs once `INSTALL_MONITORING` / `INSTALL_BUDGETS` exist. Design assumes email to `brian@growthverse.in`.

| Item | Typical USD | INR (≈) | Notes |
| --- | --- | --- | --- |
| Custom CloudWatch alarm | ~$0.10 / alarm / mo | ~₹10 | First few are cheap; 15–20 alarms ≈ $1.50–2 (~₹140–190) |
| CloudWatch dashboard | ~$3 / mo each | ~₹290 | One prod + one optional |
| SNS email notifications | Usually **$0** at low volume | ~₹0 | Confirm account free tier |
| AWS Budgets | Free for first few budgets | ~₹0 | Extra budgets small $ |
| Cost Anomaly Detection | Low / often free tier class | ~₹0–small | Confirm at install |
| Log ingestion / retention | Variable | Variable | Keep retention bounded (`logging-and-tracing.md`) |
| Synthetics canary (if added later) | Often **$1–5+** / canary / mo | ~₹95–480+ | **Defer** for first rehearsal unless Product wants it |

**Rehearsal monitoring budget (design):** plan **~$3–8/mo** (~₹290–760) if you leave a small alarm pack + one dashboard up — or **near $0 incremental** if you install alarms only for the test day and delete them in `return-to-placeholder.md`.

## What Cost worker must report

Every Cost skim / rehearsal pack:

1. Window + account  
2. Top services in **USD and INR** (same FX note + date)  
3. Stack vs monitoring split when possible  
4. Delta vs PLACEHOLDER (~$2 / ~₹190) while on temp test  
5. Recommendation: keep up / tear down / rightsizing  

## Rehearsal-specific

During TEMP_PROD test, Cost worker compares:

| Line | Expected |
| --- | --- |
| Before | PLACEHOLDER band |
| During | Full stack band + any alarm/dashboard line items |
| After teardown | Returning to PLACEHOLDER band within a few days of Cost Explorer lag |
