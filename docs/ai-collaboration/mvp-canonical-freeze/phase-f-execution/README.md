# Phase F — Execution policy and ledger (§13)

**Status:** ACTIVE — ledger current through RUN 14 (INV-09 + creator-dev security); **not** freeze PASS  
**Date:** 2026-09-08; ledger audit 2026-09-10

## Files in this folder

| File | Purpose |
| --- | --- |
| `execution-ledger.yaml` | RUN ids, dates, checkpoint SHAs, STOP / Parent locks |

AWS deploy is not started. `docs/aws-environments/` and `docs/deployment/hotfix/` are documented (RUN 10). `development`/`main` are not updated.

## Charter checklist

| Required | This pass |
| --- | --- |
| Codex/runner for search, converge, disposable migrate, broad validation | Adapted — Cursor worker + local commands; **no** Codex runner farm |
| Org Codex operating standard | Followed as freeze STOP/scope (no authority invention) |
| RUN 1 read-only preflight | **Adapted** — RUN 1 was inventory + hide chrome |
| RUN 2 canonical convergence | **Skipped as a pull** — IN already in lineage; RUN 2 is docs |
| RUN 3 whole-app acceptance | Split across RUN 3–5 (build/migrate; lint/invariants/smoke; postgres/npm ci/full test) |
| RUN 4 freeze preparation | Artifact written in RUN 4; still not PASS |
| Ledger + checkpoint SHA every material run | YES RUN 1–14; product pair BE `bae19de` / FE `628eb6d` |
| Runner does not reconcile conflicting accepted sources | YES — C-06 stays OUT; C-02A / C-04 / Payouts pulled this amendment |

## RUN 6 (2026-09-09)

Marketplace CTA retarget + `/help` mount. Targeted FE vitest **8 files / 97 passed**. Evidence SHAs: FE `511d5e35…` / BE `4d4b350c…` / dummy_tcs `86d8e49e…`.

## RUN 7 (2026-09-09)

INV-03 harness ctor aligned. Parent postgres **29/29** on `c01_i2_freeze`. Closes INV-02 I2 leftover on the same file. Not freeze PASS.

## RUN 8 (2026-09-09)

UCE table→cards + Creator viewport. Parent Vitest **9/9**; UI confirmed. Viewport gate PASS. Not freeze PASS.

## RUN 9 (2026-09-10)

Local hygiene leftovers: identity-test inbound → Home; Creator post-login no longer resumes Brand app chrome; Chat architecture test no longer git-diffs P6; `db:seed:dev-collaboration` PASS on `freeze_mvp_canonical_v1` (legacy brief-linked fixture). Not freeze PASS.

## RUN 10 (2026-09-10)

AWS environments + optional API hotfix docs; Dockerfile Chromium layer keyed to Playwright version. Evidence SHA BE `d5828f6f…`. Frontend unchanged (`a508e8ff…`). Not an SST deploy. Not freeze PASS.

## RUN 11 (2026-09-10)

Local Postmark OTP template live send **PASS** (Parent-confirmed inboxes). Prior fail was TemplateId placeholder `1`. INV-10 still PARTIAL (IG/Razorpay not run). Evidence FE `2bdf08b4…` / BE `0c683e41…`. Not freeze PASS.

## RUN 12 (2026-09-10)

Brand Centre / UCE clients switched to `authenticatedFetch`; `authAuthorizationHeader` removed. Isolated FE vitest **5 files / 24 passed** including `auth-security-static.test.ts`. Named RUN 5 FE farm files now closed; full FE `npm test` farm not re-run. Evidence FE `8c1362af…` / BE `eea4e716…`. Not freeze PASS.

## RUN 13 (2026-09-10 / 2026-09-11)

Converge C-04 / C-02A / Brand Payouts v1. INV-13 Pair 1–2 leftover journey writers retired `410`. C-04 collab Vitest **106/106**. Wave B postgres **PASS 3/3** on disposable `waveb_runtime` (Parent reconfirm). Local tips BE `23d315ad…` / FE `5e6cfe53…`. Origin BE still one commit behind. Security declaration withheld. Not freeze PASS.

## RUN 14 (2026-09-11)

INV-09 destination consumption PASS classified. `NO_KNOWN_DEPLOYABLE_SECURITY_BYPASS` DECLARED for freeze source + live creator-dev. Product pair BE `bae19de…` / FE `628eb6d…`. Not freeze PASS.

## Leftovers

- Do not start a charter-shaped RUN 2 pull to match the diagram.
- Freeze PASS still forbidden (classified test farms, C-06 OUT, INV-10 live providers later, creator-dev not running this pair).
