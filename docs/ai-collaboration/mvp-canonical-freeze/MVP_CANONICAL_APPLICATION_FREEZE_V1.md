# MVP_CANONICAL_APPLICATION_FREEZE_V1

**status:** ACTIVE — not `PASS — MVP_CANONICAL_APPLICATION_FREEZE_V1`  
**freeze_date:** 2026-09-08  
**architecture_authority_repo:** `Piyush1087/dummy_tcs`  
**architecture_authority_branch:** `freeze/mvp-canonical-application-v1`

This file is the charter §20 artifact. It is valid as a **durable freeze package** and **invalid as a PASS declaration**. Remaining gates are explicit. AWS deploy is out of scope for this worker.

OTP codes, secrets, and live credentials are not recorded here.

---

## Canonical repositories and SHAs

Immutable `origin/development` snapshot (not freeze SHAs):

```text
ORIGIN_DEVELOPMENT_FRONTEND = c83ab8bab02ace8872a53de81cc8ffe79ccda832
ORIGIN_DEVELOPMENT_BACKEND  = cd446fb4bd356fe03faf16c6c7a282a55cebcf08
```

Freeze workspace (do not treat `development` / `main` as the freeze):

```text
BACKEND_CANONICAL_REPOSITORY  = growth-verse/creator-commerce-backend-v2
BACKEND_CANONICAL_BRANCH      = freeze/mvp-canonical-application-v1
BACKEND_CANONICAL_SHA         = aaa0b834ee6fce6785c8c4bc9bcc33847910b825

FRONTEND_CANONICAL_REPOSITORY = growth-verse/creator-commerce-frontend-v2
FRONTEND_CANONICAL_BRANCH     = freeze/mvp-canonical-application-v1
FRONTEND_CANONICAL_SHA        = 12fa514d37dfe6ade1d2991aa86a0b8635cf34c7

ARCHITECTURE_AUTHORITY_REPO   = Piyush1087/dummy_tcs
ARCHITECTURE_AUTHORITY_SHA    = 86d8e49e6d1fc0c5ef68b1c89507339de5ca80c5
```

These are the 2026-09-10 amendment **evidence** commits (C-04 / C-02A / Brand Payouts pulls + INV-13 Pair 1 / OUT competing-transition retirements). A ledger-record commit may sit on top; use the pushed freeze-branch tips as the immutable pair for this amendment. RUN 6 evidence remains `4d4b350` / `511d5e3`.

RUN 3 ledger-record (parent of RUN 4 evidence):

```text
FRONTEND  a91cb9aee6df5340819ee26e2cd92612aba846d5
BACKEND   319691820bb4c0d1fa55a80398c686e40cb8cd93
dummy_tcs 92aea72a32cbab473abe57c536c3f9bf8cb8cba4
```

---

## MODULE_ACCEPTANCE_REGISTER

Canonical: `phase-a-inventory/module-acceptance-register.md`

Parent locks 2026-09-08:

```text
IN: shared platform, Gatekeeper, Brand Preview/Onboarding, Brand Centre + BI P1,
    Product Intelligence V1, Brand Settings MVP, Chat Home / Brand Home V1,
    Brand Campaign/UCE, Brand Collaboration + Phase G, C-01, C-05, C-03,
    notifications/DE as infra

DEFERRED: none remaining from the review subsequent set
PULLED this amendment: C-02A, C-04, Brand Payouts v1
OUT: C-06, Marketplace, Co-Pilot / Creator Co-Pilot, Creator Centre / Media Kit / Analytics
PROVIDER_DEFERRED: live Razorpay, Meta App Review
```

---

## CANONICAL_SOURCE_REGISTER

Canonical: `phase-b-lineage/canonical-source-register.md`

Accepted modules are ancestors of the freeze working tree after this amendment's C-04 / C-02A / Brand Payouts v1 pulls. C-06 remains OUT.

---

## LEGACY_DISPOSITION_REGISTER

Canonical: `phase-a-inventory/legacy-disposition.md`

OUT/deferred product is hidden from nav and routes on the freeze branches. Mixed-folder code (Co-Pilot APIs/schema, old payout hubs, duplicate persistence) is classified, not deleted.

---

## CROSS_MODULE_INVARIANT_RESULTS

Definition: `phase-d-invariants/cross-module-invariant-suite.md`  
Results: `18-validation/11-invariant-results.md`

```text
INV-01 PASS (static/unit + postgres 10/10 on bs12_freeze_auth)
INV-02 PASS (I2 leftover closed; same 29/29 as INV-03)
INV-03 PASS architecture/smoke + postgres 29/29 (harness ctor aligned)
INV-04 PASS (unit + postgres 5/5 on c05_freeze_team)
INV-05 PASS (unit + smoke; Chat architecture test retargeted RUN 9)
INV-06 PASS postgres (fresh c03_p14_handoff 34/34 serial, 2026-09-09)
INV-07 PASS postgres handoff; local collab seed leftover closed RUN 9 (legacy fixture)
INV-08 PARTIAL (C-05 payout boundary unit)
INV-09 PARTIAL (C-05 Settings contact proven; fulfillment does not consume that address)
INV-10 PARTIAL (Postmark OTP live send PASS 2026-09-10; live IG/Razorpay NOT_RUN)
INV-11 PARTIAL (Brand Home fail-closed for Creator session)
INV-12 PASS (unit + postgres 11/11 on bs07_freeze_auth + browser)
INV-13 FAIL classified (Pair 1 UceCampaignCollaboration writes retired; leftover commercial-table source writers remain). No Prisma drop.
```

---

## MIGRATION_AND_SCHEMA_REGISTER

Canonical: `14-migration-schema/migration-and-schema-register.md`

```text
MIGRATION_COUNT = 94
HEAD = 20260912100000_brand_payouts_wave_b_normal_path
FRESH_DB = freeze_mvp_canonical_v1  Parent applied C-04 overlay + Payouts Wave B (94 migrations)
thecreatorshop = NOT MIGRATED
PRISMA VALIDATE = PASS (re-run this amendment)
SCHEMA DROP / Prisma table drop for OUT models = NOT THIS FREEZE
```

---

## ENVIRONMENT_REQUIREMENTS

Canonical: `17-environment/environment-requirements.md`  
Names only. No secret values.

---

## EXTERNAL_DEPENDENCY_REGISTER

Canonical: `16-external-providers/external-dependency-register.md`

Local smoke RUN 4: Postmark send failed (invalid TemplateId `1`); OTP still issued because `STAGE` was not `prod`. RUN 11: OTP template live send **PASS** to Parent-confirmed inboxes. Production must not log OTP codes.

---

## SECURITY_RELEASE_CHECK

Canonical: `15-security/security-release-check.md`

```text
NO_KNOWN_DEPLOYABLE_SECURITY_BYPASS  = NOT DECLARED THIS FREEZE
```

**Parent 2026-09-09:** residuals accepted as **AWS-dev / production gates**, not this-freeze unwind.

1. Production `CREATOR_APPLY_BYPASS_EMAILS` empty (or security authority named list) — **AWS / prod worker**.
2. OTP codes never logged when `STAGE=prod` — **AWS worker must prove**.
3. Competing OUT collab/marketplace command writes retired `410` this amendment. Modules stay mounted. Remaining: Brand UCE second engine, Chat Home HITL campaign/planner, public marketplace GET (read-only), Centre media-kit PATCH.
4. §18 auth/RBAC/cross-tenant postgres INV-01/04/12 PASS.

This freeze still does **not** declare `NO_KNOWN_DEPLOYABLE_SECURITY_BYPASS` or `PASS — MVP_CANONICAL_APPLICATION_FREEZE_V1`.

---

## BUILD_TEST_RUNTIME_EVIDENCE

Canonical: `18-validation/build-test-runtime-evidence.md`

```text
FE typecheck PASS
FE build PASS
FE lint PASS
BE prisma validate PASS
BE build PASS (working tree; Parent reconfirm generate+build 2026-09-09; clone nest hung under load)
BE boot+health PASS on freeze_mvp_canonical_v1
FE invariant vitest 70/70 PASS
BE invariant vitest 51/51 PASS
FE↔BE OTP smoke PARTIAL PASS
responsive shell/nav viewport PASS (RUN 8: UCE table→cards + Creator viewport)
BE lint FAIL 712 prettier  PREEXISTING_ACCEPTED_DEBT
postgres INV-01/02/03/04/12/06/07 PASS (INV-03 29/29 RUN 7)
FE npm ci clone typecheck/lint/build PASS
BE npm ci clone validate PASS; build requires prisma generate
full FE npm test RUN 5 FAIL 3/1060; named files closed (auth static RUN 12 isolated PASS; chat RUN 9; billing types amended). Full farm not re-run
full BE npm test FAIL 18/7170 classified; CORS/brief-pack/Gatekeeper isolated PASS (farm load)
```

---

## KNOWN_DEBT

- C-02A / C-04 / Brand Payouts v1 **pulled** this amendment (not freeze PASS).
- C-06, Marketplace, Co-Pilot, Creator Centre hidden; competing OUT collab/marketplace command writes retired `410`; modules/schema still in tree.
- INV-13 Pair 1 `UceCampaignCollaboration` writes retired `410`. Writer proof: `phase-d-invariants/inv-13-competing-writers.md`. No Prisma drop. Pair 2 leftover commercial source writers remain.
- `db:seed:dev-creator` does not create an ACTIVE Creator organization (OTP ineligible).
- BE prettier farm (712) — Parent: do not `--fix`.
- Chunk-size FE build warning.
- FE `authAuthorizationHeader` helper — **closed RUN 12** (Brand Centre/UCE use `authenticatedFetch`; helper removed).
- Unused FE Brand withdrawal contract types deleted 2026-09-09; backend withdrawal-account API still present.
- BE financial-producer / route-payout architecture greps — re-prove after Payouts pull (this amendment's targeted unit tests, not full farm).
- Clone `npm run build` does not run `prisma generate`; nest build under CPU contention was killed.

---

## AWS_DEV_BLOCKERS

This worker did **not** inspect AWS. From registers, AWS-dev cannot be treated as proven until the AWS worker supplies:

- RDS `DATABASE_URL` and migrate posture (greenfield vs existing).
- SST/ECS secrets: JWT, OTP pepper, settings encryption, Postmark, Gemini/Zyte as required by Brand onboarding, S3, Instagram if C-01 connect is in that env.
- `STAGE=dev` (not prod OTP logging rules), empty or reviewed `CREATOR_APPLY_BYPASS_EMAILS`.
- Confirmation that freeze SHAs — not `development` — are what get deployed.

---

## PRODUCTION_BLOCKERS

- Same as AWS-dev plus `STAGE=prod`, no OTP logging, empty apply-bypass, live Razorpay/Meta App Review still `PROVIDER_DEFERRED`.
- Production data reconciliation unknown (`PRODUCTION_DB_STATE_UNKNOWN`).
- Competing OUT collab/marketplace command writes retired `410`. Remaining callable: Brand UCE second engine, Chat Home HITL campaign/planner, public marketplace GET, Centre media-kit PATCH.
- Parent has not authorized production release.

---

## ROLLBACK_REFERENCE_POINTS

```text
Untouched development snapshot:
  FE c83ab8bab02ace8872a53de81cc8ffe79ccda832
  BE cd446fb4bd356fe03faf16c6c7a282a55cebcf08

This freeze does not merge to development/main.
Rollback of a future AWS deploy of freeze SHAs is an AWS-worker concern.
Local disposable DB freeze_mvp_canonical_v1 may be dropped; do not drop thecreatorshop.
```

---

## POST_DEPLOY_SMOKE_REQUIREMENTS

After any future deploy of these freeze SHAs (AWS worker):

1. `/health/live` and `/health/ready` as applicable.
2. Unauthenticated `/login`; `/marketplace` unavailable copy.
3. Creator OTP or Google login → `/creator/home` (C-02A); Campaigns opportunities; Settings; Centre redirects Home; `/creator/payouts` → Settings payouts.
4. Brand login → Brand Home; Brand Centre; `/brand/uce/campaigns`; Collaborations; Settings; `/brand/payouts` Brand Payouts v1 (provider-disabled).
5. Brand session cannot complete Creator setup.
6. Nav must not advertise Marketplace, Co-Pilot, Creator Centre, or old payout hubs.
7. Confirm `STAGE` matches env; Postmark delivers in that env or fail-closed without logging codes on prod.

---

## Pass line (forbidden until Parent accepts remaining gates)

```text
PASS — MVP_CANONICAL_APPLICATION_FREEZE_V1
```

is **not** declared.
