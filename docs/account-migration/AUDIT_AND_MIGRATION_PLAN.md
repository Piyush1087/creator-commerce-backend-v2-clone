# Account migration audit & plan

**Date:** 2026-07-17  
**Scope:** Move identity from `@growthverse.in` → `@thecreatorshop.in`  
**v1:** Out of scope — v2 deployed into same AWS accounts/domains.

---

## Executive summary

| Question | Answer |
|----------|--------|
| Need fresh AWS / SST setup? | **No** |
| Need domain/infra migration? | **No** — v2 already on `thecreatorshop.in` |
| What to migrate? | Account emails, SSO users, GitHub, Workspace, Wix account email |
| Dev vs prod | **Two AWS accounts**, same SSO org (`growthverse.awsapps.com`) |

---

## AWS accounts & profiles

| Profile | Account ID | SSO role | Region |
|---------|------------|----------|--------|
| `creator-dev` | `841162679642` | `AdministratorAccess` | `ap-south-1` |
| `creator-prod` | `250037328530` | `AdministratorAccess` | `ap-south-1` |

SSO portal (both): `https://growthverse.awsapps.com/start/`

CLI config: `~/.aws/config` → `[profile creator-dev]` / `[profile creator-prod]`

---

## Live endpoint audit (2026-07-17)

| URL | HTTP | Backend |
|-----|------|---------|
| `https://api.dev.thecreatorshop.in/health/live` | 200 | `{"status":"ok"}` |
| `https://dashboard.dev.thecreatorshop.in/` | 200 | CloudFront → S3 |
| `https://api.thecreatorshop.in/health/live` | **503** | ALB — no healthy ECS target (ops issue, not migration) |
| `https://dashboard.thecreatorshop.in/` | 200 | CloudFront → S3 |

---

## DNS audit

| Domain | Points to | Notes |
|--------|-----------|-------|
| `api.dev.thecreatorshop.in` | `crea-dev-apiLoadBalancer-*.elb.amazonaws.com` | SST backend ALB |
| `api.thecreatorshop.in` | `cre-prod-apiloadBalancer-*.elb.amazonaws.com` | SST backend ALB |
| `dashboard.dev.thecreatorshop.in` | `d1043i50mi2zei.cloudfront.net` | SST frontend |
| `dashboard.thecreatorshop.in` | `dqhsgqysek6if.cloudfront.net` | SST frontend |
| `thecreatorshop.in` | Wix (`185.230.63.*`) | Marketing |
| `www.thecreatorshop.in` | Wix (`cdn1.wixdns.net`) | Marketing |
| `growthverse.in` | Wix (`185.230.63.*`) | Old marketing — keep/redirect later |

**MX:** `thecreatorshop.in` → Google Workspace (Wix DNS: `ns14/15.wixdns.net`)  
**MX:** `growthverse.in` → Google Workspace

No public Route 53 zones for `thecreatorshop.in` or `growthverse.in` in dev account (DNS managed outside AWS).

---

## SST deployment map (v2)

### Backend — `creatorshop-be`

- **Repo:** `creator-commerce-backend-v2`
- **SST:** `sst.config.ts` · app `creatorshop-be` · region `ap-south-1`
- **Stages:** `dev` → `creator-dev` · `prod` → `creator-prod`
- **Domains:** `api.dev.thecreatorshop.in` / `api.thecreatorshop.in`
- **Stack:** VPC → Aurora/RDS → ECS cluster → ALB (HTTPS) + public S3 bucket
- **Docker:** `Dockerfile` + `scripts/docker-entrypoint.sh` (Prisma migrate on dev start)
- **Deploy (WSL):**
  ```bash
  export AWS_PROFILE=creator-dev   # or creator-prod
  export SST_SKIP_DEPENDENCY_CHECK=1
  aws sso login --profile creator-dev
  npm run prisma:generate && npm run build
  npx sst deploy --stage dev --print-logs
  ```

### Frontend — `creatorshop-fe`

- **Repo:** `creator-commerce-frontend-v2`
- **SST:** `sst.config.ts` · app `creatorshop-fe` · `sst.aws.StaticSite`
- **Domains:** `dashboard.dev.thecreatorshop.in` / `dashboard.thecreatorshop.in`
- **ACM:** CloudFront certs in `us-east-1`; API certs in `ap-south-1`
- **Deploy:** same profile/stage pattern as backend

### Dev AWS resources (account `841162679642`)

| Resource | Detail |
|----------|--------|
| ECS | `creatorshop-be-dev-apiclusterCluster` → service `api` (1/1 running) |
| ALB | `crea-dev-apiLoadBalancer` |
| RDS | `creator-dev-postgres-small` (Postgres 16, `creatorshop_be`) |
| CloudFront | `dashboard.dev.thecreatorshop.in` → `creatorshop-fe-dev-reactappassets-*` |
| ACM (ap-south-1) | `api.dev.thecreatorshop.in` — issued, in use |
| ACM (us-east-1) | `dashboard.dev.thecreatorshop.in` — issued, in use |
| S3 | `creatorshop-v2-files-dev`, SST asset/state buckets, legacy `creatorshop-be-*` |
| EC2 | Jumpbox `temp-dev-db-ssm-jump` (stopped); one `t4g.nano` running |
| SES | No verified identities (email via Postmark) |
| SNS | `rds-dev-alerts` — check subscriber emails |
| IAM users | `s3-upload-user` only (day-to-day via SSO) |

**No `growthverse.in` references in v2 code or dev ACM certs.**

---

## Migration checklist (identity only)

### Phase 0 — Prerequisites

- [ ] Create `@thecreatorshop.in` mailboxes in Google Workspace (`admin@`, `billing@`, dev addresses)
- [ ] Confirm inbound mail works (AWS verification depends on this)
- [ ] Enable MFA on root for dev and prod accounts

### Phase 1 — AWS root email (per account)

Do separately for dev (`841162679642`) and prod (`250037328530`):

- [ ] Sign in as **root user** (current `@growthverse.in`)
- [ ] Account → Account settings → edit **Root user email** → `@thecreatorshop.in`
- [ ] Verify from old and new inboxes
- [ ] Update Operations / Billing / Security contacts
- [ ] Review Billing budgets and SNS `rds-dev-alerts` (and prod equivalents) for old emails

**Does not affect:** ECS, RDS, S3, CloudFront, certs, DNS, SSO profiles.

### Phase 2 — AWS SSO (developers)

- [ ] Identity Center → Users → update emails to `@thecreatorshop.in`
- [ ] Confirm `AdministratorAccess` permission set still assigned to dev + prod accounts
- [ ] Local `~/.aws/config` profiles **unchanged** — only SSO login email changes

**Add new developer with admin access:**

1. Identity Center → Add user (`name@thecreatorshop.in`)
2. Assign `AdministratorAccess` to accounts `841162679642` and `250037328530`
3. User accepts invite, runs `aws sso login --profile creator-dev`

**Root user:** account email, billing, recovery only — not daily deploys.

### Phase 3 — GitHub

See [github.md](./github.md).

- [ ] Add + verify `@thecreatorshop.in` email
- [ ] Set as primary; keep old email temporarily
- [ ] Audit Actions secrets for hardcoded `@growthverse.in`
- [ ] `git config --global user.email` on all machines
- [ ] Consider `thecreatorshop` org for prod repo ownership

### Phase 4 — Google Workspace

- [ ] Add `thecreatorshop.in` domain (DNS TXT via Wix if needed)
- [ ] Create user mailboxes
- [ ] Optionally promote to primary domain later

### Phase 5 — Wix

- [ ] Change Wix account email to `@thecreatorshop.in`
- [ ] Later: 301 `growthverse.in` → `thecreatorshop.in`

### Phase 6 — Integrations spot-check

- [ ] Postmark: `no-reply@thecreatorshop.in` verified
- [ ] Razorpay webhooks: `api.thecreatorshop.in` / `api.dev.thecreatorshop.in`
- [ ] Google OAuth redirect URIs
- [ ] Meta / Instagram app settings

---

## Ops follow-up (not migration)

- [ ] **Prod API 503** — `api.thecreatorshop.in` returns ALB 503; frontend prod is 200. Check ECS service health in prod account after `aws sso login --profile creator-prod`.

---

## Related docs

- [AWS migration.md](./AWS%20migration.md) — simple root email change (use this)
- [AWS migration detailed.md](./AWS%20migration%20detailed.md) — full domain migration (**not needed** for v2)
- [github.md](./github.md) — GitHub email migration
- [../deployment/README.md](../deployment/README.md) — SST backend deploy
- Frontend: `creator-commerce-frontend-v2/docs/deployment/README.md`
