# AWS cost optimization

Account-scoped audit and fix logs for Creator Shop v2 infrastructure.

| Doc | Account | Status |
|-----|---------|--------|
| [creator-dev.md](./creator-dev.md) | `841162679642` · profile `creator-dev` | Audit + fixes **2026-08-30** (WSL deploy pending) |
| [creator-prod.md](./creator-prod.md) | `250037328530` · profile `creator-prod` | Audit **2026-08-30** · discuss before fixes |

**Current environments (2026-09-10):** placeholder vs test, costs, and the standing “do not light up prod” recommendation live in [`../aws-environments/`](../aws-environments/). This folder remains the 2026-08-30 cost-fix log.

**Important:** AWS profile name (`creator-dev`) is **not** the SST stage name. Always deploy with `--stage dev` or `--stage prod`.
