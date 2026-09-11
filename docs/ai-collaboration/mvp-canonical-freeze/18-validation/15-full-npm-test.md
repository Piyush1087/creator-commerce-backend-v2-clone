# 15 — Full `npm test` farms (RUN 5)

**Date:** 2026-09-09  
Working trees on `freeze/mvp-canonical-application-v1`. Postgres-gated files skipped unless flags set (correct).

## Frontend — RUN 5 FAIL (3 tests); named files closed (full farm not re-run)

```text
npm test
Test Files  3 failed | 129 passed (132)
Tests       3 failed | 1057 passed (1060)
Duration    ~797s
exit 1
```

| File | Failure | Classification |
| --- | --- | --- |
| `src/features/auth/auth-security-static.test.ts` | RUN 5: `authAuthorizationHeader` in Brand Centre / UCE clients | **Closed RUN 12.** Clients use `authenticatedFetch`; helper removed. Isolated vitest **4/4 PASS** plus related clients **24/24** 2026-09-10. Test not weakened. Full `npm test` farm not re-run. |
| `src/features/chat/chat-architecture.test.ts` | git diff vs Chat P6 SHA includes `sidebar-items.ts` | **Closed RUN 9.** Test no longer git-diffs P6; asserts Brand Home still owns Chat, no Chat sidebar label, no `/brand/chat`. Full `npm test` farm not re-run. |
| `src/pages/brand/settings/brand-settings-billing-page.test.ts` | `WithdrawalAccount` still in `brand-settings.contracts.ts` | **Amended 2026-09-09:** unused FE types `BrandWithdrawalAccountResponse` / `LinkBrandWithdrawalAccountPayload` deleted. UI/client already had no withdrawal surface. Backend `…/withdrawal-account` remains with other OUT/old-payout APIs. Brand Payouts v1 is pulled this amendment (provider-disabled). |

Not a freeze-hide functional regression. Not greenwashed as pass.

## Backend — FAIL (classified farm)

```text
npm test
Test Files  24 failed | 215 passed | 59 skipped (298)
Tests       18 failed | 6370 passed | 782 skipped (7170)
Duration    ~4363s
exit 1
```

Clusters (not freeze-hide):

- **14 collaboration `*.test.ts` files:** **Closed this amendment.** Converted from `node:test` to Vitest and retargeted harnesses to current C-04 / Payouts constructors (outbox, advisory lock, payouts lineage, retired Manual rail). Isolated vitest **14 files / 106 tests PASS**. Do not treat the prior farm `No test suite found` as current product red. Full `npm test` farm not re-run.
- **C-03 CORS** (`src/c03-idempotency-cors.test.ts`): farm `ECONNRESET`. Parent isolated 2026-09-09 **5/5 PASS** (~13s). Farm = `ENVIRONMENT_BLOCKED`.
- **Brief Pack** (`creator-brief-pack.test.ts`): farm 5s timeout. Parent isolated 2026-09-09 **1/1 PASS** (~12s). Farm = `ENVIRONMENT_BLOCKED`.
- **Brand Preview artifacts:** farm 5s timeout. Isolated earlier **4/4 PASS**. Farm = `ENVIRONMENT_BLOCKED`.
- **Gatekeeper orchestrator** (`gatekeeper-runtime-orchestrator.test.ts`): farm 5s timeouts + one LOW-spy assert. Parent isolated 2026-09-09 **7/7 PASS** (~3s). Farm = `ENVIRONMENT_BLOCKED`. Product contract holds.
- **Financial producer / route-payout architecture greps:** C-04 / Brand Payouts v1 are now in lineage. Targeted Payouts unit + Wave B postgres **PASS 3/3**. Full farm not re-run.
- **Postgres files in this farm:** skipped (no opt-in flags) — expected. Wave B postgres is opt-in (`BRAND_PAYOUTS_WAVE_B_DATABASE_TEST`) on disposable `waveb_runtime` only.

Do not treat full `npm test` as freeze PASS.
