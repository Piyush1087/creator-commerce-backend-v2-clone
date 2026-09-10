# MVP Canonical Application Freeze V1 — Operating Note

**Status:** ACTIVE  
**Branch:** `freeze/mvp-canonical-application-v1`  
**Does not update:** `development` or `main`  
**Package index:** [README.md](./README.md)

This branch is the Canonical Application Freeze workspace. `origin/development` remains the untouched snapshot after C-03 merge.

Each charter step has its **own folder** under this directory. Do not commit `tmp-*`, `tmp-ssm-params.json`, or handoff-audit logs.

## Locked Parent decisions (2026-09-08)

```text
C-02A Creator Home Foundation     PULLED this amendment (accepted)
C-04 Creator Collaboration        PULLED this amendment (accepted)
Brand Payouts v1                  PULLED this amendment (provider-disabled)
C-06 Creator Payouts              OUT of this freeze (still in progress)
Marketplace                       OUT_OF_MVP
Co-Pilot / Creator Co-Pilot       OUT_OF_MVP (collab HITL mutations retired)
Creator Centre / Media Kit        OUT / deferred product (routes redirect Home)
Live Razorpay / Meta App Review   PROVIDER_DEFERRED
```

Parent 2026-09-08 correctly left C-02A / C-04 / Payouts unpulled on the intermediate freeze. Architecture review 2026-09-10 requires this amendment to converge them. C-06 stays OUT.

Backend Co-Pilot / Centre / C-06 modules remain imported (`src/app.module.ts`). Competing OUT mutations are fail-closed `410`; chrome hide alone is not proof. Schema drop is not this checkpoint.

## Snapshot SHAs (do not treat as freeze SHAs)

```text
ORIGIN_DEVELOPMENT_FRONTEND = c83ab8bab02ace8872a53de81cc8ffe79ccda832
ORIGIN_DEVELOPMENT_BACKEND  = cd446fb4bd356fe03faf16c6c7a282a55cebcf08
```

Freeze SHAs: `phase-f-execution/execution-ledger.yaml`.

## Charter

`dummy_tcs` `docs/organization/charters/canonical_application_freeze_ai_worker_charter.md`
