# C-06 Creator Payouts — freeze integration note

**Route:** file port from clone `071272891041a0cf187f549c3ed82bba5dcbbb79`  
**Frontend:** clone `7f72252fb5cd31f69da9ea59aa9ff81080ac4896`  
**Branch:** `integration/c06-creator-payouts`  
**Not merged wholesale** (C-06 lineage ≠ freeze 94-migration graph).

## Preserved constraints

- Deleted `src/features/creator-payouts/services/creator-payouts.service.ts`; not recomposed.
- Zero C-06-owned migrations. Freeze stays at 94.
- `PAYOUT_WORKSPACE_READ`: Owner and Manager; Assistant denied.
- C-05 remains payout-destination mutation authority (`CreatorPayoutLegalSettings`).
- No Instagram capability guard on C-06 GETs.
- No provider credentials, Razorpay, payout triggers, ledger, or financial hash.

## Explicitly not taken from the clone branch

- `app.module.ts` / `schema.prisma` / any `prisma/migrations/*`
- Frontend Creator Center resurrection, help-route rollback, or Brand sidebar rewrite

## Test evidence (2026-09-17)

Charter overlay: `docs/ai-collaboration/charters/canonical_application_freeze_ai_worker_charter.v1-amendment-c06.md`.  
Named freeze pack: `docs/ai-collaboration/mvp-canonical-freeze/18-validation/`.

```text
BE prisma validate + generate                         PASS
BE affected unit (C-06 P1–P3 + freeze-relevant)       PASS 14 files / 109 tests / 6 skipped
BE C-06 P6 postgres                                   PASS 1/1
    disposable postgres:16-alpine 127.0.0.1:55490/c06_recovery
    C06_PAYOUTS_DATABASE_TEST=true
    migrate deploy 94/94
    actor isolation + canonical read; PROVIDER_UNAVAILABLE; 0 transfer attempts
    thecreatorshop not touched; throwaway container deleted
BE npm run lint:eslint                                PASS classified (prettier off)
FE affected unit (C-06 P4–P5 + shell/INV-11/G1C)      PASS 13 files / 91 tests
FE npm run lint                                       PASS
```

Not freeze PASS. Live IG/Razorpay not run.
