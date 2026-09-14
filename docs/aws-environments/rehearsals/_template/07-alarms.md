# 07 — Alarms test

**Envelope required:** `INSTALL_MONITORING` (and `INSTALL_BUDGETS` if testing budgets)

## Installed

| Code | ARN/ID | Notes |
| --- | --- | --- |
| | | |

SNS topic → `brian@growthverse.in` confirmed?  

## Tests performed

| Test | How triggered | Email received? | Cleared? |
| --- | --- | --- | --- |
| Forced unhealthy / alarm | | | |
| OK state (no false page) | | | |
| Budget threshold (optional) | | | |

## Monitoring cost note

Record estimate from `docs/charters/aws/cost-estimates.md` (USD + INR) for alarms/dashboards left up during the window.

## Teardown of alarms

Must be listed in `10-teardown.md` when returning to PLACEHOLDER (delete or disable LIVE alarms; restore PLACEHOLDER integrity expectations).
