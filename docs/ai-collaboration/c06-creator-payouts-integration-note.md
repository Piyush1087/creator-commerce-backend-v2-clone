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
