# Processes — AWS ops for humans

**Status:** TBD  
**Audience:** product, founders, eng leads, anyone who gets the email  
**Notify design:** `brian@growthverse.in` (email only for v1)

These are the **human-facing processes**. Workers execute the mechanical parts once activated; until then this is the playbook we will follow.

---

## A. Everyday mental model

1. **Deploy** changes what *should* run (SST).  
2. **Monitor** tells you if it *is* healthy.  
3. **Cost** tells you if spend is weird.  
4. **Capacity** tells you if size matches traffic.  
5. **Auditor** refreshes the written map of the account.

If you only remember one rule: **placeholder prod must stay cheap until an explicit LIVE go-live.**

---

## B. Weekly hygiene (both accounts when SSO allows)

**Goal:** no surprises in Git or inbox.

1. Run / request **Auditor** for `creator-dev` (and `creator-prod` if logged in).  
2. Diff output against last `current-state.md`.  
3. Cost skim: any service up > agreed % week-over-week (see `env/*.md`).  
4. Dev-only: confirm night/Sunday stop still looks intended.  
5. Email summary to `brian@growthverse.in` (when Monitor/Cost workers are live).  
6. Commit doc updates — chat is not the record.

**Not required weekly:** changing size, deploying, installing new alarms (until LIVE activation).

---

## C. Monthly historic pack

**Goal:** trends a weekly glance misses.

Include:

- Cost by service (Cost Explorer), top movers, tax note  
- Alarm history / outage timeline (once alarms exist)  
- Traffic proxy (ALB request count) vs ECS CPU vs Aurora ACU  
- Capacity verdict: undersized / OK / oversized for the month  
- Open risks (DNS, bastion left on, placeholder integrity)

Store under `docs/aws-environments/` or a dated note linked from there. Email the summary.

---

## D. Incident (something is down or burning money)

1. Classify env: **dev** vs **prod PLACEHOLDER** vs **prod LIVE**.  
2. Monitor checklist: ALB targets, ECS tasks, `/health/live`, recent deploy.  
3. If cost-only: Cost checklist (bastion, ACU stuck, unexpected resources).  
4. Mitigate with **smallest** change (rollback/hotfix before blind scale-up).  
5. Write a short incident note; update register if alarm gaps found.  
6. Email `brian@growthverse.in` with severity + next action.

Workers in recommend-only mode **do not** scale without Product.

---

## E. “We might need more capacity” (campaign / growth)

1. Product states expected users/time window.  
2. Capacity worker compares forecast to live metrics (or last monthly pack if pre-LIVE).  
3. Output options: do nothing / raise ECS / raise Aurora max / both / app fix.  
4. Product picks; Deploy applies SST (or mutate allow-list if unlocked).  
5. Monitor watches for 24–72h after change; Cost watches the bill.

---

## F. Production go-live (LIVE) — ops activation

When Product authorizes LIVE (separate from freeze PASS):

1. Deploy worker executes authorized prod deploy + migrate discipline (`RUN_MIGRATIONS_ON_START=false`, bastion migrate as designed).  
2. Wix/DNS for `api` as required (`dns: false` in SST).  
3. **Activate** Monitor + Cost + Capacity workers against `env/prod.md` **LIVE** profile.  
4. Install alarms from `register-alarms.md` (SNS/email → `brian@growthverse.in`).  
5. Confirm PLACEHOLDER integrity checks are **disabled** or inverted (resources *should* exist).  
6. First weekly + first monthly pack scheduled.

Until that day: keep designing here; do **not** treat missing alarms as an incident.

---

## G. Placeholder prod integrity (until LIVE)

**Goal:** the ~$2 skeleton stays a skeleton.

- Unexpected ECS / ALB / Aurora / running bastion → **high** severity email.  
- Expected: CloudFront placeholder, certs, empty compute.  
- Never “tune” an unauthorized full stack — stop and escalate.

---

## H. Changing look-and-feel of ops (docs)

1. Update `control-plane.md` / `env/*.md` / `register-alarms.md` first.  
2. Update worker charters if duties change.  
3. Only when Product says **install**, create real AWS alarms/budgets.  
4. Record alarm ARNs/IDs in `register-alarms.md`.

---

## I. Who to ask

| Question | Owner |
| --- | --- |
| May we deploy prod? | Product + Deploy charter |
| Is the site down? | Monitor (or eng on-call) |
| Why is the bill up? | Cost + Auditor |
| Do we need bigger machines? | Capacity → Product |
| What exists in AWS this week? | Auditor |
| Email not arriving? | Check SNS/subscription once installed; until then docs-only |
