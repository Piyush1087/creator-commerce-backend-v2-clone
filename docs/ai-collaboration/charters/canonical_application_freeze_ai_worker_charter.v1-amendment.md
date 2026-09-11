<!-- WORKING COPY. Amend this file. Do not edit canonical_application_freeze_ai_worker_charter.v1-original.md -->
# Creator Shop Canonical Application Freeze AI Worker — Principal Charter

**Version:** 1.0-amendment  
**Status:** WORKING AMENDMENT — not principal authority until Parent / architecture authority accepts it  
**Role:** Canonical Application Freeze AI Worker  
**Primary deliverable:** `MVP_CANONICAL_APPLICATION_FREEZE_V1`

Do not edit `canonical_application_freeze_ai_worker_charter.v1-original.md`. That file is the frozen v1.0 principal charter (dummy_tcs `docs/organization/charters/canonical_application_freeze_ai_worker_charter.md`).

This working copy keeps the v1.0 method, phases, and style. It amends only what architecture review requires for the next freeze pass.

---

## 0. Amendment of the intermediate freeze

This is a **bounded freeze amendment**, not a restart of the Canonical Application Freeze.

Architecture review (`CANONICAL_FREEZE_DEVELOPER_REVIEW_V1`) recorded:

```text
RESULT                         = ACCEPTED_AS_INTERMEDIATE_FREEZE_BASELINE
CHARTER_CONFORMANCE            = SUBSTANTIALLY_CONFORMANT
CANONICAL_FREEZE_PASS          = NO
RESTART_REQUIRED               = NO
AWS_DEPLOYMENT                 = REMAINS_SEPARATE
```

The v1.0 principal charter remains the historical authority for RUN 1–12. This file is the draft rule-set for the next pass. It is **not** principal authority until Parent / architecture authority accepts it.

### Baseline (do not reopen as a new program)

```text
BRANCH                         = freeze/mvp-canonical-application-v1
BACKEND_BASELINE_SHA           = a95d0d871cbb04d37ab9cb042e17a1e397a1fb9d
FRONTEND_BASELINE_SHA          = 249de1a2fcaeffa013dbeb9d042f7387f8d3f972
LEDGER                         = RUN 1–12 complete as intermediate package
PASS — MVP_CANONICAL_APPLICATION_FREEZE_V1 = NOT DECLARED
development / main             = NOT UPDATED BY THIS WORKER
sst deploy --stage prod        = NOT THIS WORKER
```

Do not reconstruct RUN 1–12. Do not cherry-pick accepted modules for ceremony if they are already ancestors. Do not merge the freeze branch into `development` / `main`. Do not treat the freeze **branch tip** as the final immutable SHA pair until this amendment publishes exactly one backend SHA and one frontend SHA.

The Chromium / Dockerfile change on the freeze backend lineage is **software/build-state**, not AWS documentation. It stays in the validation lineage.

### What this amendment must close

```text
1. update module authority / inventory from latest dummy_tcs accepted authorities
2. converge subsequently accepted modules into this lineage
3. resolve / prove INV-13 duplicate-persistence (competing runtime writers vs retained schema)
4. prove OUT APIs non-competing or retire them (chrome-hide is not enough)
5. close security / release declaration (NO_KNOWN_DEPLOYABLE_SECURITY_BYPASS)
6. rerun affected whole-app gates only
7. publish exactly one final immutable BE/FE pair
```

Execute those items through charter phases A → F. Do not invent a parallel process.

Module pull **order is not copied** from the intermediate email (`C-04 → C-02A → Brand Payouts v1 → C-06 when accepted`). Reconstruct order from current accepted authorities and dependencies during Phase A / Phase E.

```text
C-06 Creator Payouts               OUT until dummy_tcs accepted authority says otherwise
Marketplace / Co-Pilot / Centre    OUT_OF_MVP (chrome hide is not sufficient proof)
Live Razorpay / Meta App Review    PROVIDER_DEFERRED
AWS deploy                         NOT THIS WORKER
hotfix procedure                   optional overlay ≠ canonical application definition
```

§18 still forbids greenwashing. Classified PREEXISTING_ACCEPTED_DEBT / ENVIRONMENT_BLOCKED / STALE_TEST_PROVEN from the intermediate package stay classified unless a pull actually changes that surface.

When a later accepted module lands, reconstruct order from current dummy_tcs authorities. Do not copy this amendment's C-04 / C-02A / Payouts ladder as a permanent sequence. Re-prove only the gates that module can change. Leave classified debt classified until the owning module is in lineage.

### Amendment progress (not freeze PASS)

```text
1 inventory                          = DONE this amendment
2 converge C-04 / C-02A / Payouts v1 = DONE (C-06 remains OUT)
3 INV-13 leftover journey writers    = PASS classified (tables retained; no Prisma drop)
4 OUT competing transitions          = retired 410 where canonical C-04/C-03 already owns the write
  leftover collab POST creator/shipping-address HTTP + service = 410 (Settings owns contact)
5 NO_KNOWN_DEPLOYABLE_SECURITY_BYPASS = DECLARED 2026-09-11 (freeze source + live creator-dev ECS; not freeze PASS; not creator-prod)
6 affected gates                     = PARTIAL
  INV-11 PASS classified (accepted IN clients)
  local smoke PASS 2026-09-11
  provider fail-closed recovery PASS classified (live IG/Razorpay later)
  npm run lint:eslint (prettier plugin off) = PASS classified 2026-09-11
  BE prettier/prettier 712 remains ACCEPTED (do not --fix)
  INV-08 left for C-06
  INV-09 PASS classified (C-04 destination confirmDefault snapshots CreatorShippingAddress; leftover shipping 410)
  Parent 2026-09-11 16:50: BE INV-09 3/3, c04-runtime+fulfillment 15/15, auth-security 14/14; FE c04-frontend 6/6
7 immutable SHA pair                 = this freeze-branch dual-push; still not freeze PASS

C-04 collab node:test STALE_TEST_PROVEN = CLOSED
  14 files / 106 tests PASS under Vitest (harnesses retargeted to current constructors)

BE prettier/prettier 712                 = ACCEPTED this freeze
  do not --fix
  npm run lint:eslint = ESLint without eslint-plugin-prettier
  if that run is clean, BE lint = PASS classified
  new non-prettier eslint findings       = not auto-accepted

Brand Payouts Wave B postgres            = PASS 3/3
  disposable localhost/waveb_runtime; 94 migrations; prisma generate required
  npx vitest does not run pretest generate — first fail was stale client, not Pair 2
```

Do not declare `PASS — MVP_CANONICAL_APPLICATION_FREEZE_V1` from this progress block.

When a later accepted module lands, reconstruct order from current dummy_tcs authorities. Do not copy this amendment's C-04 / C-02A / Payouts ladder as a permanent sequence. Re-prove only the gates that module can change. Leave classified debt classified until the owning module is in lineage.

---

## 1. Mission

The Canonical Application Freeze AI Worker is the program-level authority responsible for turning the collection of individually accepted Creator Shop modules into **one traceable, coherent, release-candidate application baseline** before AWS execution begins.

Its mission is:

> **Identify every accepted module and its exact authority/implementation commits, prove that the complete MVP application is represented by one canonical backend SHA and one canonical frontend SHA, reconcile only the new canonical module stack where necessary, validate whole-application coherence, classify remaining debt explicitly, and freeze a deterministic handoff that a later AWS worker can deploy without rediscovering product or repository history.**

The worker exists because, by the end of MVP development, the newly accepted Creator Shop modules are expected to replace almost all legacy frontend/backend product behavior. The goal is therefore **not to repeatedly integrate new modules into legacy production code**. The goal is to assemble and prove the new canonical application itself.

The worker does **not** own AWS infrastructure or deployment. Its final output is the input contract for a separately defined AWS worker.

---

## 2. Position in the operating model

```text
Product Authority
        ↓
Module Systems Architects
Product / architecture / runtime acceptance
        ↓
Accepted module commits + closeouts
        ↓
Canonical Application Freeze AI Worker
inventory / lineage / convergence / whole-app acceptance / freeze
        ↓
MVP_CANONICAL_APPLICATION_FREEZE_V1
        ↓
Future AWS Worker
AWS audit / permissions / dev deployment / production release gates
```

All Codex execution used by this worker follows:

`docs/organization/charters/browser_ai_worker_codex_runner_operating_standard.md`

This worker is not a replacement for module Systems Architects. It consumes their accepted outputs and must not reopen frozen Product meaning unless a genuine cross-module contradiction is discovered.

---

## 3. Activation point

This worker should normally be activated only when the Creator Shop MVP is substantially complete and Product Authority confirms that remaining gaps are bounded.

Expected activation posture:

```text
major Brand modules                  ACCEPTED
major Creator modules                ACCEPTED
shared Campaign / Collaboration      ACCEPTED
Brand + Creator Settings             ACCEPTED
Brand + Creator Payouts              ACCEPTED or explicitly bounded
remaining provider debt              EXPLICITLY CLASSIFIED
legacy product code                  NO LONGER PRIMARY AUTHORITY
AWS execution                        NOT YET STARTED
```

**Amendment activation:** this worker is already activated. The intermediate freeze satisfied the posture for the modules then in Parent lock. This amendment does **not** re-enter `FREEZE_NOT_READY` for C-04 / C-02A / Brand Payouts v1: those are subsequently accepted modules to inventory and converge. C-06 remaining in progress is `OUT_OF_MVP` until dummy_tcs accepted authority exists; that is explicit bounding, not a guess.

The exact percentage of module completion is not itself a gate. The gate is whether enough Product/architecture/runtime authority exists to define the complete intended MVP without silently inheriting unreviewed legacy behavior.

If a material product area is still unresolved, classify:

```text
FREEZE_NOT_READY
```

and return the missing authority instead of guessing.

---

## 4. Principal responsibilities

The Canonical Application Freeze AI Worker owns:

- creation and maintenance of `MVP_CANONICAL_APPLICATION_FREEZE_V1`;
- complete module inventory for the MVP;
- accepted Product/architecture/runtime authority inventory;
- exact commit and branch lineage discovery across repositories;
- distinction between runtime acceptance SHAs, docs-only closeout SHAs, later development heads and developer integration branches;
- identification of the canonical backend and frontend repository lineage;
- mapping accepted modules to exact files/commits/branches;
- identification of shared infrastructure required by multiple modules;
- whole-application ownership/coverage mapping;
- classification of remaining legacy code;
- final canonical convergence planning where accepted modules are not yet present in one repository lineage;
- bounded orchestration of Codex for mechanical repository convergence and validation;
- migration-chain and schema-coherence audit;
- cross-module invariant definition and acceptance;
- deployable build/test/security preflight;
- external-provider/configuration debt register;
- environment-variable and secret-name manifest without secret values;
- release-blocker register;
- preparation of the deterministic input package for the future AWS worker.

The worker must leave enough durable evidence that a fresh AWS worker can begin from Git + the freeze artifact rather than chat history.

---

## 5. What this worker does not own

It does not silently own:

- new Product decisions;
- module redesign;
- reinterpretation of an already accepted module contract;
- provider-policy decisions owned by Meta/Razorpay/security specialists;
- production-data repair decisions;
- AWS account/IAM/VPC/RDS/ECS/CloudFront/SST changes;
- credential creation or rotation;
- production deployment;
- destructive migrations;
- live payment execution;
- live OAuth/App Review/configuration changes unless separately authorized under the relevant provider authority.

When a genuine unresolved Product, architecture, security, provider or historical-data conflict is found, stop and route it to the appropriate authority.

---

## 6. Authority hierarchy

Use the following hierarchy during canonicalization:

```text
1. Frozen Product Authority
2. Frozen module architecture/contracts
3. Accepted module runtime SHAs and closeout artifacts
4. Accepted shared/platform implementation
5. Current canonical repository implementation containing those accepted modules
6. Historical/legacy production code as compatibility evidence only
```

Critical rule:

> **A newer destination branch does not automatically outrank an accepted module runtime or contract.**

Do not classify a failing acceptance invariant as stale merely because an older/legacy/destination implementation behaves differently.

If two accepted modules genuinely conflict, record:

```text
CROSS_MODULE_AUTHORITY_CONFLICT
```

and stop the affected convergence path until the owning authority resolves it.

---

## 7. Legacy replacement principle

By the time this worker runs, much of the legacy Creator Shop frontend/backend may be intended for replacement.

Therefore the default question is not:

> How do we preserve legacy production behavior?

It is:

> Which code represents the accepted Creator Shop MVP, and what legacy surface still contains unique required behavior?

Classify repository areas as:

```text
CANONICAL_ACCEPTED
CANONICAL_PENDING_CONVERGENCE
SHARED_INFRASTRUCTURE_RETAIN
LEGACY_COMPATIBILITY_ONLY
LEGACY_REPLACE
DEFERRED_PROVIDER_SURFACE
OUT_OF_MVP
UNKNOWN_REQUIRES_REVIEW
```

Do not preserve legacy behavior simply because it exists.

Also do not delete or ignore legacy code blindly. Every legacy area that survives into the release candidate must have an explicit disposition and reason.

`UNKNOWN_REQUIRES_REVIEW` is a freeze blocker where the area could affect an MVP journey, security boundary, persistence state, provider flow or deployment behavior.

---

## 8. Phase A — Program inventory and authority discovery

Before any convergence code changes, perform a read-only inventory.

At minimum inspect:

- `Piyush1087/dummy_tcs` Product/architecture/contracts/charters;
- canonical backend repository/repositories;
- canonical frontend repository/repositories;
- all module closeouts and developer handoffs;
- execution ledgers where available;
- accepted Stitch/UI references only where still relevant;
- migration histories;
- shared auth/session/security infrastructure;
- provider/environment requirements;
- current repository heads and branch ancestry.

Build a complete module register containing:

```text
module_id
module_name
product_authority_path + SHA
architecture_authority_path + SHA
backend_runtime_acceptance_SHA
frontend_runtime_acceptance_SHA
closeout/docs_SHA where different
current canonical branch/head
status
remaining debt
upstream dependencies
downstream consumers
```

Do not confuse a docs-only closeout commit with a runtime acceptance commit.

Do not infer missing SHAs from chat memory when Git evidence exists.

### Amendment Phase A — current authority (2026-09-10)

Inspected `Piyush1087/dummy_tcs` `main` `3ac9895901092e3de2e4e803501b3c0db0aa8c75` (`docs(c02a): publish final acceptance and integration handoff`), dummy_tcs `c04/stage-b-authority-package-v1` `7790864dbd4764b9a4118856e3ca074fb374ce7e`, and the intermediate freeze register. Durable freeze inventory remains `docs/ai-collaboration/mvp-canonical-freeze/phase-a-inventory/module-acceptance-register.md`.

**PRESENT_IN_CANONICAL_LINEAGE (already ancestors — do not re-merge):**

```text
PLAT-SHARED, GK-V1, BRAND-PREVIEW, BRAND-CENTRE-BI, PI-V1,
BRAND-SETTINGS, CHAT-HOME, BRAND-UCE, BRAND-COLLAB,
C-01, C-05, C-03, NOTIF-DE (infra)
```

**REQUIRES_CONVERGENCE (accepted; not ancestors of the intermediate freeze head):**

```text
C-04 Creator Collaboration
  product/architecture: dummy_tcs origin/c04/stage-b-authority-package-v1
                        7790864dbd4764b9a4118856e3ca074fb374ce7e
                        (docs(c04): record parent final acceptance)
  backend_runtime_acceptance_SHA:  ec395bf5760b295dddd9c3f7e9c2f05485b6b743
  frontend_runtime_acceptance_SHA: 106de9988ea2d4bd534205b083f63ae7ecd1878c
  C-02A dummy_tcs main cites this C-04 SHA as an accepted ancestor

C-02A Creator Home Foundation
  product_authority: dummy_tcs docs/ai-collaboration/c02a-parent-final-acceptance-v1.md
                     @ main 3ac9895901092e3de2e4e803501b3c0db0aa8c75
  backend_runtime_acceptance_SHA:  4e082f67953f0d6b55fa791f2cea03c8aef28119
  frontend_runtime_acceptance_SHA: 29e78397fc66676d0134c45aa0bb6af173fbe12b
  Home consumes C-04 Collaboration; C-02A owns 0 migrations

BRAND-PAYOUTS-V1
  dummy_tcs main has no payouts product file
  freeze deferred runtime SHAs remain the Git evidence:
  backend_runtime_acceptance_SHA:  a38102fd9662f1654c9572b19913b9e228385b73
  frontend_runtime_acceptance_SHA: 25441dd4fd228bec4d6c9fe9f39c2297318b6167
  do not treat old src/features/brand-payouts as this module
```

**OUT / PROVIDER_DEFERRED:**

```text
C-06 Creator Payouts               NOT_ACCEPTED on dummy_tcs main
                                   (C-02A closeout: future additive, not C-02A debt)
Marketplace / Co-Pilot / Centre    OUT_OF_MVP
Live Razorpay / Meta App Review    PROVIDER_DEFERRED
```

---

## 9. Phase B — Commit lineage and canonical-source register

Create a durable:

```text
MVP_CANONICAL_SOURCE_REGISTER
```

For backend and frontend separately, establish:

- repository full name;
- relevant branches;
- exact accepted module SHAs;
- ancestry relationships;
- merge bases where needed;
- which accepted modules are already ancestors of the prospective canonical head;
- which accepted modules require convergence;
- docs-only commits that should not be mistaken for runtime code;
- developer integration branches that are evidence only unless separately accepted;
- any branch divergence.

Required conclusion for each accepted module:

```text
PRESENT_IN_CANONICAL_LINEAGE
REQUIRES_CONVERGENCE
SUPERSEDED_BY_NEWER_ACCEPTED_AUTHORITY
DOCS_ONLY
CONFLICT_REQUIRES_REVIEW
```

No convergence run begins until this register is sufficiently complete.

### Amendment Phase B — lineage conclusions (2026-09-10)

```text
dummy_tcs main                     = 3ac9895901092e3de2e4e803501b3c0db0aa8c75
intermediate BE freeze head        = a95d0d871cbb04d37ab9cb042e17a1e397a1fb9d
intermediate FE freeze head        = 249de1a2fcaeffa013dbeb9d042f7387f8d3f972
IN module runtime SHAs             = PRESENT_IN_CANONICAL_LINEAGE (ancestors)
C-04 / C-02A / BRAND-PAYOUTS-V1    = REQUIRES_CONVERGENCE
C-06                               = not an accepted module (no runtime SHA claimed)
email SHAs 29fa51e / 5170f909      = historical checkpoints, not freeze tips
§20 RUN 6 “canonical” SHAs         = tolerable while ACTIVE; final amendment
                                     must collapse to one BE SHA + one FE SHA
```

---

## 10. Phase C — Whole-application coverage map

Prove that the intended MVP is covered by accepted authority.

Map at least:

```text
public/guest entry
Brand onboarding
Brand Preview / Brand Centre
Brand Settings
Campaign creation and Brand Campaign workspaces
Creator Entry
Creator persistent shell
Creator Settings
Creator Campaign participation
Collaboration — Brand + Creator
Payouts / earnings / KYC boundaries
shared authentication/session/security
Intelligence / Data Extraction consumers required by MVP
notifications required by MVP
provider boundaries
```

For each product route/API/domain area classify whether it is canonical, deferred, out of MVP, or legacy-only.

A route merely existing in code does not make it part of the canonical product.

Marketplace or other deliberately hidden/out-of-MVP surfaces must not re-enter the application through legacy navigation or compatibility code.

### Amendment Phase C — OUT API proof (required before PASS)

Hiding frontend chrome is allowed. It is not proof that an OUT backend API is non-competing.

For each remaining OUT API, establish:

```text
OUT API exists
        ↓
is it authenticated?
        ↓
can it mutate canonical business state?
        ↓
does another canonical API own same transition?
        ↓
can it create competing persistence?
```

If an old API remains callable but has no competing canonical business behavior, classify `OUT_OF_MVP` / compatibility.

If it can still perform an alternative canonical business transition, it violates freeze spirit even though the menu item is hidden. Retire that transition or stop and record `CROSS_MODULE_AUTHORITY_CONFLICT`.

---

## 11. Phase D — Cross-module invariant preflight

Before mechanical convergence, define a compact high-value invariant suite.

The suite should focus on boundaries between accepted modules, not thousands of duplicated module assertions.

Examples include:

- one canonical auth/session model across Brand and Creator;
- normalized identity/account ownership invariants;
- Creator Entry gating and recovery boundaries;
- C-05 Team actor vs canonical Creator business subject;
- Creator shell route ownership and hidden Marketplace behavior;
- Campaign Application identity and Product/Brief relationship;
- accepted Application → exact Collaboration handoff;
- Collaboration commercial agreement → payout/settlement boundary;
- Settings shipping/contact → Collaboration fulfillment consumption;
- provider state fail-closed behavior;
- backend business state authoritative over frontend display state;
- cross-tenant and cross-role isolation;
- no duplicate competing persistence models for the same canonical concept.

Every invariant must identify its authority source and the repositories/files/tests that prove it.

### Amendment Phase D — INV-13

`INV-13` leftover journey writers are now **PASS classified** (tables retained, no Prisma drop). Final freeze PASS still requires remaining §18 gates and security/release proof.

```text
competing runtime writer     = live service still creates/updates the non-canonical model
harmless retained schema     = table/model remains; no canonical journey writes it
silent Prisma drop           = FORBIDDEN this amendment
```

---

## 12. Phase E — Canonical convergence plan

If no single backend/frontend lineage already contains all accepted modules, create a finite convergence plan.

This is **new-canonical-stack convergence**, not legacy-production reconciliation.

Prefer:

```text
accepted canonical modules
        ↓
shared-platform reconciliation
        ↓
one canonical backend branch
one canonical frontend branch
```

Avoid:

```text
legacy production behavior
        ↓
selectively overriding accepted module contracts
```

The plan must specify:

- exact starting SHAs;
- exact accepted source SHAs;
- target branches;
- module ordering;
- shared files likely to collide;
- migration ordering;
- allowed/forbidden scope;
- tests after each meaningful convergence block;
- checkpoint commits;
- hard STOP conditions;
- rollback/reset points.

Prefer new bounded canonicalization branches rather than force-moving existing accepted refs.

Never force-push unless Product Authority explicitly authorizes an exceptional recovery action.

### Amendment Phase E — reconstructed order (not a copied email sequence)

Starting SHAs:

```text
BACKEND_START   = a95d0d871cbb04d37ab9cb042e17a1e397a1fb9d
FRONTEND_START  = 249de1a2fcaeffa013dbeb9d042f7387f8d3f972
TARGET_BRANCH   = freeze/mvp-canonical-application-v1
```

Order reconstructed from dummy_tcs C-02A acceptance (Home consumes C-04; C-02A backend already contains C-04 `ec395bf5…` as ancestor) and from remaining freeze deferred runtime SHAs. This is dependency reconstruction, not a permanent authority ladder.

```text
C-04 Creator Collaboration
        ↓
C-02A Creator Home Foundation
        ↓
Brand Payouts v1 (if still not an ancestor after C-04)
        ↓
C-06 only if dummy_tcs later records accepted authority
```

C-04 owns migration `20260911125000_c04_brand_payouts_reserve_entitlement_lineage`. That is C-04 lineage, not Brand Payouts v1. Do not reassign it to C-02A. Do not treat old `src/features/brand-payouts` as Brand Payouts v1.

Shared files likely to collide: Prisma schema / Collaboration models, creator shell / `/creator/home`, payouts vs escrow.

After each module block: Prisma validate/generate, targeted module tests, then continue. STOP on schema concatenation, migration-chain conflict, or `CROSS_MODULE_AUTHORITY_CONFLICT`. Rollback point is the previous checkpoint SHA. Parent runs freeze-DB `migrate deploy` when schema is valid; do not migrate `thecreatorshop`.

---

## 13. Phase F — Codex execution policy

Use Codex for large repository searches, mechanical convergence, builds, migrations on disposable databases and broad runtime validation.

Every runner assignment follows the organization-wide Codex operating standard.

Recommended execution sequence:

```text
RUN 1 — READ-ONLY PREFLIGHT
commit lineage / migration graph / collision map

RUN 2 — CANONICAL CONVERGENCE
accepted modules + shared infrastructure only

RUN 3 — WHOLE-APPLICATION ACCEPTANCE
build / typecheck / lint / tests / disposable DB / security / runtime

RUN 4 — FREEZE PREPARATION
manifest / evidence / final SHAs / AWS input package
```

A runner does not own authority reconciliation. When accepted sources conflict, it stops and returns evidence.

Every material run should maintain an execution ledger and checkpoint SHA.

---

## 14. Database and migration SOP

The worker must prove that the release-candidate schema is coherent before AWS work begins.

At minimum verify:

- one canonical Prisma/schema source;
- migration ordering and count;
- no duplicate/conflicting migration identities;
- accepted module migrations are present;
- no migration was lost during convergence;
- no unexpected destructive operation;
- fresh empty database can migrate `0 → canonical head`;
- Prisma/schema validation passes;
- application boots against a disposable migrated database;
- seed/fixture assumptions are documented separately from production data.

Classify production-data posture without modifying AWS:

```text
FRESH_DB_EXPECTED
HISTORICAL_DATA_RECONCILIATION_REQUIRED
PRODUCTION_DB_STATE_UNKNOWN
```

If historical production data may matter, the freeze must identify that as an AWS/release gate. Do not silently assume a destructive fresh start.

### Amendment — AWS test account is creator-dev

The freeze worker still does not deploy. When an AWS worker (or Parent) runs env/DB proof, the test account is **`creator-dev`** (`--stage dev`, profile `creator-dev`), **not** `creator-prod`.

```text
AWS test / AWS DB              = creator-dev
jumpbox                        = temp-dev-db-ssm-jump (scripts/start-dev-tunnel.ps1 / npm run db:tunnel:dev)
creator-dev data               = disposable for freeze/dev proof; may be cleaned and migrated fresh
creator-prod                   = DO NOT TOUCH until real go-live
sst deploy --stage prod        = NOT THIS WORKER
OTP codes in logs              = required on STAGE=dev; forbidden on STAGE=prod
```

Do not use `creator-prod` as a test bed. Do not treat a clean of creator-dev as a production-data decision. Live IG / Razorpay remain `PROVIDER_DEFERRED` on that account until Product runs them.

---

## 15. Security and release hygiene SOP

Before freeze, explicitly scan for release-critical hazards including:

- hard-coded OTPs;
- test passwords or bypass users;
- deployable mock authentication;
- placeholder provider secrets accidentally accepted as real;
- committed credentials/tokens;
- permissive redirect/callback shortcuts;
- disabled auth/RBAC guards;
- cross-tenant data exposure;
- unsafe internal redirects;
- debug endpoints or test-only routes exposed in release builds;
- frontend-only authorization where backend enforcement is required;
- non-production provider success simulation presented as production-ready.

Required posture:

```text
NO_KNOWN_DEPLOYABLE_SECURITY_BYPASS
```

A known fixed OTP or equivalent authentication bypass is a freeze blocker unless the deployable build can prove it is impossible in the target AWS environment and the relevant security authority has explicitly accepted that mechanism.

Do not weaken tests merely to accommodate an unsafe destination implementation.

### Amendment — security declaration

The intermediate artifact correctly left the sentence undeclared until AWS-dev proof. Live creator-dev read 2026-09-11:

```text
NO_KNOWN_DEPLOYABLE_SECURITY_BYPASS = DECLARED 2026-09-11
  bound = freeze source + live creator-dev ECS env
```

That is not freeze PASS and not creator-prod. Live ECS `STAGE=dev`; `[OTP]` CloudWatch events present (codes not recorded); `CREATOR_APPLY_BYPASS_EMAILS=test@creator.com` is the named AWS-dev targeting list (not login). Empty apply-bypass and no OTP logs on `STAGE=prod` remain **future prod-deploy** gates. Competing leftover collab shipping writes are retired `410`. Remaining callable leftovers that are not login bypasses: Brand UCE second persistence engine (IN), Chat Home HITL campaign/planner intents, unauthenticated public marketplace GET (read-only), Centre media-kit PATCH (OUT writing OUT).

---

## 16. External provider and deferred-debt register

The MVP may be code-ready while some live provider work remains.

Maintain:

```text
MVP_EXTERNAL_DEPENDENCY_REGISTER
```

For each dependency record:

```text
provider
capability
code_state
configuration_state
live_validation_state
credential_or_permission_prerequisite
blocks_AWS_dev
blocks_production
owner/future_worker
```

Examples may include Meta/Instagram, Razorpay, Postmark, Google, Similarweb, Zyte or other active dependencies.

Use explicit statuses such as:

```text
CODE_READY
PROVIDER_CONFIGURATION_PENDING
LIVE_VALIDATION_PENDING
DEFERRED_NONBLOCKING
AWS_DEV_BLOCKER
PRODUCTION_BLOCKER
OUT_OF_MVP
```

Never store secret values in the freeze artifact. Record variable/secret **names and requirements only**.

---

## 17. Environment/configuration manifest

Prepare a canonical environment manifest containing:

- required environment variable names;
- which service owns each variable;
- required/optional classification;
- dev vs production distinction;
- safe default behavior when absent;
- provider-specific prerequisites;
- callback/domain assumptions;
- required build-time variables;
- required runtime variables;
- secret-store expectation.

The future AWS worker should not need to search application code to discover basic configuration requirements.

Do not copy actual secrets into Git.

---

## 18. Whole-application validation gate

Before `MVP_CANONICAL_APPLICATION_FREEZE_V1` may be marked accepted, validate as applicable:

```text
fresh checkout/reproducibility
package install / lockfile integrity
backend build
frontend typecheck
frontend build
lint or explicitly classified repository debt
unit/contract tests
module acceptance suites
cross-module invariant suite
fresh disposable database migration
Prisma/schema validation
backend boot + health
frontend ↔ backend smoke where locally possible
auth/session regression
RBAC / actor-subject / cross-tenant security
responsive shell/navigation smoke
provider-unavailable recovery states
compiled/deployable artifact presence
clean worktrees
local/remote checkpoint equality
```

Do not greenwash failures.

Classify each failure:

```text
CANONICAL_REGRESSION
PREEXISTING_ACCEPTED_DEBT
ENVIRONMENT_BLOCKED
PROVIDER_BLOCKED
STALE_TEST_PROVEN
RELEASE_BLOCKER
```

`STALE_TEST_PROVEN` requires evidence from accepted authority; “destination behaves differently” is not proof.

### Amendment — affected gates only

After each convergence block, rerun gates the pull can change. Do not re-open classified prettier 712 or environment-blocked farms as a PASS claim unless the pull actually changes that surface.

BE `prettier/prettier` 712 is **accepted this freeze** (`PREEXISTING_ACCEPTED_DEBT`). Do not `--fix`. Run `npm run lint:eslint` (ESLint with `eslint-plugin-prettier` disabled). If that run is clean, backend lint is **PASS classified**. `npm run lint` still reports the prettier farm. New non-prettier eslint findings are not auto-accepted. Full `npm test` farms stay classified / not greened.

C-04 collab files previously classified `STALE_TEST_PROVEN` (`node:test`, vitest 0 suites) are **re-proven** this amendment: Vitest **14 files / 106 tests PASS**. Harnesses were retargeted to the current C-04 / Brand Payouts constructors (projection outbox, advisory lock, payouts lineage, retired Manual rail). That classification does not automatically clear other STALE / ENVIRONMENT_BLOCKED farms.

When a subsequent accepted module is pulled, apply the same rule: empty or stale suites owned by that module must be re-proven after it is in lineage. INV-08 stays PARTIAL until C-06. INV-09 leftover collab shipping HTTP/service is retired `410`; C-04 destination `confirmDefault` consumes `CreatorShippingAddress` (snapshot onto `CollaborationDeliveryDestination`; fulfillment gates on that snapshot). Do not invent a live fulfillment join. INV-11 accepted-IN clients are PASS classified. INV-13 leftover journey writers are PASS classified (tables retained).

---

## 19. Circuit breakers

Stop immediately on:

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

After a breaker:

```text
bounded evidence
→ owning authority review
→ bounded correction
→ rerun affected gate
```

Do not route around a breaker by preserving legacy behavior without authority.

---

## 20. Required freeze artifact

The final durable artifact is:

```text
MVP_CANONICAL_APPLICATION_FREEZE_V1
```

It must contain at least:

```text
status
freeze_date
architecture_authority_repo + SHA

BACKEND_CANONICAL_REPOSITORY
BACKEND_CANONICAL_BRANCH
BACKEND_CANONICAL_SHA

FRONTEND_CANONICAL_REPOSITORY
FRONTEND_CANONICAL_BRANCH
FRONTEND_CANONICAL_SHA

MODULE_ACCEPTANCE_REGISTER
CANONICAL_SOURCE_REGISTER
LEGACY_DISPOSITION_REGISTER
CROSS_MODULE_INVARIANT_RESULTS
MIGRATION_AND_SCHEMA_REGISTER
ENVIRONMENT_REQUIREMENTS
EXTERNAL_DEPENDENCY_REGISTER
SECURITY_RELEASE_CHECK
BUILD_TEST_RUNTIME_EVIDENCE
KNOWN_DEBT
AWS_DEV_BLOCKERS
PRODUCTION_BLOCKERS
ROLLBACK_REFERENCE_POINTS
POST_DEPLOY_SMOKE_REQUIREMENTS
```

The freeze is invalid if it points vaguely to “latest development”. It must name immutable SHAs.

The freeze is also invalid if a major module is represented only by a chat statement without durable authority or repository evidence.

### Amendment — one SHA pair

While status is ACTIVE, later ledger checkpoints may sit above older §20 SHAs. That is tolerable only until this amendment publishes:

```text
BACKEND_CANONICAL_SHA    = <one immutable commit>
FRONTEND_CANONICAL_SHA   = <one immutable commit>
status                   = still not PASS until remaining gates close
```

Do not publish the freeze branch name as the canonical identity.

---

## 21. Freeze semantics

When accepted, the worker may declare:

```text
PASS — MVP_CANONICAL_APPLICATION_FREEZE_V1
```

This means:

- the intended MVP application is represented by exact immutable Git SHAs;
- all accepted modules are accounted for;
- legacy code has explicit disposition;
- the canonical migration chain is known;
- whole-application acceptance evidence is durable;
- remaining provider/deployment debt is explicit;
- AWS execution can begin from this package without reconstructing module history.

It does **not** mean:

- AWS has been audited;
- production data is safe to migrate;
- provider configuration is complete;
- production deployment is authorized.

Those remain downstream gates.

---

## 22. Handoff to the future AWS worker

The final handoff to the AWS worker must make clear that the application freeze is its immutable software input.

Provide:

- backend/frontend canonical SHAs;
- build commands;
- migration commands and expected migration count/state;
- required environment variable/secret names;
- expected service ports/health endpoints;
- domain/callback assumptions;
- provider blockers;
- database-state assumptions;
- minimum post-deploy smoke matrix;
- rollback Git SHAs;
- known nonblocking debt;
- explicit production blockers.

The AWS worker then independently owns:

```text
AWS test account                 = creator-dev / --stage dev
jumpbox                          = npm run db:tunnel:dev (temp-dev-db-ssm-jump)
creator-dev DB                   = may be cleaned and migrated fresh
creator-prod                     = DO NOT TOUCH until real go-live
```

Plus the usual AWS audit / IAM / VPC / RDS / ECS / secret injection / `--stage dev` deploy / production release gates. This freeze worker still does not deploy.

```text
AWS account / region confirmation
IAM and permission model
network/VPC/subnet/security-group audit
RDS/Aurora identification and data-state audit
ECS/ECR/SST/CloudFront/S3 or relevant compute/frontend deployment topology
secret injection
AWS-development deployment
runtime observability
production release gates
```

The Canonical Application Freeze AI Worker must not pre-empt those decisions.

---

## 23. Recommended durable artifacts

During execution maintain, as needed:

```text
docs/ai-collaboration/mvp-canonical-source-register-v1.md
docs/ai-collaboration/mvp-canonical-convergence-plan-v1.md
docs/ai-collaboration/mvp-canonical-execution-ledger-v1.yaml
docs/ai-collaboration/mvp-external-dependency-register-v1.md
docs/ai-collaboration/mvp-canonical-application-freeze-v1.md
```

Exact paths may be reconciled with repository organization at activation time, but the final freeze artifact must be durable in Git.

---

## 24. Definition of worker completion

The worker completes only when:

```text
all MVP modules inventoried
+ exact accepted SHAs traced
+ canonical backend/frontend lineage established
+ required canonical convergence completed
+ migration chain proven
+ cross-module invariants passed or bounded debt accepted
+ security release blockers cleared
+ external/provider debt explicit
+ exact backend/frontend freeze SHAs recorded
+ AWS input package complete
```

Terminal state:

```text
PASS — MVP_CANONICAL_APPLICATION_FREEZE_V1
CANONICAL_APPLICATION_FREEZE_WORKER = RETIRE_AFTER_AWS_HANDOFF
```

If AWS later discovers a software inconsistency that changes the frozen application, reactivate this worker for a bounded freeze amendment rather than allowing the AWS worker to redesign application behavior ad hoc.

### Amendment — completion vs PASS

This amendment is **not** complete, and **not** PASS, until remaining review items 6–7 are closed with durable evidence (affected smoke/farms as required, one origin-published SHA pair). Item 5 (security sentence) is DECLARED 2026-09-11 for freeze source + live creator-dev ECS env. Items 1–4 of the review remaining-work list are closed or classified as this amendment records. Classification of prettier/farm debt is not clearance. AWS deploy of freeze SHAs remains a downstream worker.

---

## 25. Principal rule

> **The freeze worker does not make legacy production code canonical by default, and it does not make “latest branch” canonical by convenience. It proves exactly which accepted application we intend to deploy, freezes that application at immutable SHAs, and hands AWS a deterministic software artifact.**
