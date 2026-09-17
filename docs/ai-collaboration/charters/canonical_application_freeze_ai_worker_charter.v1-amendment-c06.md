# Canonical Application Freeze — C-06 overlay

**Date:** 2026-09-17  
**Version:** 1.0-amendment-c06  
**Does not rewrite RUN 1–12 or the C-04 / C-02A / Brand Payouts v1 amendment closed items.**  
**Not freeze PASS.**

This overlay is the bounded C-06 Creator Payouts pull. Re-proved only the gates that module can change. Live Instagram / Razorpay stay `PROVIDER_DEFERRED` (INV-10).

## Working refs (not freeze identity)

```text
BE  integration/c06-creator-payouts  da08129
FE  integration/c06-creator-payouts  62051a9
    + uncommitted INV-11 client list:
      src/routes/inv-11-backend-authority.architecture.test.ts
```

Port route and constraints: `docs/ai-collaboration/c06-creator-payouts-integration-note.md`.  
Campaign BP-G05: `ALREADY_SUBSUMED_BY_ACCEPTED_C04` (`docs/CAMPAIGN_BP_G05_DEVELOPER_INTEGRATION_REPORT.md`).

## Re-proved gates (2026-09-17)

Named evidence: `../mvp-canonical-freeze/18-validation/07-targeted-tests.md`, `11-invariant-results.md`, `13-postgres-invariants.md`, `06-lint.md`, `10-remaining-gates.md`.

```text
BE prisma validate + generate                         PASS
BE C-06 P1–P3 + freeze-relevant unit                  PASS 14 files / 109 tests / 6 skipped
    (5 Brand Payouts env-gated; P6 skipped until disposable PG16)
BE C-06 P6 postgres (disposable PG16 / c06_recovery)  PASS 1/1
    94/94 migrate deploy; hostname 127.0.0.1:55490
    thecreatorshop / creatorshop-postgres-v2 not touched
    container c06-recovery-r0-pg16 deleted after
BE npm run lint:eslint (prettier plugin off)          PASS classified, exit 0
BE prettier/prettier 712                              ACCEPTED (do not --fix)
FE C-06 P4–P5 + INV-08/11 shell/routes + G1C          PASS 13 files / 91 tests
FE npm run lint (eslint .)                            PASS, exit 0
INV-08 C-06 remainder                                 PASS classified (GET workspace; provider-disabled)
INV-11 C-06 client                                    IN (test ran; FE list file still uncommitted)
INV-10 live IG/Razorpay                               still PROVIDER_DEFERRED / NOT_RUN
full npm test                                         not a remaining gate (15-full-npm-test.md)
```

## Still forbidden

Do not declare `PASS — MVP_CANONICAL_APPLICATION_FREEZE_V1` from this overlay.
