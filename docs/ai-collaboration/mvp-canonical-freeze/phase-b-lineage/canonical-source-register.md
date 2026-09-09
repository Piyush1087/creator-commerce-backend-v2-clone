# MVP_CANONICAL_SOURCE_REGISTER

**Charter:** §9  
**Date amended:** 2026-09-09 (ancestry proven with `git merge-base --is-ancestor`; Phase A leftovers named)  
**Does not pull:** C-02A, C-04, Brand Payouts v1  
**Does not change:** `origin/development` / `main`

Canonical copy. Original RUN 1 pointer: `../02-canonical-source-register.md`.

Proof method (2026-09-09, freeze working trees): `git merge-base --is-ancestor <module_sha> <head>`. Exit 0 = ancestor.

---

## Repositories

```text
BACKEND_CANONICAL_REPOSITORY  = growth-verse/creator-commerce-backend-v2
BACKEND_CANONICAL_BRANCH      = freeze/mvp-canonical-application-v1
FRONTEND_CANONICAL_REPOSITORY = growth-verse/creator-commerce-frontend-v2
FRONTEND_CANONICAL_BRANCH     = freeze/mvp-canonical-application-v1
ARCHITECTURE_AUTHORITY_REPO   = Piyush1087/dummy_tcs
ARCHITECTURE_AUTHORITY_BRANCH = freeze/mvp-canonical-application-v1
```

`development` is the immutable snapshot. It is not the freeze SHA. Clone remotes (`piyush`) are evidence only.

---

## Relevant heads (2026-09-09)

| Ref | Frontend | Backend | dummy_tcs |
| --- | --- | --- | --- |
| Prospective canonical head (local freeze `HEAD`) | `1ee13b4c3ab93248bbe8cb79ef8d560277a4802d` | `d684143b9dfad527c1b92d6a86fa4510296873d3` | `9d8282019c0bc3723bba74929808c0eadf40039c` |
| `origin/development` (snapshot; **untouched**) | `c83ab8bab02ace8872a53de81cc8ffe79ccda832` | `cd446fb4bd356fe03faf16c6c7a282a55cebcf08` | n/a (`origin/main` = `3ac9895901092e3de2e4e803501b3c0db0aa8c75`) |
| `origin/freeze/mvp-canonical-application-v1` (last pushed; RUN 1) | `71fe273e9a4d84b868dc7511d606e1109f2d566e` | `13a1dedc0ead8eef24a27c48067364258119b0fc` | `f6378bc1f26ed51a7cb797e3888cb1140bffbed9` |

**Branch divergence:** `origin/freeze` **is an ancestor** of local freeze `HEAD` on FE, BE, and dummy_tcs. Lag is unpushed freeze-docs checkpoints, not a second product lineage. Do not treat `origin/freeze` as the current freeze SHA. Later freeze SHAs: `../phase-f-execution/execution-ledger.yaml`.

---

## Lineage conclusions (summary)

| Module | Conclusion |
| --- | --- |
| PLAT-SHARED, GK-V1, BRAND-PREVIEW, BRAND-CENTRE-BI, PI-V1, BRAND-SETTINGS, CHAT-HOME, BRAND-UCE, BRAND-COLLAB, C-01, C-05, C-03, NOTIF-DE | **PRESENT_IN_CANONICAL_LINEAGE** — accepted runtime SHA is an ancestor of snapshot **and** local freeze `HEAD` |
| C-02A, C-04, Brand Payouts v1 | **REQUIRES_CONVERGENCE** later — accepted SHAs are **not** ancestors — **not this freeze** |
| C-06 | NOT_ACCEPTED |
| Marketplace / Co-Pilot / Centre | code present as debt; hidden this checkpoint — **not** `PRESENT_IN_CANONICAL_LINEAGE` as product |
| C-01 BE named SHA `3ec01751` | **DOCS_ONLY** (I7 ledger). Module still PRESENT via integrate `c47c6273` + snapshot |
| Chat Home / C-01 / C-05 ledgers and closeouts | **DOCS_ONLY** — do not use as runtime |

No IN module is `CONFLICT_REQUIRES_REVIEW`. No IN module is `SUPERSEDED_BY_NEWER_ACCEPTED_AUTHORITY` (Parent SHAs unchanged).

---

## Backend (per accepted SHA)

Prospective head: freeze `d684143b9dfad527c1b92d6a86fa4510296873d3`. Snapshot: `cd446fb4bd356fe03faf16c6c7a282a55cebcf08`.

| module_id | accepted SHA | subject (short) | ancestor of snapshot | ancestor of freeze HEAD | merge-base vs snapshot | conclusion |
| --- | --- | --- | --- | --- | --- | --- |
| PLAT-SHARED | `cd446fb4bd356fe03faf16c6c7a282a55cebcf08` | Merge PR #26 C-03 | YES | YES | self | PRESENT_IN_CANONICAL_LINEAGE |
| GK-V1 | `ae901a5537b19be6d06301fb0c12ac5e44c21018` | reconcile Gatekeeper backend with development | YES | YES | self | PRESENT_IN_CANONICAL_LINEAGE |
| BRAND-PREVIEW | `89d7dcc7e00c12b499850e2ff1c74364c4a83c19` | align brand preview migration identifiers | YES | YES | self | PRESENT_IN_CANONICAL_LINEAGE |
| BRAND-CENTRE-BI | `e066265d720b8f76516acb5063b9843faac5a85e` | prove stale idle projection | YES | YES | self | PRESENT_IN_CANONICAL_LINEAGE |
| PI-V1 | `17214722dc20abf23c8dce935a58050a017f6639` | add canonical Offering discovery | YES | YES | self | PRESENT_IN_CANONICAL_LINEAGE |
| BRAND-SETTINGS | `517531682f6286d5ee45bd48ec4e145e96d583a7` | enforce otp attempt limits | YES | YES | self | PRESENT_IN_CANONICAL_LINEAGE |
| CHAT-HOME | `00e1299ec2e97497bc6d81aeda808d6edd3b482a` | isolate Brand workspace read authorization | YES | YES | self | PRESENT_IN_CANONICAL_LINEAGE |
| BRAND-UCE | snapshot `cd446fb4…` (Parent). Named merge `29224609d18e876776841802a47fc54434b82ceb` (PR #3 `feature/uce-backend`). Later reconcile `f7eb11bc72051f034f7d46ff2ad5c6b4d4b9e0fd` | UCE on snapshot | YES (all three) | YES | self / named merges | PRESENT_IN_CANONICAL_LINEAGE |
| BRAND-COLLAB | `b7c726c8e7fba114ee7a0c2b09aac7aaae698ec5` | ACTIVE Collaboration acceptance seed | YES | YES | self | PRESENT_IN_CANONICAL_LINEAGE |
| C-01 | `3ec01751d28cfa60840ecf97d95c706f94c3dec9` | record I7 joint runtime acceptance | YES | YES | self | PRESENT (module). SHA is **DOCS_ONLY** (ledger yaml only). Runtime integrate `c47c62736db6d19881912444ddbc96c1bdeb9baa` |
| C-05 | `156d5834266077be7e2b6a2d459bae5489edbbd6` | record joint acceptance checkpoint | YES | YES | self | PRESENT_IN_CANONICAL_LINEAGE |
| C-03 | `aebeb85fd6bba37f88c3805c213c61e7f63b2f5f` | enforce eligible-only eligibility | YES | YES | self | PRESENT_IN_CANONICAL_LINEAGE |
| NOTIF-DE | snapshot `cd446fb4…` | infra on snapshot | YES | YES | self | PRESENT_IN_CANONICAL_LINEAGE |
| C-02A | `4e082f67953f0d6b55fa791f2cea03c8aef28119` | accept converged migration inventory | **NO** | **NO** | `aebeb85fd6bba37f88c3805c213c61e7f63b2f5f` (C-03) | REQUIRES_CONVERGENCE (not this freeze) |
| C-04 | `ec395bf5760b295dddd9c3f7e9c2f05485b6b743` | record migration parity check | **NO** | **NO** | `aebeb85fd6bba37f88c3805c213c61e7f63b2f5f` (C-03) | REQUIRES_CONVERGENCE (not this freeze) |
| BRAND-PAYOUTS-V1 | `a38102fd9662f1654c9572b19913b9e228385b73` | expose reserve approval read contract | **NO** | **NO** | `aebeb85fd6bba37f88c3805c213c61e7f63b2f5f` (C-03) | REQUIRES_CONVERGENCE (not this freeze) |

---

## Frontend (per accepted SHA)

Prospective head: freeze `1ee13b4c3ab93248bbe8cb79ef8d560277a4802d`. Snapshot: `c83ab8bab02ace8872a53de81cc8ffe79ccda832`.

| module_id | accepted SHA | subject (short) | ancestor of snapshot | ancestor of freeze HEAD | merge-base vs snapshot | conclusion |
| --- | --- | --- | --- | --- | --- | --- |
| PLAT-SHARED | `c83ab8bab02ace8872a53de81cc8ffe79ccda832` | Merge PR #24 C-03 | YES | YES | self | PRESENT_IN_CANONICAL_LINEAGE |
| GK-V1 | `79fceb933f0076a4b98ce9020d9a9815436a3c54` | wire recovery capabilities | YES | YES | self | PRESENT_IN_CANONICAL_LINEAGE |
| BRAND-PREVIEW | `cbef201c571c6493c0a83ca4a6be12963faa959d` | align brand preview runtime adapter | YES | YES | self | PRESENT_IN_CANONICAL_LINEAGE |
| BRAND-CENTRE-BI | `d89810cfcb70c780054357c6571e51f1f13e258c` | reconcile processor runtime | YES | YES | self | PRESENT_IN_CANONICAL_LINEAGE |
| PI-V1 | `6bc9659ec87d9b960caaf3c6314e0f4da7b2596f` | tighten Product Offering state identity | YES | YES | self | PRESENT_IN_CANONICAL_LINEAGE |
| BRAND-SETTINGS | snapshot `c83ab8ba…` (no separate FE acceptance SHA in RUN 1) | clone on snapshot | YES | YES | self | PRESENT_IN_CANONICAL_LINEAGE |
| CHAT-HOME | `1cf2e3bd93425f60fb3d40692320078aea567794` | enforce grounded recommendation refs | YES | YES | self | PRESENT_IN_CANONICAL_LINEAGE |
| BRAND-UCE | snapshot `c83ab8ba…` (Parent). Named merge `d39c5ee8d9763882359148dd77e34c72dd6a5061` (PR #3 `feature/uce-frontend`) | UCE on snapshot | YES (both) | YES | self / named merge | PRESENT_IN_CANONICAL_LINEAGE |
| BRAND-COLLAB | `591abd3ad51c7d763df9e4c71b1998e2bba52d09` | merge development into collaboration g2 | YES | YES | self | PRESENT_IN_CANONICAL_LINEAGE |
| C-01 | `b50c36fd4b99b6e0ec0718291d794d7a58353f4c` | remediate frontend runtime dependencies | YES | YES | self | PRESENT_IN_CANONICAL_LINEAGE (runtime files in this SHA) |
| C-05 | `323658d4b147b95b5629ff8d91fa90b8fe9077e4` | preserve readable team roster at tablet width | YES | YES | self | PRESENT_IN_CANONICAL_LINEAGE |
| C-03 | `82ed3c9ef849be8353565a1901b6f5fb065c37e1` | add creator brief pack download | YES | YES | self | PRESENT_IN_CANONICAL_LINEAGE |
| C-02A | `29e78397fc66676d0134c45aa0bb6af173fbe12b` | implement Creator Home foundation | **NO** | **NO** | `82ed3c9ef849be8353565a1901b6f5fb065c37e1` (C-03) | REQUIRES_CONVERGENCE (not this freeze) |
| C-04 | `106de9988ea2d4bd534205b083f63ae7ecd1878c` | reconcile shared collaboration frontend | **NO** | **NO** | `82ed3c9ef849be8353565a1901b6f5fb065c37e1` (C-03) | REQUIRES_CONVERGENCE (not this freeze) |
| BRAND-PAYOUTS-V1 | `25441dd4fd228bec4d6c9fe9f39c2297318b6167` | complete Wave C reserve approval UI | **NO** | **NO** | `323658d4b147b95b5629ff8d91fa90b8fe9077e4` (C-05) | REQUIRES_CONVERGENCE (not this freeze) |

---

## UCE leftover (named merges, not a new Parent SHA)

Phase A had no separate UCE runtime SHA (snapshot only). Lineage search found the **named integration merges** on `origin/development`. They are ancestors of the snapshot. Parent-accepted runtime remains the snapshot SHAs; do not replace them.

```text
UCE_FE_NAMED_MERGE  = d39c5ee8d9763882359148dd77e34c72dd6a5061  # Merge PR #3 feature/uce-frontend
UCE_FE_BRANCH_TIP   = c4ef93df1723f13bed0ee6c1b3272017c5fd9ed5  # origin/feature/uce-frontend (ancestor of snapshot; early)
UCE_BE_NAMED_MERGE  = 29224609d18e876776841802a47fc54434b82ceb  # Merge PR #3 feature/uce-backend
UCE_BE_BRANCH_TIP   = de88b9d5be04b6a37173afa1d3c9f7a2039166e4  # feature/uce-backend (ancestor of snapshot)
UCE_BE_RECONCILE    = f7eb11bc72051f034f7d46ff2ad5c6b4d4b9e0fd  # feat(brand-uce): reconcile canonical Campaign Page contracts
```

`feature/uce-frontend` / `feature/uce-backend` are **developer integration branches — evidence only**. Snapshot is **not** an ancestor of those branch tips (tips are behind development). Do not check them out as canonical.

---

## Docs-only commits (do not use as runtime)

| SHA | Repo | Why |
| --- | --- | --- |
| `c47c62736db6d19881912444ddbc96c1bdeb9baa` | BE | C-01/C-05 closeout + handoff last-touch; also the C-01/C-05 **integrate** commit — code is in snapshot, closeout docs are not runtime authority |
| `3ec01751d28cfa60840ecf97d95c706f94c3dec9` | BE | C-01 Parent “runtime” SHA is **ledger-only** (`c01-i7-joint-runtime-acceptance-ledger.yaml`) |
| `b75d0f77291ef2ecd41622f8ad08845c0730a9fb` | BE | Chat Home execution ledger |
| `18e8363ac40b30a9248e6b529b857d3aa20e1fc0` | FE | Chat Home P4 frontend ledger |

Runtime SHAs remain those in `../phase-a-inventory/module-acceptance-register.md`.

---

## Developer integration branches (evidence only unless separately accepted)

Do not merge these in this freeze.

**Frontend `origin`:** `feature/c01-c05-creator-integration`, `integration/c03-campaign-participation`, `integration/chat-home-v1`, `feature/uce-frontend`, `feature/payout-fe`

**Frontend `piyush` (clone):** `c01/*`, `c02a/creator-home-foundation-v1`, `c03/*`, `c04/shared-collaboration-frontend-v1`, `c05/*`, `c06/creator-payouts-provider-disabled-v1`, `brand-payouts/*`, `program/chat-home-v1`

**Backend `origin`:** `feature/c01-c05-creator-integration`, `integration/c03-campaign-participation`, `integration/chat-home-v1`, `feature/uce-backend`, `feature/payout-be`

**Backend `piyush` (clone):** `c01/*`, `c02a/creator-home-foundation-v1`, `c03/*`, `c04/shared-collaboration-backend-v1`, `c05/*`, `c06/creator-payouts-provider-disabled-v1`, `brand-payouts/*`, `program/chat-home-v1`

**dummy_tcs:** `origin/c04/stage-b-authority-package-v1` = `7790864dbd4764b9a4118856e3ca074fb374ce7e` (authority package tip; not pulled)

---

## Convergence implication

IN modules do **not** require a convergence run into freeze: they are already ancestors of snapshot, and freeze is snapshot plus freeze-docs / hide work.

Deferred modules require a later amendment (Phase E). Merge-bases show they diverged **after C-03** (BE all three; FE C-02A/C-04) or **after C-05** (FE Brand Payouts). That is collision context for a future pull, not this freeze.
