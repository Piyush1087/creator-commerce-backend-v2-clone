# Canonical convergence plan (§12)

**Date:** 2026-09-08; audited 2026-09-09; amendment 2026-09-10  
**Intermediate freeze did not pull subsequently accepted modules.**  
**This amendment converges C-04, then C-02A, then Brand Payouts v1 if still missing.**

This is **new-canonical-stack** work on `freeze/mvp-canonical-application-v1`, not legacy-production reconciliation.

Charter preference already holds for IN modules:

```text
accepted canonical modules (ancestors of origin/development)
        ↓
shared-platform retain
        ↓
one freeze backend branch + one freeze frontend branch
```

Phase B proof: every IN runtime SHA is an ancestor of the snapshot **and** local freeze `HEAD`. No mechanical merge of IN modules is required.

---

## This freeze (execute / already executed)

### Starting SHAs

```text
ORIGIN_DEVELOPMENT_FRONTEND = c83ab8bab02ace8872a53de81cc8ffe79ccda832
ORIGIN_DEVELOPMENT_BACKEND  = cd446fb4bd356fe03faf16c6c7a282a55cebcf08
```

Local freeze `HEAD` (docs may sit uncommitted on top): FE `1ee13b4c3ab93248bbe8cb79ef8d560277a4802d` / BE `d684143b9dfad527c1b92d6a86fa4510296873d3` / dummy_tcs `9d8282019c0bc3723bba74929808c0eadf40039c`.

`origin/freeze` lags (RUN 1); it is an ancestor of local freeze `HEAD`, not a second product lineage.

### Accepted source SHAs (IN — already in lineage)

See `../phase-a-inventory/module-acceptance-register.md`. Do not re-merge them.

### Target branches

```text
freeze/mvp-canonical-application-v1
```

Prefer this bounded freeze branch. Do **not** force-move `development` or accepted module refs. Never force-push unless Product Authority authorizes recovery.

### Module ordering (this freeze)

```text
IN modules already on origin/development
        ↓
shared-platform retain
        ↓
hide OUT/DEFERRED product chrome (RUN 1 — done)
        ↓
registers: coverage / invariants / schema / security / env (RUN 2 — done)
        ↓
local validation on freeze (RUN 3–5 — PARTIAL, not PASS)
        ↓
MVP_CANONICAL_APPLICATION_FREEZE_V1 artifact written — not PASS
```

C-02A / C-04 / Brand Payouts v1 stay **off** this order.

### Migration ordering (this freeze)

```text
MIGRATION_COUNT = 87
HEAD            = 20260910122000_c03_application_handoff_notifications
```

C-02A owns **0** migrations. C-04’s accepted extra migration `20260911125000_c04_brand_payouts_reserve_entitlement_lineage` is **not** in this 87-chain (dated after freeze head). Do not add it this freeze. No Prisma drop. `thecreatorshop` is not migrated.

### Allowed this freeze

- Registers and evidence in `docs/.../mvp-canonical-freeze/`
- Hide/unwire **product chrome** for OUT surfaces (RUN 1 done)
- Prisma/schema **audit** without dropping Co-Pilot / duplicate tables
- Security/env/provider **name** registers
- Local validation on freeze branches
- INV-03 harness-only test fix if Parent asks (test ctor; not a product pull)

### Forbidden this freeze

- Pull C-02A, C-04, or Brand Payouts v1
- Treat unmounted Creator Centre Home UI or `/creator/home` stub as a C-02A pull
- Treat `src/features/brand-payouts` as Brand Payouts v1
- Merge freeze into `development` / `main`
- AWS / IAM / VPC / RDS / ECS / secret injection
- Force-push
- Destructive production migrations / Prisma drop
- Invent C-04 wiring to green INV-09

### Tests after this freeze’s blocks

| Block | Tests | Status |
| --- | --- | --- |
| Hide chrome | FE shell/route architecture tests; viewport smoke | RUN 1 + RUN 5 PARTIAL |
| Schema | `prisma validate`; 0→87 migrate on disposable DB | PASS_87 |
| Invariants | INV-01…13 as defined in Phase D | PARTIAL overall (see `../18-validation/11-invariant-results.md`) |
| Full `npm test` | Classified farms | Not greened; Parent-accepted debt named |

No new convergence block this freeze.

### Checkpoint commits

Ledger: `../phase-f-execution/execution-ledger.yaml`.

| Run | FE | BE | dummy_tcs |
| --- | --- | --- | --- |
| RUN 1 hide | `71fe273e9a4d84b868dc7511d606e1109f2d566e` | `13a1dedc0ead8eef24a27c48067364258119b0fc` | `f6378bc1f26ed51a7cb797e3888cb1140bffbed9` |
| RUN 2 docs | `da76da297ab9c32bbe128a233f5f4ff517794241` | `8ce12656ec68e4709b8fe77b8ab91412c726d122` | `52842bb4c63808371f34237d4af37869d5c6d9cf` |
| RUN 3 | `ee16a590480ca185a083944fb1bf2e246ff66dc2` | `773fbaa8f121a523eb0950740da79596e00ff873` | `70b644c2bb321fc220b7333afe1c9bc23a951604` |
| RUN 4 | `3e32b7421b37a743dcd10378e7aa9a465bc89774` | `c055ca8335f639a5b9d0d3cc03cfdf9693139647` | `3e4bc9a8068779fb7cb283ec7ed9c682ca968dbf` |
| RUN 5 | `8edc42f498125faf7a054f744206b889c838b1ef` | `c7440e7f643f8fd4c421024e5c0d196f9b5fde3f` | `2ff5d06c6c42404b9e33045bc18614b240eb8b1f` |

---

## This amendment (run now)

Finite plan reconstructed from dummy_tcs C-02A acceptance (Home consumes C-04; C-02A backend already contains C-04 as ancestor). Not copied from the historical email sequence.

Use the freeze branch. Do not force-move accepted refs. Do not merge into `development` / `main`.

### Accepted source SHAs (REQUIRES_CONVERGENCE)

```text
C-04     BE ec395bf5760b295dddd9c3f7e9c2f05485b6b743
         FE 106de9988ea2d4bd534205b083f63ae7ecd1878c
         dummy_tcs branch tip 7790864dbd4764b9a4118856e3ca074fb374ce7e
C-02A    BE 4e082f67953f0d6b55fa791f2cea03c8aef28119  (includes C-04 BE as ancestor)
         FE 29e78397fc66676d0134c45aa0bb6af173fbe12b
PAYOUTS  BE a38102fd9662f1654c9572b19913b9e228385b73
         FE 25441dd4fd228bec4d6c9fe9f39c2297318b6167
```

Merge-bases vs snapshot: BE C-02A/C-04/Payouts → C-03 `aebeb85f…`; FE C-02A/C-04 → C-03 `82ed3c9e…`; FE Payouts → C-05 `323658d4…`.

### Module ordering (reconstructed)

```text
C-04 Creator Collaboration (BE+FE)
        ↓
C-02A Creator Home (replace C-05 /creator/home stub; BE GET /api/v1/creator/home)
        ↓
Brand Payouts v1 if still not an ancestor after C-04
        (do not confuse with old src/features/brand-payouts)
```

C-02A Parent: Home aggregation consumes C-04 lifecycle. **Do not pull C-02A without C-04.** C-02A BE candidate already contains C-04; preserve that ancestry. C-02A adds **no** migration; C-04 adds `20260911125000_c04_brand_payouts_reserve_entitlement_lineage` after current freeze head `20260910…` — review chain before apply. C-06 stays OUT.

### Shared files likely to collide

| Area | Files |
| --- | --- |
| App composition | BE `src/app.module.ts`; FE `src/routes/app-routes.tsx` `sidebar-items.ts` `bottom-nav-items.ts` |
| Home slot | FE `src/pages/creator/home/creator-workspace-entry-page.tsx` vs C-02A `src/features/creator-home/*`; leftover unmounted `CreatorCentrePage` / `HomeBriefingWorkspace` |
| Collaboration | FE creator collab workspace (already mounted MIXED); BE `CollaborationModule`; C-04 pack |
| Payouts | Settings escrow/billing vs Brand Payouts v1 vs old `brand-payouts` hub |
| Prisma | `schema.prisma` + new C-04 migration vs 87-head; INV-13 duplicate tables stay until Parent drop amendment |
| Notifications | C-02A `creator-home-notification-read.service.ts` |

### Tests after each block

1. C-04: `prisma validate` / generate first. Collab architecture + postgres. Formerly empty freeze `node:test` collab suites are now Vitest **14/14 files, 106/106 PASS** and are the unit authority for that surface.
2. C-02A: Home contract tests; single `GET /api/v1/creator/home`; do not mutate C-04 unread on read.
3. Payouts: provider-disabled contract; Settings billing/escrow still canonical until Parent says otherwise.
4. After each: no Prisma drop; Parent runs freeze-DB migrate when schema is valid.

### STOP during this amendment

Same as charter §19, plus: pulling C-02A without C-04; treating Centre files as Home; concatenating Prisma `Collaboration` models; applying C-04 migration to `thecreatorshop`.

---

## STOP conditions (this freeze)

Charter §19 — stop immediately on:

```text
PRODUCT_DECISION_REQUIRED
CROSS_MODULE_AUTHORITY_CONFLICT
ACCEPTED_MODULE_MISSING
CANONICAL_SOURCE_AMBIGUOUS
BRANCH_DIVERGENCE
UNAUTHORIZED_SCHEMA_CHANGE
DESTRUCTIVE_MIGRATION_REQUIRED
MIGRATION_CHAIN_CONFLICT
SECURITY_BOUNDARY_CHANGE
DEPLOYABLE_AUTH_BYPASS
CROSS_TENANT_OR_ROLE_ISOLATION_FAILURE
SECRET_EXPOSURE
PROVIDER_CAPABILITY_CONFLICT
PRODUCTION_DATA_AMBIGUITY
AWS_CHANGE_REQUIRED
```

Parent 2026-09-08 locks already resolved deferred/out. Do not reopen them on this freeze. INV-13 is Parent-accepted debt — **no drop**. `AWS_CHANGE_REQUIRED` and production data remain residual gates (not this worker).

After a breaker: bounded evidence → owning authority → bounded correction → rerun affected gate. Do not preserve legacy behavior to route around a breaker.

## Rollback / reset points

Reset means `git switch` / new branch from a named SHA. No force-push. No `thecreatorshop` migrate.

| Point | FE | BE | dummy_tcs |
| --- | --- | --- | --- |
| origin/development snapshot | `c83ab8ba…` | `cd446fb4…` | n/a (`origin/main` `3ac98959…`) |
| RUN 1 | `71fe273e…` | `13a1dedc…` | `f6378bc1…` |
| RUN 5 evidence | `8edc42f4…` | `c7440e7f…` | `2ff5d06c…` |

Full SHAs in the checkpoint table above and the execution ledger.

## Phase E verdict

This freeze’s convergence is **already the no-pull plan**: IN modules in lineage; chrome hidden; deferred packs named for a later amendment. Plan is complete enough to move to Phase F. Not freeze PASS.
