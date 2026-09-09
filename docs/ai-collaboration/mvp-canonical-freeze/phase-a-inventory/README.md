# Phase A — Program inventory and authority discovery (§8)

**Status:** PARTIAL — register expanded; named authority-file last-touch SHAs recorded 2026-09-09; product **paths** still UNKNOWN where no dummy_tcs file exists  
**Does not change:** runtime product code (registers only; hide work is RUN 1)

## Files in this folder

| File | Charter name |
| --- | --- |
| `module-acceptance-register.md` | `MODULE_ACCEPTANCE_REGISTER` |
| `legacy-disposition.md` | `LEGACY_DISPOSITION_REGISTER` |

## Charter inspection checklist

| Inspect | This pass |
| --- | --- |
| dummy_tcs Product / architecture / contracts / charters | PARTIAL — named files hashed; product path still UNKNOWN for Centre/PI/Settings/Chat Home/UCE/Collab/C-01/C-05/C-04/Payouts |
| Canonical BE / FE repositories | YES — freeze branches + snapshot SHAs |
| Module closeouts and developer handoffs | PARTIAL — C-01/C-05 closeout last-touch SHA `c47c6273`; distinct closeouts still UNKNOWN for Preview/Centre/PI/UCE/Collab/GK |
| Execution ledgers | YES — Chat Home BE `b75d0f77` / FE `18e8363a`; C-05 ledger same commit as closeout |
| Stitch / UI references | NOT_RUN (charter: only where still relevant) |
| Migration histories | Deferred to `../14-migration-schema/` (87 / head named there) |
| Shared auth/session/security | YES — PLAT-SHARED + coverage map |
| Provider / environment names | Deferred to `../16-external-providers/` and `../17-environment/` |
| Current heads and branch ancestry | YES — snapshot vs freeze branch; lineage conclusions in Phase B |

## What was done

- Inventoried accepted, deferred, and out-of-MVP modules with runtime SHAs (not docs-only closeouts).
- 2026-09-09: expanded each IN/DEFERRED row to charter fields; replaced bare `snapshot` with exact snapshot SHAs.
- 2026-09-09: recorded `git log -1` last-touch commits for every named authority file (not invented product paths).
- Classified leftover surfaces without deleting docs. Parent locks unchanged.

## Still open in Phase A

- Product **path** for Brand Centre, PI, Settings, Chat Home, UCE, Brand Collab, C-01, C-05, C-04, Brand Payouts v1 (no dummy_tcs product file; do not invent).
- Distinct closeout SHA where no closeout file was named (GK, Preview, Centre, PI, Settings, UCE, Collab, C-03).
- Chat Home product docx remains untracked (no SHA).
- Separate UCE **Parent** runtime SHA still the snapshot; Phase B named the integration merges (FE `d39c5ee8`, BE `29224609`) as lineage evidence only.
- Stitch / UI references NOT_RUN.

## Next

Phase B lineage is expanded (`../phase-b-lineage/`). Remaining Phase A leftovers stay named. Phase C coverage already exists from RUN 2; reopen only if Parent asks.
