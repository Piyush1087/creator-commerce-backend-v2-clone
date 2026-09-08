# MVP Canonical Application Freeze V1 — Backend package

**Repo:** `growth-verse/creator-commerce-backend-v2`  
**Branch:** `freeze/mvp-canonical-application-v1`  
**Program authority:** `Piyush1087/dummy_tcs` `docs/organization/mvp-canonical-freeze/`  
**Status:** ACTIVE — not freeze PASS

Each charter step has its own folder. Do not add loose freeze notes at repo root. Do not commit `tmp-*`, `tmp-ssm-params.json`, or handoff-audit logs.

## Folder map

| Folder | Charter | This repo’s job |
| --- | --- | --- |
| `00-operating-note.md` | activation | Parent locks + snapshot |
| `phase-a-inventory/` | §8 | Module + legacy registers |
| `phase-b-lineage/` | §9 | Source register |
| `phase-c-coverage/` | §10 | Backend module/API classification |
| `phase-d-invariants/` | §11 | Backend proof files |
| `phase-e-convergence/` | §12 | No deferred pull |
| `phase-f-execution/` | §13 | Ledger |
| `14-migration-schema/` | §14 | Canonical Prisma register (source of truth) |
| `15-security/` | §15 | Backend security scan |
| `16-external-providers/` | §16 | Provider names |
| `17-environment/` | §17 | Backend env names |
| `18-validation/` | §18 | BE gate evidence |
| `deferred/` | Parent | C-02A / C-04 / Brand Payouts v1 |
| `out-of-mvp/` | Parent | Co-Pilot, C-06, Marketplace APIs |

## Snapshot (not freeze SHA)

```text
ORIGIN_DEVELOPMENT_BACKEND = cd446fb4bd356fe03faf16c6c7a282a55cebcf08
RUN1_FREEZE_BACKEND        = 13a1dedc0ead8eef24a27c48067364258119b0fc
```
