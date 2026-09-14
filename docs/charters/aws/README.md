# AWS platform ops (charters)

**Status:** TBD — design package only. No live CloudWatch alarms or scheduled audits are installed yet.  
**Notify (v1 design):** email → `brian@growthverse.in`  
**Accounts:** `creator-dev` (smoke / rehearsal) · `creator-prod` (design target for LIVE; today often PLACEHOLDER)

This folder designs how we **automate an AWS expert’s ongoing role**: monitor health, catch cost blow-ups, advise (and later optionally apply) scale, and leave durable docs so we are not re-asking chat to “just check AWS.”

Deploying the app remains a **different** job — see `docs/aws-environments/` (Auditor, Deploy, Hotfix).

---

## Read this first if you are not deep in AWS

### What problem we are solving

SST can **create and update** infrastructure when someone deploys. That is not the same as:

- knowing the app is healthy right now  
- knowing last week’s spend spiked  
- knowing whether 1 000 users need more CPU or database capacity  
- knowing which knobs AWS moves for us vs which we must change in config  

Today, those questions are answered by ad‑hoc agent audits. This package turns that into **named workers + written processes** so when production goes live we can activate them immediately.

### Two environments (simple picture)

| | **creator-dev** | **creator-prod** |
| --- | --- | --- |
| Purpose | Smoke tests, shared URLs, cheap rehearsal | Real users (when LIVE) |
| Today | Small real stack (often scheduled down nights/Sunday) | Often a **PLACEHOLDER** (~$2/mo): almost no compute/DB |
| How we treat alarms | Softer; “off at night” can be normal | PLACEHOLDER vs LIVE profiles (see `env/prod.md`) |
| Primary design target for “real ops” | Practice ground | **Yes — design as if LIVE is coming** |

Important: a normal `sst deploy --stage prod` is **not** a harmless refresh. If the account is still a placeholder, that deploy **creates** the expensive stack (API load balancer, containers, Aurora database, bastion). Product must authorize go-live separately.

### Who does what (workers)

| Worker | In one sentence | Access (standing) | Lives in |
| --- | --- | --- | --- |
| **Auditor** | Read-only: what exists, what it costs, docs vs AWS | **Read-only** | `docs/aws-environments/` |
| **Deploy** | Run SST deploy when authorized | Elevated (Deploy charter only) | `docs/aws-environments/` |
| **Hotfix** | Optional API image overlay (not full SST) | Elevated (Hotfix charter only) | `docs/aws-environments/` |
| **Monitor** | Health, outages; designs alarms | **Read-only** (install alarms only with Product envelope) | `charters/` here |
| **Cost** | Budgets design, spikes, monthly history | **Read-only** (budgets install only with envelope) | `charters/` here |
| **Capacity** | “Enough resources?” recommend | **Read-only** (scale apply only with Product allow-list) | `charters/` here |

**Boundaries beat SSO:** even with admin login, ops workers stay read-only unless Product names an install/mutate envelope. Details: `charters/aws_platform_ops_program_charter.md` §4.

### Two operating modes (Product chooses later)

Both are **designed now**:

1. **Recommend-only / read-only (default)** — all three ops workers **observe only**; Git reports + email; humans/Deploy change AWS.  
2. **Named Product envelopes** — rare writes: `INSTALL_MONITORING`, `INSTALL_BUDGETS`, `MUTATE_CAPACITY`, `MUTATE_COST_STOP` — each with a hard allow-list. Admin SSO does not skip this.

Default until Product says otherwise: **read-only / recommend-only**.

### Where to go next

| I want… | Open |
| --- | --- |
| Plain-language processes (weekly, monthly, incident, go-live) | [`processes.md`](./processes.md) |
| What AWS auto-manages vs what we control / how to scale | [`control-plane.md`](./control-plane.md) |
| Intended alarms (not installed yet) + email target | [`register-alarms.md`](./register-alarms.md) |
| Dev-specific thresholds and “off is OK” | [`env/dev.md`](./env/dev.md) |
| Prod PLACEHOLDER vs LIVE profiles | [`env/prod.md`](./env/prod.md) |
| Scenario catalog (outage, cost, scale, drift) | [`scenarios.md`](./scenarios.md) |
| Backup / restore | [`backup-and-restore.md`](./backup-and-restore.md) |
| Logs and how we debug | [`logging-and-tracing.md`](./logging-and-tracing.md) |
| WAF / edge decision | [`edge-and-waf.md`](./edge-and-waf.md) |
| Postmark, Razorpay, DNS, etc. | [`external-dependencies.md`](./external-dependencies.md) |
| SSO / IAM overview (deeper file later) | [`iam-and-sso.md`](./iam-and-sso.md) |
| Who may touch DB / bastion (deeper file later) | [`data-access.md`](./data-access.md) |
| Region / DR posture | [`disaster-recovery.md`](./disaster-recovery.md) |
| Worker charters + kickoff prompts | [`charters/`](./charters/) |

Live account snapshots and cost notes stay in **`docs/aws-environments/`** (`current-state.md`, `differential-and-costs.md`). This folder does not replace those facts — it defines how we **run** on top of them.
