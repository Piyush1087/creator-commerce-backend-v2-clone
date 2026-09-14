# AWS platform ops (charters)

**Status:** TBD — design package only. No live CloudWatch alarms or scheduled audits are installed yet.  
**Notify (v1 design):** email → `brian@growthverse.in`  
**Accounts:** `creator-dev` (smoke / rehearsal) · `creator-prod` (design target for LIVE; today often PLACEHOLDER)  
**Money:** quotes in **USD and INR** — see [`cost-estimates.md`](./cost-estimates.md) (FX dated in that file)

This folder designs how we **automate an AWS expert’s ongoing role**: health, cost, capacity — via **SST, CLI, and named workers**, not console click-ops or endless chat audits.

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

### How and when workers run (important)

**Workers are not always on.** CloudWatch/SNS (after install) watch 24/7; **Monitor / Cost / Capacity / Auditor run only when triggered** — weekly schedule, monthly pack, alarm email, or on-demand assignment — then stop.

| Trigger | Runs |
| --- | --- |
| On demand (chat initiation) | Any worker |
| Weekly / monthly automation (later) | Auditor + Cost (+ Capacity monthly) |
| Alarm email | Human/automation starts Monitor |
| Temp prod rehearsal | Full sequence once, then teardown |

Details: [`worker-runtime-and-automation.md`](./worker-runtime-and-automation.md).

### Two environments (simple picture)

| | **creator-dev** | **creator-prod** |
| --- | --- | --- |
| Purpose | Smoke tests, shared URLs, cheap rehearsal | Real users (when LIVE) |
| Today | Small real stack (often scheduled down nights/Sunday) | Often a **PLACEHOLDER** (~$2/mo / ~₹190): almost no compute/DB |
| How we treat alarms | Softer; “off is OK” at night | PLACEHOLDER vs LIVE profiles (see `env/prod.md`) |
| Primary design target for “real ops” | Practice ground | **Yes — design as if LIVE is coming** |

Important: a normal `sst deploy --stage prod` is **not** a harmless refresh. If the account is still a placeholder, that deploy **creates** the expensive stack. Product must authorize go-live **or** a temp rehearsal that **returns to PLACEHOLDER** after.

### Who does what (workers)

| Worker | In one sentence | Access (standing) | Lives in |
| --- | --- | --- | --- |
| **Auditor** | Read-only: what exists, what it costs, docs vs AWS | **Read-only** | `docs/aws-environments/` |
| **Deploy** | Run SST deploy when authorized | Elevated (Deploy charter only) | `docs/aws-environments/` |
| **Hotfix** | Optional API image overlay (not full SST) | Elevated (Hotfix charter only) | `docs/aws-environments/` |
| **Monitor** | Health, outages; designs alarms | **Read-only** (install only with envelope) | `charters/` here |
| **Cost** | Budgets design, spikes, history | **Read-only** (install only with envelope) | `charters/` here |
| **Capacity** | “Enough resources?” recommend | **Read-only** (mutate only with allow-list) | `charters/` here |

**Boundaries beat SSO.** Details: `charters/aws_platform_ops_program_charter.md` §4.

### Two operating modes (Product chooses later)

1. **Recommend-only / read-only (default)** — observe; Git + email; Deploy/SST changes AWS.  
2. **Named Product envelopes** — `INSTALL_MONITORING`, `INSTALL_BUDGETS`, `MUTATE_CAPACITY`, `MUTATE_COST_STOP`, `RETURN_TO_PLACEHOLDER`.

### Temp prod test (before permanent LIVE)

See [`processes.md`](./processes.md) §J. Bring stack up with SST → automated **non-auth** smoke (no login/CNAME) → run each worker once → test alarms/email → record full + human reports → [`return-to-placeholder.md`](./return-to-placeholder.md). Templates: `docs/aws-environments/rehearsals/`.

### Where to go next

| I want… | Open |
| --- | --- |
| Processes (weekly, monthly, incident, go-live, **temp rehearsal**) | [`processes.md`](./processes.md) |
| How/when workers run + automation | [`worker-runtime-and-automation.md`](./worker-runtime-and-automation.md) |
| USD + INR cost + monitoring extras | [`cost-estimates.md`](./cost-estimates.md) |
| Scale prod back to cheap skeleton | [`return-to-placeholder.md`](./return-to-placeholder.md) |
| Auto vs manual / scale guide | [`control-plane.md`](./control-plane.md) |
| Alarm catalog | [`register-alarms.md`](./register-alarms.md) |
| Dev / prod overlays | [`env/dev.md`](./env/dev.md), [`env/prod.md`](./env/prod.md) |
| Scenarios | [`scenarios.md`](./scenarios.md) |
| Backup, logs, WAF, deps, IAM, data, DR | linked files in this folder |
| Worker charters | [`charters/`](./charters/) |
| Rehearsal templates | [`../aws-environments/rehearsals/`](../aws-environments/rehearsals/) |

Live inventory stays in **`docs/aws-environments/`** (`current-state.md`, `differential-and-costs.md`).
