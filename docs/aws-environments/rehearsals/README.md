# AWS rehearsals — recording

**Purpose:** Durable proof that workers + deploy/teardown work. No ad-hoc Slack-only results.

## Folder layout

```text
docs/aws-environments/rehearsals/YYYY-MM-DD-<name>/
  HUMAN-REPORT.md              # short, non-eng
  00-authorization.md
  01-baseline-auditor.md
  02-bring-up.md
  03-automated-smoke.md        # non-auth; no login required
  04-monitor.md
  05-cost.md                   # USD + INR
  06-capacity.md
  07-alarms.md                 # INSTALL_MONITORING test + email proof
  08-boundary-negatives.md     # refused writes
  09-weekly-style-pack.md      # same shape as weekly even if window < 7d
  10-teardown.md
  11-after-auditor.md
  raw/                         # optional CLI JSON
```

Copy from [`_template/`](./_template/).

## Rules for TEMP_PROD_OPS rehearsals

- Product names `TEMP_PROD_OPS_REHEARSAL` + `RETURN_TO_PLACEHOLDER` at end.  
- **No pretty URL / Wix CNAME** required — use SST ALB DNS / health on the load balancer hostname.  
- **No login / OTP dependency** — Postmark may be paused. Automate **non-auth** checks (health, gatekeeper admission, other public POST/GET as listed in smoke file).  
- Workers run **once per step**, not continuously.  
- Everything via **SST / CLI / workers** — no console click-ops in the happy path.  
- Finish with [`return-to-placeholder.md`](../../charters/aws/return-to-placeholder.md).
