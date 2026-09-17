# 05 — Cost skim

**ACCESS:** `READ_ONLY`  
**FX:** $1 ≈ ₹95.40 (2026-09-14)  
**Window:** Cost Explorer MTD 2026-09-01 → 2026-09-15 (End exclusive — **today’s hours lag**)

## MTD unblended (USD)

| Service | USD | INR (≈) |
| --- | --- | --- |
| Amazon Route 53 | 0.50 | ₹48 |
| Amazon Elastic Load Balancing | 0.33 | ₹32 |
| AWS Secrets Manager | 0.19 | ₹18 |
| Amazon VPC | 0.08 | ₹8 |
| Amazon Relational Database Service | 0.08 | ₹8 |
| AWS Cost Explorer | 0.03 | ₹3 |
| ECR | 0.03 | ₹3 |
| S3 / CloudFront / ECS / EC2 compute | <0.02 | <₹2 |
| **MTD total (visible groups)** | **~$1.26** | **~₹120** |

CE has not yet absorbed a full day of ALB+Aurora+Fargate at run-rate. Treat MTD as **lagging**.

## Estimate while stack is up (not invoice)

| Line | USD / mo class | INR (≈) | Note |
| --- | --- | --- | --- |
| PLACEHOLDER floor | ~$2 | ~₹190 | certs / CF / crumbs |
| Temp full stack | ~$25–45 | ~₹2,400–4,300 | ALB ~$16 dominates |
| This window (~1–2 days if torn down today) | ~$1–2 | ~₹95–190 | `cost-estimates.md` |
| Bastion t4g.nano left running | extra EC2 hours | avoid | `i-01586cb9465e9fbc5` |

## Recommendation

**Tear down same day** (`RETURN_TO_PLACEHOLDER`). Do not leave ALB overnight. Stop bastion as part of teardown. No `INSTALL_BUDGETS` this rehearsal.

Delta vs PLACEHOLDER: rehearsal is in the **full-stack band** until teardown; CE will show ELB/RDS/ECS rising over the next 1–2 days.
