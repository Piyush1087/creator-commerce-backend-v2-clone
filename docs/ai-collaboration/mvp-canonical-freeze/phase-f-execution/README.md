# Phase F — Execution policy and ledger (§13)

**Status:** ACTIVE — ledger current through RUN 6 working tree; **not** freeze PASS  
**Date:** 2026-09-08; ledger audit 2026-09-09

## Files in this folder

| File | Purpose |
| --- | --- |
| `execution-ledger.yaml` | RUN ids, dates, checkpoint SHAs, STOP / Parent locks |

AWS is not started. `development`/`main` are not updated.

## Charter checklist

| Required | This pass |
| --- | --- |
| Codex/runner for search, converge, disposable migrate, broad validation | Adapted — Cursor worker + local commands; **no** Codex runner farm |
| Org Codex operating standard | Followed as freeze STOP/scope (no authority invention) |
| RUN 1 read-only preflight | **Adapted** — RUN 1 was inventory + hide chrome |
| RUN 2 canonical convergence | **Skipped as a pull** — IN already in lineage; RUN 2 is docs |
| RUN 3 whole-app acceptance | Split across RUN 3–5 (build/migrate; lint/invariants/smoke; postgres/npm ci/full test) |
| RUN 4 freeze preparation | Artifact written in RUN 4; still not PASS |
| Ledger + checkpoint SHA every material run | YES RUN 1–5. RUN 6 is **UNCOMMITTED_WORKING_TREE** until commit |
| Runner does not reconcile conflicting accepted sources | YES — C-02A / C-04 / Payouts stay deferred |

## RUN 6 (2026-09-09)

Marketplace CTA retarget + `/help` mount. Targeted FE vitest **8 files / 97 passed**. No full farm, no browser E2E. Checkpoint SHAs pending commit.

## Leftovers

- `origin/freeze` lags at RUN 1.
- RUN 6 has no git SHA until commit/push.
- Do not start a charter-shaped RUN 2 pull to match the diagram.
