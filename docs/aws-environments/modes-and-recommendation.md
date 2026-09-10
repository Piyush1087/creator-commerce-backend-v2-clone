# Modes, operations, and recommendation

This file records a **possible** three-mode design for the prod account, how DNS and migrate would work, and then **rejects adopting it now**.

## Recommendation (standing)

**Do not add a third mode or a third SST stage. Do not use `creator-prod` as a test bed. Do not `sst deploy --stage prod` until real go-live.**

Keep:

- **`creator-dev` / `--stage dev`** — the application test environment (small RDS, scheduled ECS, working `*.dev.thecreatorshop.in` URLs, auto-migrate).
- **`creator-prod` / `--stage prod`** — placeholder (~$2/mo). Dashboard CNAME may stay on CloudFront placeholder. API stays NXDOMAIN.

Test freeze or `development` **on creator-dev** (or locally). When production is actually required, treat that as **LIVE**: review migrations, deploy, add Wix `api`, confirm dashboard CNAME target, leave auto-migrate **off** until explicitly changed.

### Why not three modes / “test on prod” now

| Lens | Why staying on two accounts wins |
| --- | --- |
| **Complexity** | TEST_MINI needs a migrate flag split from LIVE, CORS/`VITE_API_URL` vs pretty names, Wix checklist vs ALB recreate, and a profile-map trap (`stage !== prod` already uses **creator-dev**). That is a second product. |
| **Usefulness** | creator-dev already does “share a URL, log in, break it.” Prod-as-test does not add a capability the team lacks; it adds a second copy. |
| **Redundancy** | Two billed APIs + two DBs for the same app. Freeze vs `development` is a **git branch** problem, not an AWS-account problem. Deploy the branch under test to **dev** if that is the requirement. |
| **Cost** | Dev already ~$55–67/mo. TEST_MINI re-creates ALB (~$16) + DB + Fargate **on top** of that, or it deletes ALB and then **Wix every cycle**. Placeholder prod at ~$2 is the cheap insurance policy. Lighting it up “to try freeze” throws that away. |
| **Safety** | `--stage prod` sets `STAGE=prod` (no OTP in logs, empty apply-bypass) **and** attaches real hostnames/certs. A mistaken Wix `api` record is a public site. Dev is already isolated on `*.dev.thecreatorshop.in`. |

Charters under [`charters/`](./charters/) are **Auditor** (read-only), **Deploy** (SST, dev default), and **Hotfix** (optional API overlay on a running service). There is no Mode Operator worker. Deploy returns `STOP_PROD_NOT_AUTHORIZED` for prod until Product names LIVE/go-live. Hotfix returns `STOP_PROD_HOTFIX_NO_STACK` until that LIVE stack exists. Procedure: [`../deployment/hotfix/README.md`](../deployment/hotfix/README.md).

---

## Future design only: three modes on prod

Not implemented. Do not encode this in `sst.config.ts` until Product activates it.

| Mode | Intent | Compute / DB | Auto-migrate | Pretty DNS |
| --- | --- | --- | --- | --- |
| **PLACEHOLDER** | Idle prod account | No ECS, no ALB (or ALB kept if paying for stable CNAME), no RDS/Aurora | n/a | `api` NXDOMAIN or dangling; dashboard may stay on CloudFront |
| **TEST_MINI** | Prod **account**, test app | Small RDS or Aurora 0–2 + 1 ECS task + ALB | **On** (empty DB must migrate on first boot) | Optional Wix `api` |
| **LIVE** | Real users | Sized like SST prod today | **Off** until explicit | Wix `api` + `dashboard` |

TEST_MINI auto-migrate is correct **if and only if** the DB is disposable and the flag cannot silently apply to LIVE. That implies either a **separate SST stage in the prod account** (and a **profile-map change**, because today non-`prod` stages use `creator-dev`) or an explicit `PROD_MODE` env that humans cannot leave wrong.

LIVE stays `RUN_MIGRATIONS_ON_START=false`. First LIVE boot uses bastion/tunnel `prisma migrate deploy` after SQL review. `migrate reset` is forbidden.

### CNAME (Wix)

SST sets `dns: false`. **No mode switch updates Wix.**

- Dashboard CNAME today already points at `dqhsgqysek6if.cloudfront.net`. FE deploy usually **keeps** that domain; only the origin changes. Often **no Wix edit** for dashboard.
- API CNAME is **missing**. Creating TEST_MINI/LIVE ALB requires **adding** `api` → current ALB DNS. Recreating the ALB (typical if PLACEHOLDER **deletes** it) requires **editing** that record. SST will not do it.
- ALB delete does **not** delete Wix. Either remove `api` on PLACEHOLDER (clean NXDOMAIN) or leave a dead target.

**Stable CNAME vs cheap PLACEHOLDER:** keep the ALB (~$16/mo) and never retarget `api`; or delete the ALB and accept a Wix edit every TEST_MINI.

### Sharing a URL without Wix

Current SST **cannot** pair `https://dxxxx.cloudfront.net` with `*.elb.amazonaws.com` in a browser:

- FE prod build always calls `https://api.thecreatorshop.in`.
- ALB cert is for that name, not the ELB hostname.
- HTTPS page + HTTP API = mixed content.

Without Wix, the only zero-SST-change browser path is a **hosts file** on each tester (`C:\Windows\System32\drivers\etc\hosts` or `/etc/hosts`) mapping `api` / `dashboard` to ALB / CloudFront IPs, then opening the pretty names. That is not a Slack-and-click link. Phones and anyone without the file fail.

A shareable CloudFront.net link that logs in would require SST/CORS/`VITE_API_URL` (or a CloudFront `/api` origin). That is a behavior change. Out of scope while the recommendation is “don’t touch prod.”

### Hypothetical TEST_MINI deploy (do not run)

1. SSO `creator-prod`. WSL. Confirm stage/profile.
2. Backend `sst deploy --stage prod` — **this leaves placeholder** and creates the billed stack with **today’s** config.
3. Because migrate is **false**, tunnel via the **new** prod bastion and `db:migrate:deploy`.
4. Frontend `sst deploy --stage prod`.
5. Wix `api` → new ALB (dashboard CNAME likely already correct; confirm CloudFront domain).
6. Smoke `https://dashboard.thecreatorshop.in` and `/health/live`. `/health/live` does **not** prove Postgres.

Tear-down to PLACEHOLDER: scale ECS 0 and delete DB/ALB if saving money; **then** fix or remove Wix `api`.

### Hypothetical LIVE (later)

Same deploy family, but: reviewed migrations, migrate remains **false** unless Product flips it, `STAGE=prod` on purpose, empty apply-bypass, real Postmark, provider URLs, no dev stop schedule. Wix is the public site. Do not use TEST_MINI leftovers (open CORS, CloudFront.net origins) on LIVE.

---

## What to do instead (now)

| Need | Where |
| --- | --- |
| Test current `development` | `creator-dev` (already frozen there as the AWS test app) |
| Test freeze SHAs | Deploy freeze **to creator-dev** when that is an explicit release to the test URL, **or** run locally against compose Postgres. Do not stand up prod. |
| Save money | Leave prod placeholder. Optional: finish the pending **dev** WSL deploy so Pulumi drops ghost Aurora. |
| Prod go-live | New decision: LIVE checklist in `docs/deployment/README.md`, after freeze/security gates that are still **not** PASS. |

## Workers

Layout matches dummy_tcs: **charters folder holds principal charters only.** Initiation prompts sit one level up in this directory.

| Worker | Charter | Initiation |
| --- | --- | --- |
| AWS Auditor (read-only) | [`charters/aws_auditor_ai_worker_charter.md`](./charters/aws_auditor_ai_worker_charter.md) | [`aws_auditor_ai_worker_initiation.md`](./aws_auditor_ai_worker_initiation.md) |
| AWS Deploy (dev default) | [`charters/aws_deploy_ai_worker_charter.md`](./charters/aws_deploy_ai_worker_charter.md) | [`aws_deploy_ai_worker_initiation.md`](./aws_deploy_ai_worker_initiation.md) |

There is **no** Mode Operator charter. PLACEHOLDER / TEST_MINI / LIVE stay in this file as future design. Prod deploy is `STOP_PROD_NOT_AUTHORIZED` on the Deploy worker until Product names LIVE/go-live.
