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
BACKEND_CANONICAL_SHA         = c055ca8335f639a5b9d0d3cc03cfdf9693139647

FRONTEND_CANONICAL_REPOSITORY = growth-verse/creator-commerce-frontend-v2
FRONTEND_CANONICAL_BRANCH     = freeze/mvp-canonical-application-v1
FRONTEND_CANONICAL_SHA        = 3e32b7421b37a743dcd10378e7aa9a465bc89774

ARCHITECTURE_AUTHORITY_REPO   = Piyush1087/dummy_tcs
ARCHITECTURE_AUTHORITY_SHA    = 3e4bc9a8068779fb7cb283ec7ed9c682ca968dbf
```

These are the RUN 4 evidence commits (artifact + §18 results). A follow-up ledger-record commit may sit on top; it does not replace these freeze SHAs.

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

DEFERRED (accepted, not pulled): C-02A, C-04, Brand Payouts v1
OUT: C-06, Marketplace, Co-Pilot / Creator Co-Pilot, Creator Centre / Media Kit / Analytics
PROVIDER_DEFERRED: live Razorpay, Meta App Review
```

---

## CANONICAL_SOURCE_REGISTER

Canonical: `phase-b-lineage/canonical-source-register.md`

Accepted modules are ancestors of the development snapshot. C-02A / C-04 / Brand Payouts v1 remain `REQUIRES_CONVERGENCE` later and were **not** pulled.

---

## LEGACY_DISPOSITION_REGISTER

Canonical: `phase-a-inventory/legacy-disposition.md`

OUT/deferred product is hidden from nav and routes on the freeze branches. Mixed-folder code (Co-Pilot APIs/schema, old payout hubs, duplicate persistence) is classified, not deleted.

---

## CROSS_MODULE_INVARIANT_RESULTS

Definition: `phase-d-invariants/cross-module-invariant-suite.md`  
Results: `18-validation/11-invariant-results.md`

```text
INV-01 PASS (static/unit)
INV-02 PARTIAL (C-01 org trigger observed)
INV-03 PASS (architecture + smoke)
INV-04 PASS (architecture/unit)
INV-05 PASS (unit + smoke)
INV-06 NOT_RUN (postgres)
INV-07 NOT_RUN (handoff postgres; collab seed STALE_TEST_PROVEN)
INV-08 PARTIAL (C-05 payout boundary unit)
INV-09 NOT_RUN
INV-10 PARTIAL (Postmark fail-closed locally; live IG/Razorpay NOT_RUN)
INV-11 PARTIAL (Brand Home fail-closed for Creator session)
INV-12 PARTIAL (unit + Brand↛Creator browser)
INV-13 FAIL classified UNKNOWN_REQUIRES_REVIEW
```

---

## MIGRATION_AND_SCHEMA_REGISTER

Canonical: `14-migration-schema/migration-and-schema-register.md`

```text
MIGRATION_COUNT = 87
HEAD = 20260910122000_c03_application_handoff_notifications
FRESH_DB = freeze_mvp_canonical_v1  0→head PASS 87/87
thecreatorshop = NOT MIGRATED
PRISMA VALIDATE = PASS
SCHEMA DROP / Prisma table drop for OUT models = NOT THIS FREEZE
```

---

## ENVIRONMENT_REQUIREMENTS

Canonical: `17-environment/environment-requirements.md`  
Names only. No secret values.

---

## EXTERNAL_DEPENDENCY_REGISTER

Canonical: `16-external-providers/external-dependency-register.md`

Local smoke: Postmark send failed; OTP still issued because `STAGE` was not `prod`. Production must not log OTP codes.

---

## SECURITY_RELEASE_CHECK

Canonical: `15-security/security-release-check.md`

```text
NO_KNOWN_DEPLOYABLE_SECURITY_BYPASS  = NOT YET DECLARED
```

Blockers before PASS / prod:

1. Production `CREATOR_APPLY_BYPASS_EMAILS` empty (or security authority accepts a named list).
2. OTP codes never logged when `STAGE=prod`.
3. OUT APIs (Co-Pilot, Centre, old payout hubs, public marketplace) unwired or explicitly accepted as non-product with auth still required.
4. Remaining §18 auth/RBAC/cross-tenant postgres proofs or Parent-accepted debt.

---

## BUILD_TEST_RUNTIME_EVIDENCE

Canonical: `18-validation/build-test-runtime-evidence.md`

```text
FE typecheck PASS
FE build PASS
FE lint PASS
BE prisma validate PASS
BE build PASS
BE boot+health PASS on freeze_mvp_canonical_v1
FE invariant vitest 70/70 PASS
BE invariant vitest 51/51 PASS
FE↔BE OTP smoke PARTIAL PASS
BE lint FAIL 712 prettier  PREEXISTING_ACCEPTED_DEBT
full npm test NOT_RUN
npm ci fresh clone NOT_RUN
```

---

## KNOWN_DEBT

- C-02A / C-04 / Brand Payouts v1 not pulled (Parent lock).
- C-06, Marketplace, Co-Pilot, Creator Centre hidden, APIs/schema still in tree.
- INV-13 duplicate persistence (`UceCampaignCollaboration` vs `Collaboration`; bank/payout models).
- `scripts/seed-dev-collaboration.ts` stale vs Prisma (`STALE_TEST_PROVEN`).
- `db:seed:dev-creator` does not create an ACTIVE Creator organization (OTP ineligible).
- Creator post-login can return to `/brand/*` if that was the unauthenticated `from` path.
- BE prettier farm (712).
- `/brand/intelligence/identity-test` still mounted (legacy test surface).
- Chunk-size FE build warning.
- Dedicated postgres invariant DBs not created this freeze.

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
- OUT APIs still reachable if called.
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
3. Creator OTP or Google login → `/creator/home` deferred entry (not C-02A content); Campaigns opportunities; Settings; Centre redirects Home; `/creator/payouts` → Settings payouts.
4. Brand login → Brand Home; Brand Centre; `/brand/uce/campaigns`; Collaborations; Settings.
5. Brand session cannot complete Creator setup.
6. Nav must not advertise Marketplace, Co-Pilot, Creator Centre, or old payout hubs.
7. Confirm `STAGE` matches env; Postmark delivers in that env or fail-closed without logging codes on prod.

---

## Pass line (forbidden until Parent accepts remaining gates)

```text
PASS — MVP_CANONICAL_APPLICATION_FREEZE_V1
```

is **not** declared.
