# MODULE_ACCEPTANCE_REGISTER

**Charter:** §8 complete module register  
**Date amended:** 2026-09-09 (Phase A expansion + feasible authority-file SHA extraction; keep Parent 2026-09-08 locks)  
**Baseline snapshot (not freeze SHAs):** BE `cd446fb4bd356fe03faf16c6c7a282a55cebcf08` / FE `c83ab8bab02ace8872a53de81cc8ffe79ccda832`  
**Current canonical branch/head:** `freeze/mvp-canonical-application-v1` — exact freeze SHAs in `../phase-f-execution/execution-ledger.yaml`

Do not treat a docs-only closeout as a runtime SHA. Runtime SHAs below are from the RUN 1 register unless a row says SNAPSHOT.

**Authority file SHAs** are `git log -1 --format=%H -- <path>` (last-touch **commit**, not blob SHA) on freeze working trees 2026-09-09. Dummy_tcs clone HEAD `9d8282019c0bc3723bba74929808c0eadf40039c`. Paths with no Git file stay `UNKNOWN_REQUIRES_REVIEW`. Chat Home docx under BE `docs/brand-home/product-docs/handoff-docs/` is **untracked** — no SHA. FE has no C-01/C-05 closeout files (those live on BE).

Original RUN 1 pointer: `../01-module-acceptance-register.md`.

### Extracted last-touch commits (named files only)

| Path | Last-touch commit |
| --- | --- |
| dummy_tcs `docs/organization/charters/canonical_application_freeze_ai_worker_charter.md` | `40150945b0fb9fe72bff8b1cbbab9e11cfe42056` |
| dummy_tcs `docs/organization/prompts/frontend_ai_worker_initiation.md` | `536ea1b87f6692039b9503d5cbcb0df46958813f` |
| dummy_tcs `docs/organization/handoffs/intelligence_engine_systems_architect_bootstrap.md` | `19c1571fa323969e4bdb2ef23db635512f9d69b4` |
| dummy_tcs `docs/organization/handoffs/brand_preview_developer_handoff_20260822.md` | `3fb6678c5b771fc8bdd909ea738c40b1945d8fe0` |
| dummy_tcs `docs/organization/handoffs/brand_onboarding_systems_architect_continuity_20260822.md` | `5721a974bf9078d42208f0151a29d1fd9feee5ff` |
| dummy_tcs `docs/organization/handoffs/brand_centre_intelligence_architecture_ie_review_20260824.md` | `f752378588598d9d86d1e7c27346ae08424928ea` |
| dummy_tcs `docs/organization/handoffs/c03_execution_planning_checkpoint_20260904.md` | `638f686fd8ce754e09c5dbe433986e77eed9f479` |
| dummy_tcs `docs/organization/product_decisions/c03_creator_campaign_participation_product_decision_register_v1.md` | `39a3bacd57a3155ac83cd612ae1f15eb4fcdd89c` |
| dummy_tcs `docs/ai-collaboration/c02a-parent-final-acceptance-v1.md` | `3ac9895901092e3de2e4e803501b3c0db0aa8c75` |
| dummy_tcs `docs/ai-collaboration/c02a-developer-code-integration-handoff-v1.md` | `3ac9895901092e3de2e4e803501b3c0db0aa8c75` |
| dummy_tcs `origin/c04/stage-b-authority-package-v1` (branch tip, not a product file) | `7790864dbd4764b9a4118856e3ca074fb374ce7e` |
| BE `docs/ai-collaboration/c01-developer-code-integration-handoff-v1.md` | `c47c62736db6d19881912444ddbc96c1bdeb9baa` |
| BE `docs/ai-collaboration/c01-module-closeout-v1.md` | `c47c62736db6d19881912444ddbc96c1bdeb9baa` |
| BE `docs/ai-collaboration/c05-developer-code-integration-handoff-v1.md` | `c47c62736db6d19881912444ddbc96c1bdeb9baa` |
| BE `docs/ai-collaboration/c05-module-closeout-v1.md` | `c47c62736db6d19881912444ddbc96c1bdeb9baa` |
| BE `docs/ai-collaboration/c05-execution-ledger-v1.yaml` | `c47c62736db6d19881912444ddbc96c1bdeb9baa` |
| BE `docs/ai-collaboration/chat-home-v1-execution-ledger.yaml` | `b75d0f77291ef2ecd41622f8ad08845c0730a9fb` |
| FE `docs/ai-collaboration/chat-home-v1-p4-frontend-execution-ledger.yaml` | `18e8363ac40b30a9248e6b529b857d3aa20e1fc0` |
| FE `docs/ai-collaboration/c01-i7-frontend-runtime-acceptance-ledger.yaml` | `b50c36fd4b99b6e0ec0718291d794d7a58353f4c` |

---

## Index

| module_id | Name | status |
| --- | --- | --- |
| PLAT-SHARED | Shared platform | SHARED_INFRASTRUCTURE_RETAIN |
| GK-V1 | Gatekeeper v1 | ACCEPTED |
| BRAND-PREVIEW | Brand Preview / Onboarding | ACCEPTED |
| BRAND-CENTRE-BI | Brand Centre + BI P1 | ACCEPTED |
| PI-V1 | Product Intelligence V1 | ACCEPTED |
| BRAND-SETTINGS | Brand Settings MVP | ACCEPTED |
| CHAT-HOME | Chat Home / Brand Home V1 | ACCEPTED |
| BRAND-UCE | Brand Campaign / UCE | ACCEPTED (on snapshot) |
| BRAND-COLLAB | Collaboration Brand + Phase G | ACCEPTED WITH DEBT |
| C-01 | Creator Entry | ACCEPTED |
| C-05 | Creator Settings + shell | ACCEPTED |
| C-03 | Campaign Apply | ACCEPTED |
| NOTIF-DE | Notifications / Data Extraction | INFRA retain |
| C-02A | Creator Home Foundation | DEFERRED (not pulled) |
| C-04 | Creator Collaboration | DEFERRED (not pulled) |
| BRAND-PAYOUTS-V1 | Brand Payouts v1 | DEFERRED (not pulled) |
| C-06 | Creator Payouts | OUT (not accepted) |
| MKT | Marketplace | OUT_OF_MVP |
| COPILOT | Co-Pilot / Creator Co-Pilot | OUT_OF_MVP |
| CREATOR-CENTRE | Centre / Media Kit / Analytics | OUT / deferred product |

---

## IN this freeze

### PLAT-SHARED — Shared platform

```text
module_id: PLAT-SHARED
module_name: Shared platform (auth, Prisma, health, SST, Aurora, shell)
product_authority_path: UNKNOWN_REQUIRES_REVIEW (no single dummy_tcs product register)
architecture_authority_path: dummy_tcs docs/organization/charters/canonical_application_freeze_ai_worker_charter.md
architecture_authority_SHA: 40150945b0fb9fe72bff8b1cbbab9e11cfe42056
backend_runtime_acceptance_SHA: cd446fb4bd356fe03faf16c6c7a282a55cebcf08
frontend_runtime_acceptance_SHA: c83ab8bab02ace8872a53de81cc8ffe79ccda832
closeout/docs_SHA: N/A (infra, not a module closeout)
current canonical branch/head: freeze/mvp-canonical-application-v1 (ledger)
status: SHARED_INFRASTRUCTURE_RETAIN
remaining_debt: none named as a product module
upstream: none
downstream: all IN modules
```

### GK-V1 — Gatekeeper v1

```text
module_id: GK-V1
module_name: Gatekeeper v1
product_authority_path: dummy_tcs docs/organization/prompts/frontend_ai_worker_initiation.md (§ Gatekeeper v1)
product_authority_SHA: 536ea1b87f6692039b9503d5cbcb0df46958813f
architecture_authority_path: dummy_tcs docs/organization/handoffs/intelligence_engine_systems_architect_bootstrap.md
architecture_authority_SHA: 19c1571fa323969e4bdb2ef23db635512f9d69b4
backend_runtime_acceptance_SHA: ae901a5537b19be6d06301fb0c12ac5e44c21018
frontend_runtime_acceptance_SHA: 79fceb933f0076a4b98ce9020d9a9815436a3c54
closeout/docs_SHA: UNKNOWN_REQUIRES_REVIEW (distinct closeout not named)
current canonical branch/head: freeze/mvp-canonical-application-v1 (ancestor of snapshot)
status: ACCEPTED / PRESENT_IN_CANONICAL_LINEAGE
remaining_debt: farm Gatekeeper tests ENVIRONMENT_BLOCKED (isolated PASS)
upstream: PLAT-SHARED
downstream: BRAND-PREVIEW, BRAND-CENTRE-BI
```

### BRAND-PREVIEW — Brand Preview / Onboarding

```text
module_id: BRAND-PREVIEW
module_name: Brand Preview / Onboarding
product_authority_path: dummy_tcs docs/organization/handoffs/brand_preview_developer_handoff_20260822.md
product_authority_SHA: 3fb6678c5b771fc8bdd909ea738c40b1945d8fe0
architecture_authority_path: dummy_tcs docs/organization/handoffs/brand_onboarding_systems_architect_continuity_20260822.md
architecture_authority_SHA: 5721a974bf9078d42208f0151a29d1fd9feee5ff
backend_runtime_acceptance_SHA: 89d7dcc7e00c12b499850e2ff1c74364c4a83c19
frontend_runtime_acceptance_SHA: cbef201c571c6493c0a83ca4a6be12963faa959d
closeout/docs_SHA: UNKNOWN_REQUIRES_REVIEW (distinct closeout not named)
current canonical branch/head: freeze/mvp-canonical-application-v1
status: ACCEPTED
remaining_debt: live Gemini/Zyte configuration is AWS/provider (not this freeze)
upstream: GK-V1, PLAT-SHARED
downstream: BRAND-CENTRE-BI, PI-V1
```

### BRAND-CENTRE-BI — Brand Centre + BI P1

```text
module_id: BRAND-CENTRE-BI
module_name: Brand Centre + Brand Intelligence P1
product_authority_path: UNKNOWN_REQUIRES_REVIEW (no dummy_tcs product register named)
architecture_authority_path: dummy_tcs docs/organization/handoffs/brand_centre_intelligence_architecture_ie_review_20260824.md
architecture_authority_SHA: f752378588598d9d86d1e7c27346ae08424928ea
backend_runtime_acceptance_SHA: e066265d720b8f76516acb5063b9843faac5a85e
frontend_runtime_acceptance_SHA: d89810cfcb70c780054357c6571e51f1f13e258c
closeout/docs_SHA: UNKNOWN_REQUIRES_REVIEW (distinct closeout not named)
current canonical branch/head: freeze/mvp-canonical-application-v1
status: ACCEPTED
remaining_debt: none for authAuthorizationHeader (authenticatedFetch cutover RUN 12)
upstream: BRAND-PREVIEW, NOTIF-DE
downstream: PI-V1, CHAT-HOME
```

### PI-V1 — Product Intelligence V1

```text
module_id: PI-V1
module_name: Product Intelligence V1
product_authority_path: UNKNOWN_REQUIRES_REVIEW (no dummy_tcs product register named)
architecture_authority_path: dummy_tcs docs/organization/handoffs/intelligence_engine_systems_architect_bootstrap.md
architecture_authority_SHA: 19c1571fa323969e4bdb2ef23db635512f9d69b4
backend_runtime_acceptance_SHA: 17214722dc20abf23c8dce935a58050a017f6639
frontend_runtime_acceptance_SHA: 6bc9659ec87d9b960caaf3c6314e0f4da7b2596f
closeout/docs_SHA: UNKNOWN_REQUIRES_REVIEW (distinct closeout not named)
current canonical branch/head: freeze/mvp-canonical-application-v1
status: ACCEPTED
remaining_debt: none named beyond shared DE/provider
upstream: BRAND-CENTRE-BI, NOTIF-DE
downstream: BRAND-UCE, CHAT-HOME
```

### BRAND-SETTINGS — Brand Settings MVP

```text
module_id: BRAND-SETTINGS
module_name: Brand Settings MVP
product_authority_path: UNKNOWN_REQUIRES_REVIEW
architecture_authority_path: UNKNOWN_REQUIRES_REVIEW
backend_runtime_acceptance_SHA: 517531682f6286d5ee45bd48ec4e145e96d583a7
frontend_runtime_acceptance_SHA: c83ab8bab02ace8872a53de81cc8ffe79ccda832
closeout/docs_SHA: UNKNOWN_REQUIRES_REVIEW
current canonical branch/head: freeze/mvp-canonical-application-v1
status: ACCEPTED (clone integrated; FE runtime = snapshot SHA, no separate FE acceptance SHA in RUN 1)
remaining_debt: unused withdrawal types deleted on FE; BE withdrawal-account API still in tree (OUT/old payout surface)
upstream: PLAT-SHARED
downstream: BRAND-UCE (billing/escrow), C-05 team patterns
```

### CHAT-HOME — Chat Home / Brand Home V1

```text
module_id: CHAT-HOME
module_name: Chat Home / Brand Home V1
product_authority_path: UNKNOWN_REQUIRES_REVIEW (BE docs/brand-home handoff docx is untracked; no Git SHA)
architecture_authority_path: creator-commerce-backend-v2 docs/ai-collaboration/chat-home-v1-execution-ledger.yaml
architecture_authority_SHA: b75d0f77291ef2ecd41622f8ad08845c0730a9fb
backend_runtime_acceptance_SHA: 00e1299ec2e97497bc6d81aeda808d6edd3b482a
frontend_runtime_acceptance_SHA: 1cf2e3bd93425f60fb3d40692320078aea567794
closeout/docs_path: creator-commerce-frontend-v2 docs/ai-collaboration/chat-home-v1-p4-frontend-execution-ledger.yaml
closeout/docs_SHA: 18e8363ac40b30a9248e6b529b857d3aa20e1fc0
current canonical branch/head: freeze/mvp-canonical-application-v1
status: ACCEPTED
remaining_debt: Chat architecture test retargeted RUN 9 (no P6 git-diff)
upstream: BRAND-CENTRE-BI, PI-V1, BRAND-UCE
downstream: Brand authenticated Home
```

### BRAND-UCE — Brand Campaign / UCE

```text
module_id: BRAND-UCE
module_name: Brand Campaign / UCE
product_authority_path: UNKNOWN_REQUIRES_REVIEW
architecture_authority_path: UNKNOWN_REQUIRES_REVIEW
backend_runtime_acceptance_SHA: cd446fb4bd356fe03faf16c6c7a282a55cebcf08
frontend_runtime_acceptance_SHA: c83ab8bab02ace8872a53de81cc8ffe79ccda832
lineage_named_merge: FE d39c5ee8d9763882359148dd77e34c72dd6a5061 / BE 29224609d18e876776841802a47fc54434b82ceb (ancestors of snapshot; do not replace Parent runtime SHAs)
closeout/docs_SHA: UNKNOWN_REQUIRES_REVIEW
current canonical branch/head: freeze/mvp-canonical-application-v1
status: ACCEPTED on snapshot (no separate named runtime SHA in RUN 1)
remaining_debt: UCE table→cards closed RUN 8; canonical-draft client authenticatedFetch RUN 12; UceCampaignCollaboration leftover vs Collaboration (INV-13 Parent later amendment)
upstream: BRAND-SETTINGS, PI-V1, C-03
downstream: BRAND-COLLAB, C-03, CHAT-HOME
```

### BRAND-COLLAB — Collaboration Brand + Phase G

```text
module_id: BRAND-COLLAB
module_name: Collaboration Brand + Phase G
product_authority_path: UNKNOWN_REQUIRES_REVIEW
architecture_authority_path: UNKNOWN_REQUIRES_REVIEW
backend_runtime_acceptance_SHA: b7c726c8e7fba114ee7a0c2b09aac7aaae698ec5
frontend_runtime_acceptance_SHA: 591abd3ad51c7d763df9e4c71b1998e2bba52d09
closeout/docs_SHA: UNKNOWN_REQUIRES_REVIEW
current canonical branch/head: freeze/mvp-canonical-application-v1
status: ACCEPTED WITH DEBT
remaining_debt: INV-13 duplicate persistence; INV-09 fulfillment does not consume CreatorShippingAddress; C-04 not pulled
upstream: BRAND-UCE, C-03, PLAT-SHARED
downstream: Creator collab UI still mounted (C-04 deferred)
```

### C-01 — Creator Entry

```text
module_id: C-01
module_name: Creator Entry
product_authority_path: UNKNOWN_REQUIRES_REVIEW on dummy_tcs
architecture_authority_path: creator-commerce-backend-v2 docs/ai-collaboration/c01-developer-code-integration-handoff-v1.md
architecture_authority_SHA: c47c62736db6d19881912444ddbc96c1bdeb9baa
closeout/docs_path: creator-commerce-backend-v2 docs/ai-collaboration/c01-module-closeout-v1.md
closeout/docs_SHA: c47c62736db6d19881912444ddbc96c1bdeb9baa (do not use as runtime)
backend_runtime_acceptance_SHA: 3ec01751d28cfa60840ecf97d95c706f94c3dec9
frontend_runtime_acceptance_SHA: b50c36fd4b99b6e0ec0718291d794d7a58353f4c
current canonical branch/head: freeze/mvp-canonical-application-v1
status: ACCEPTED
remaining_debt: INV-03 postgres harness closed 29/29 RUN 7
upstream: PLAT-SHARED
downstream: C-05, C-03
```

### C-05 — Creator Settings + shell

```text
module_id: C-05
module_name: Creator Settings + persistent shell
product_authority_path: UNKNOWN_REQUIRES_REVIEW on dummy_tcs
architecture_authority_path: creator-commerce-backend-v2 docs/ai-collaboration/c05-developer-code-integration-handoff-v1.md
architecture_authority_SHA: c47c62736db6d19881912444ddbc96c1bdeb9baa
closeout/docs_path: creator-commerce-backend-v2 docs/ai-collaboration/c05-module-closeout-v1.md
closeout/docs_SHA: c47c62736db6d19881912444ddbc96c1bdeb9baa
backend_runtime_acceptance_SHA: 156d5834266077be7e2b6a2d459bae5489edbbd6
frontend_runtime_acceptance_SHA: 323658d4b147b95b5629ff8d91fa90b8fe9077e4
current canonical branch/head: freeze/mvp-canonical-application-v1
status: ACCEPTED
remaining_debt: INV-09 consumption not in tree; Home is C-05 entry not C-02A
upstream: C-01, PLAT-SHARED
downstream: C-03 nav, Creator Settings
```

### C-03 — Campaign Apply

```text
module_id: C-03
module_name: Campaign Apply / Creator campaign participation
product_authority_path: dummy_tcs docs/organization/product_decisions/c03_creator_campaign_participation_product_decision_register_v1.md
product_authority_SHA: 39a3bacd57a3155ac83cd612ae1f15eb4fcdd89c
architecture_authority_path: dummy_tcs docs/organization/handoffs/c03_execution_planning_checkpoint_20260904.md
architecture_authority_SHA: 638f686fd8ce754e09c5dbe433986e77eed9f479
backend_runtime_acceptance_SHA: aebeb85fd6bba37f88c3805c213c61e7f63b2f5f
frontend_runtime_acceptance_SHA: 82ed3c9ef849be8353565a1901b6f5fb065c37e1
closeout/docs_SHA: UNKNOWN_REQUIRES_REVIEW (distinct closeout not named)
current canonical branch/head: freeze/mvp-canonical-application-v1
status: ACCEPTED
remaining_debt: seed-dev-collaboration leftover closed RUN 9 (legacy brief-linked fixture); marketplace folder mixed (Apply helpers kept)
upstream: C-01, BRAND-UCE, PLAT-SHARED
downstream: BRAND-COLLAB
```

### NOTIF-DE — Notifications / Data Extraction

```text
module_id: NOTIF-DE
module_name: Notifications + Data Extraction (infra)
product_authority_path: UNKNOWN_REQUIRES_REVIEW
architecture_authority_path: dummy_tcs docs/organization/handoffs/intelligence_engine_systems_architect_bootstrap.md
architecture_authority_SHA: 19c1571fa323969e4bdb2ef23db635512f9d69b4
backend_runtime_acceptance_SHA: cd446fb4bd356fe03faf16c6c7a282a55cebcf08
frontend_runtime_acceptance_SHA: c83ab8bab02ace8872a53de81cc8ffe79ccda832
closeout/docs_SHA: N/A
current canonical branch/head: freeze/mvp-canonical-application-v1
status: INFRA retain
remaining_debt: Postmark OTP live send PASS 2026-09-10; live DE providers AWS
upstream: PLAT-SHARED
downstream: C-03, BRAND-PREVIEW, BRAND-CENTRE-BI, CHAT-HOME
```

---

## DEFERRED (accepted elsewhere, not pulled)

See `../deferred/README.md`. Do not converge in this freeze.

### C-02A

```text
module_id: C-02A
module_name: Creator Home Foundation
product_authority_path: dummy_tcs docs/ai-collaboration/c02a-parent-final-acceptance-v1.md
product_authority_SHA: 3ac9895901092e3de2e4e803501b3c0db0aa8c75
architecture_authority_path: dummy_tcs docs/ai-collaboration/c02a-developer-code-integration-handoff-v1.md
architecture_authority_SHA: 3ac9895901092e3de2e4e803501b3c0db0aa8c75
backend_runtime_acceptance_SHA: 4e082f67953f0d6b55fa791f2cea03c8aef28119
frontend_runtime_acceptance_SHA: 29e78397fc66676d0134c45aa0bb6af173fbe12b
status: CANONICAL_PENDING_CONVERGENCE / DEFERRED
remaining_debt: not an ancestor of snapshot; freeze has C-05 `/creator/home` stub only; Centre Home files unmounted (not C-02A); depends on C-04
upstream: C-04 (Parent note)
downstream: Creator Home content
```

### C-04

```text
module_id: C-04
module_name: Creator Collaboration
product_authority_path: UNKNOWN_REQUIRES_REVIEW (no dummy_tcs product file named)
architecture_authority_path: dummy_tcs origin/c04/stage-b-authority-package-v1 (branch evidence, not a product file)
architecture_authority_SHA: 7790864dbd4764b9a4118856e3ca074fb374ce7e
backend_runtime_acceptance_SHA: ec395bf5760b295dddd9c3f7e9c2f05485b6b743
frontend_runtime_acceptance_SHA: 106de9988ea2d4bd534205b083f63ae7ecd1878c
status: CANONICAL_PENDING_CONVERGENCE / DEFERRED
remaining_debt: empty node:test collab suites on freeze BE; Creator collab route still mounted
upstream: C-03, BRAND-COLLAB
downstream: C-02A
```

### BRAND-PAYOUTS-V1

```text
module_id: BRAND-PAYOUTS-V1
module_name: Brand Payouts v1 (provider-disabled)
product_authority_path: UNKNOWN_REQUIRES_REVIEW
architecture_authority_path: UNKNOWN_REQUIRES_REVIEW
backend_runtime_acceptance_SHA: a38102fd9662f1654c9572b19913b9e228385b73
frontend_runtime_acceptance_SHA: 25441dd4fd228bec4d6c9fe9f39c2297318b6167
status: CANONICAL_PENDING_CONVERGENCE / DEFERRED
remaining_debt: do not treat src/features/brand-payouts as this module
upstream: BRAND-SETTINGS escrow
downstream: none in this freeze
```

---

## OUT of this freeze

See `../out-of-mvp/README.md`.

```text
C-06: NOT_ACCEPTED (in progress). Runtime SHA not claimed.
MKT: OUT_OF_MVP. C-03 apply stays; browse unavailable.
COPILOT: OUT_OF_MVP. Modules still imported (disposition hide, later drop).
CREATOR-CENTRE: deferred product with C-02A. Routes redirect Home.
Live Razorpay / Meta App Review: PROVIDER_DEFERRED (not a module SHA).
```
