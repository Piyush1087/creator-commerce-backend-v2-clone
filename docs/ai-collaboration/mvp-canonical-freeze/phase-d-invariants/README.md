# Phase D — Cross-module invariant preflight (§11)

**Status:** DEFINED + audited 2026-09-09 (authority / files / tests named; execution PARTIAL in §18)  
**Date:** 2026-09-08; audit 2026-09-09

## Files in this folder

| File | Purpose |
| --- | --- |
| `cross-module-invariant-suite.md` | Compact high-value invariants with authority + proof + tests + execution |
| `inv-13-competing-writers.md` | Competing vs retained schema proof (no Prisma drop) |
| `../14-migration-schema/retained-schema-register.md` | Living leftover-table list; re-mark every amendment |
| `frontend-proof-files.md` | FE paths per INV |
| `backend-proof-files.md` | BE paths per INV |

Definition stays here. Execution results: `../18-validation/11-invariant-results.md` (RUN 4 + RUN 5 postgres).

## Charter checklist

| Required | This pass |
| --- | --- |
| Compact boundary suite (not thousands of module tests) | YES — INV-01…13 |
| Auth/session, identity, C-01 gating, C-05 actor | YES |
| Shell / hidden Marketplace | YES (INV-05) |
| Application identity + collab handoff | YES (INV-06/07) |
| Collab → payout boundary | YES (INV-08 PARTIAL; deferred packs out) |
| Settings shipping → fulfillment | YES (INV-09 PASS classified; C-04 destination snapshot) |
| Provider fail-closed | YES (INV-10 PARTIAL) |
| BE authoritative over FE | YES (INV-11 PARTIAL) |
| Cross-tenant / cross-role | YES (INV-12 PASS) |
| No duplicate persistence | YES (INV-13 PASS classified — leftover journey writers retired; tables retained; no Prisma drop) |
| Each INV: authority + repos/files/tests | YES after 2026-09-09 audit |

## Verdict

Phase D definition is complete enough to move to Phase E. Do **not** treat PARTIAL/FAIL rows as freeze PASS. INV-09 consumption is the C-04 destination snapshot; do **not** invent a live fulfillment join.
