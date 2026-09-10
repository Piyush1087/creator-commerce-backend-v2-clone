# Phase F — Execution policy and ledger (§13)

**Status:** ACTIVE — ledger current through RUN 9 local hygiene leftovers; **not** freeze PASS  
**Date:** 2026-09-08; ledger audit 2026-09-10

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
| Ledger + checkpoint SHA every material run | YES RUN 1–9; RUN 7–9 evidence SHAs recorded; ledger-record commit sits on top |
| Runner does not reconcile conflicting accepted sources | YES — C-02A / C-04 / Payouts stay deferred |

## RUN 6 (2026-09-09)

Marketplace CTA retarget + `/help` mount. Targeted FE vitest **8 files / 97 passed**. Evidence SHAs: FE `511d5e35…` / BE `4d4b350c…` / dummy_tcs `86d8e49e…`.

## RUN 7 (2026-09-09)

INV-03 harness ctor aligned. Parent postgres **29/29** on `c01_i2_freeze`. Closes INV-02 I2 leftover on the same file. Not freeze PASS.

## RUN 8 (2026-09-09)

UCE table→cards + Creator viewport. Parent Vitest **9/9**; UI confirmed. Viewport gate PASS. Not freeze PASS.

## RUN 9 (2026-09-10)

Local hygiene leftovers: identity-test inbound → Home; Creator post-login no longer resumes Brand app chrome; Chat architecture test no longer git-diffs P6; `db:seed:dev-collaboration` PASS on `freeze_mvp_canonical_v1` (legacy brief-linked fixture). Not freeze PASS.

## Leftovers

- Do not start a charter-shaped RUN 2 pull to match the diagram.
- Freeze PASS still forbidden (security sentence, classified test farms, deferred packs).
