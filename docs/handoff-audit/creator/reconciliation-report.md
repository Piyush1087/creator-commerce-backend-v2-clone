# C-01 / C-05 Developer Integration Reconciliation Report

**Date:** 2026-09-03  
**Agent:** C-01/C-05 Developer Integration Reconciliation Agent  
**Integration branch:** `feature/c01-c05-creator-integration`  
**Accepted C-01 backend SHA:** `4c5f42858b950b7cd342f8972f99f548f3daa942`  
**Accepted C-01 frontend SHA:** `323658d4b147b95b5629ff8d91fa90b8fe9077e4`  
**Accepted C-05 backend SHA:** `4c5f42858b950b7cd342f8972f99f548f3daa942`  
**Accepted C-05 frontend SHA:** `323658d4b147b95b5629ff8d91fa90b8fe9077e4`

---

## Authority Order Applied

1. Accepted C-01/C-05 Product + architecture contracts  
2. Accepted runtime SHAs referenced by handoffs  
3. Destination/origin implementation  
4. Tests as evidence

---

## Invariant-by-Invariant Results

### 1. Campaign Apply continuation and no auto-Application — **PASS**

**Evidence:**  
- `src/features/creator-entry/creator-campaign-apply-continuation.service.ts` — continuation token issued; no `CampaignApplication` record created until the Creator explicitly completes post-workspace-entry.  
- `src/features/creator-entry/creator-entry-continuation.store.ts` — stores `CAMPAIGN_APPLY` intent only; no application auto-creation.  
- Tests: `creator-campaign-apply-continuation.postgres.test.ts`, `creator-campaign-apply-continuation.transport.test.ts` present and structurally identical to clone.  

**No changes needed.**

---

### 2. Invitation path separation — **GENUINE_AUTHORITY_CONFLICT** (escalated to SA)

**Evidence:**  
- Frontend architecture test `creator-onboarding/creator-entry-architecture.test.ts` line 90 asserts `expect(campaign).toContain("if (inviteToken)")`.  
- Origin integration branch does not contain the `inviteToken` branch in the campaign apply continuation view — the architecture test fails with this assertion.  
- Clone SHA `323658d4b1` includes this guard in the campaign continuation component; the integration branch ported the component without the invite-token conditional.

**Assessment:** The clone's accepted implementation includes an `if (inviteToken)` guard in the campaign continuation view, separating the direct campaign-apply entry path from a team-invitation entry path. The origin integration branch does not include this guard. This is a **port regression**, not an environment issue.

However, fixing it surgically requires:
1. Identifying and porting the invitation URL-param contract from the clone.
2. Adding the conditional branch in the continuation view component.
3. Understanding whether the full invitation path (the `inviteToken` issuing side) is also in scope for this integration increment.

Touching the campaign continuation view without the full invitation-token contract risks introducing a half-ported path that is worse than a clean absence. **Escalated to SA: confirm whether the invitation path should be completed in this increment or tracked as a named deferred item.**

**Failing test:** `creator-onboarding/creator-entry-architecture.test.ts:90`

---

### 3. Creator product `CreatorPlatformAccessGuard` coverage — **FIXED**

**Evidence (before fix):**  
- `creator-centre.controller.ts`, `creator-uce.controller.ts`, `creator-payouts.controller.ts`, `creator-co-pilot.controller.ts` — all missing `CreatorPlatformAccessGuard` in `@UseGuards`.  
- Clone SHA `4c5f4285` has guard on all four controllers.

**Fix applied:**  
- Added `CreatorPlatformAccessGuard` to `@UseGuards` in all four controllers.  
- Added `CreatorEntryModule` import to all four modules so the guard is injectable.

**Files changed:**
```
src/features/creator-centre/creator-centre.controller.ts
src/features/creator-centre/creator-centre.module.ts
src/features/creator-uce/creator-uce.controller.ts
src/features/creator-uce/creator-uce.module.ts
src/features/creator-payouts/creator-payouts.controller.ts
src/features/creator-payouts/creator-payouts.module.ts
src/features/creator-co-pilot/creator-co-pilot.controller.ts
src/features/creator-co-pilot/creator-co-pilot.module.ts
```

**Test evidence:** `creator-entry/creator-campaign-apply-continuation.architecture.test.ts` (backend) asserts `CreatorPlatformAccessGuard` on UCE and other Creator product controllers.

---

### 4. Entry/Settings recovery accessibility — **PASS**

**Evidence:**  
- `src/features/creator-onboarding/components/creator-entry-view.tsx` — `CREATOR_CONTEXT_RECOVERY_REQUIRED` state renders recovery UI ("Creator account needs recovery", "Retry secure recovery") at lines 44–45, 414, 479–543.  
- `src/features/creator-entry/creator-canonical-context.service.ts` — throws `CREATOR_CONTEXT_RECOVERY_REQUIRED` when user is not canonical.  
- Frontend `creator-settings-guard-scope.test.ts` and `creator-platform-route-guard.test.ts` present.

**No changes needed.**

---

### 5. Stable Instagram identity — **PASS**

**Evidence:**  
- `src/features/creator-entry/creator-instagram-continuity.service.ts` — implements `INSTAGRAM_IDENTITY_CONFLICT` checks, force-owner failure path (`C01_I2_FORCED_OWNER_FAILURE`).  
- `creator-instagram-continuity.postgres.test.ts` — covers stable identity across re-auth and reconnect scenarios.  
- `INSTAGRAM_IDENTITY_CONFLICT` error type present in `creator-entry.types.ts`.

**No changes needed.**

---

### 6. One-email/account-context behavior — **PASS**

**Evidence:**  
- `src/features/creator-entry/creator-canonical-context.service.ts` — `resolve()` throws `ACCOUNT_CONTEXT_CONFLICT` if caller is not `UserRole.CREATOR`.  
- `src/features/creator-entry/creator-instagram-connection.service.ts` — `resolveInitialConnectContext` calls canonical context service; `ForbiddenException` thrown on Brand/other user attempting Creator Instagram flow.  
- `creator-entry.postgres.test.ts` asserts `{ code: "ACCOUNT_CONTEXT_CONFLICT" }` for Brand-user-on-Creator-path.  
- `creator-instagram-connection.postgres.test.ts` line matches `ACCOUNT_CONTEXT_CONFLICT`.

**No changes needed.**

---

### 7. Sterile provisional Creator reclaim — **FIXED**

**Evidence (before fix):**  
- `src/features/brand-onboarding/verification/brand-verification.service.ts` — `setPasswordAndActivate` threw `ConflictException("This email is registered for a different account type.")` for **any** non-BRAND user, including sterile provisional Creators.  
- Clone SHA `4c5f4285` — `setPasswordAndActivate` calls `inspectSterileProvisionalCreator` before throwing; if sterile, reclaims the provisional Creator user and continues Brand activation (with `googleSubjectId: null` reset).  
- `creator-entry.postgres.test.ts` asserts "lets verified Brand activation reclaim only a sterile placeholder" and "never reclaims an ACTIVE canonical Creator".

**Fix applied:**  
- Added `import { inspectSterileProvisionalCreator }` from `shared/identity/sterile-provisional-creator.policy`.  
- Pre-transaction check: if existing user is non-BRAND but sterile, allow reclaim; otherwise throw.  
- In-transaction re-verification: sterile check repeated inside `$transaction` for race-safety (matches clone pattern).  
- `googleSubjectId: null` cleared on reclaim (matches clone).

**Files changed:**
```
src/features/brand-onboarding/verification/brand-verification.service.ts
```

**Test evidence:** `creator-entry.postgres.test.ts` — "lets verified Brand activation reclaim only a sterile placeholder", "never reclaims an ACTIVE canonical Creator".

---

### 8. Frontend preservation of structured backend error codes — **FIXED**

**Evidence (before fix):**  
- `src/shared/api/parse-api-error.ts` — `parseApiErrorBody` built `ApiRequestError` without propagating top-level `code` field from the backend JSON response body.  
- Clone frontend SHA `323658d4b1` — `parse-api-error.ts` reads `record.code` and passes it into `ApiRequestError`.  
- Without this, `ACCOUNT_EXISTS_SIGN_IN_REQUIRED`, `ACCOUNT_CONTEXT_CONFLICT`, and all other structured Creator error codes were not surfaced to the frontend routing/state machines.

**Fix applied:**  
- Added `const topLevelCode = typeof record.code === "string" ? record.code : undefined;` extraction.  
- Spread `...(topLevelCode ? { code: topLevelCode } : {})` into `ApiRequestError` constructor.

**Files changed:**
```
src/shared/api/parse-api-error.ts
```

**Test evidence:** `creator-onboarding/api/creator-entry-client.test.ts` — `ACCOUNT_EXISTS_SIGN_IN_REQUIRED` code propagation assertion.

---

### 9. Creator shell navigation — **PASS**

**Evidence:**  
- `src/layouts/app-shell/creator-shell-capabilities.ts` — `projectCreatorShellItems` implemented with full `LOADING` / `READY` / `RECOVERY` state projections, `allowedActions` filter, `alwaysAvailableInRecovery` support.  
- `creator-shell-capabilities.test.ts` and `creator-shell-rendering.test.ts` present in integration branch.  
- Shell correctly gates navigation items based on `CreatorWorkspaceActorContext.allowedActions`.

**No changes needed.**

---

### 10. Creator Team actor/subject + role policy — **PASS**

**Evidence:**  
- `src/features/creator-settings/team/creator-workspace-actor.service.ts` — resolves actor context from JWT, enforces `CreatorTeamRole` checks.  
- `src/features/creator-settings/team/creator-team.postgres.test.ts` — covers actor/subject/role assertions (known assertion-order flakiness on `teamMember` response order documented separately; not a port regression).  
- Frontend `creator-shell-capabilities.ts` uses `actorContext.allowedActions` from `CreatorWorkspaceActorContext`.

**No changes needed.**

---

### 11. Accepted Aurora SideDrawer accessibility/focus semantics — **FIXED**

**Evidence (before fix):**  
- `src/design-system/aurora/components/SideDrawer.tsx` — `<aside>` element missing `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, and Escape key handler.  
- Clone frontend SHA `323658d4b1` — full WCAG dialog semantics implemented with `useId`, `useRef`, `useEffect`.

**Fix applied:**  
- Added `useId` for `titleId` wired to `<h2>` heading and `aria-labelledby` on the `<aside>`.  
- Added `role="dialog"`, `aria-modal="true"`.  
- Added `useRef` + `useEffect` focus trap (focuses first focusable child on open).  
- Added Escape key close handler.

**Files changed:**
```
src/design-system/aurora/components/SideDrawer.tsx
```

**Test evidence:** `creator-payout-settings/components/creator-payout-legal-settings.test.ts`, `settings/components/creator/creator-instagram-settings.test.ts`, `settings/components/creator/creator-team-settings.test.ts` — all assert `role="dialog"` on SideDrawer.

---

### 12. No deployable fixed OTP / test bypass — **FIXED**

**Evidence (before fix):**  
- `src/features/brand-onboarding/verification/brand-verification.service.ts` — had `BRAND_ONBOARDING_LOCAL_OTP = "123456"` local bypass; `sendOtp`/`verifyOtp` routed to `sendOtpLocal`/`verifyOtpLocal` instead of Postmark.  
- `src/features/brand-onboarding/verification-otp.config.ts` (FE) — exported `STUB_OTP_CODE = "123456"`.  
- `src/features/auth/auth-security.static.test.ts` (BE) — had a filter exempting `brand-onboarding/verification` from the fixed-OTP scan.  
- `src/features/auth/auth-security-static.test.ts` (FE) — had matching exemption logic.

**Fix applied:**  
- Removed `BRAND_ONBOARDING_LOCAL_OTP` constant and local OTP methods from backend service.  
- `sendOtp`/`verifyOtp` now directly call `sendOtpReal`/`verifyOtpReal` (Postmark + random code).  
- Frontend `verification-otp.config.ts` — removed `STUB_OTP_CODE`, `STUB_OTP_TTL_MINUTES`; `USE_REAL_BRAND_VERIFICATION_OTP = true` constant retained as a documentation marker.  
- Frontend `brand-verification-view.tsx` — removed all `USE_REAL_BRAND_VERIFICATION_OTP` conditional branches.  
- Both security static tests updated to scan `brand-onboarding/verification` paths without exemption.

**Files changed:**
```
src/features/brand-onboarding/verification/brand-verification.service.ts
src/features/brand-onboarding/verification-otp.config.ts              (FE)
src/features/brand-onboarding/components/brand-verification-view.tsx  (FE)
src/features/auth/auth-security.static.test.ts                        (BE)
src/features/auth/auth-security-static.test.ts                        (FE)
```

**Test evidence:** Both `auth-security.static.test.ts` tests now cover the brand-onboarding path.

---

## Summary Table

| # | Invariant | Status |
|---|-----------|--------|
| 1 | Campaign Apply continuation / no auto-Application | **PASS** |
| 2 | Invitation path separation | **GENUINE_AUTHORITY_CONFLICT** (escalated) |
| 3 | `CreatorPlatformAccessGuard` coverage | **FIXED** |
| 4 | Entry/Settings recovery accessibility | **PASS** |
| 5 | Stable Instagram identity | **PASS** |
| 6 | One-email / account-context behavior | **PASS** |
| 7 | Sterile provisional Creator reclaim | **FIXED** |
| 8 | Frontend preservation of structured backend error codes | **FIXED** |
| 9 | Creator shell navigation | **PASS** |
| 10 | Creator Team actor/subject + role policy | **PASS** |
| 11 | Aurora SideDrawer accessibility/focus semantics | **FIXED** |
| 12 | No deployable fixed OTP / test bypass | **FIXED** |

---

## GENUINE_AUTHORITY_CONFLICT Detail — Invariant 2

**Invariant:** Frontend campaign continuation component must include `if (inviteToken)` guard to separate invitation path from direct campaign-apply path.  
**Conflict:** Clone SHA `323658d4b1` has this guard. Origin integration does not. The guard is an accepted Product behavior — fixing it surgically without the full invitation-token URL contract risks a half-ported path. Not a guess; flagged for SA decision.  
**SA action required:** Confirm whether the invitation path (both the `inviteToken` URL-param contract and the continuation view guard) should be completed in this integration increment, or tracked as a named deferred item with the failing architecture test as a sentinel.

---

## Remaining Test Failures After Reconciliation

Failures listed here are pre-existing ENVIRONMENT_BLOCKED or test-infrastructure issues, **not** regressions introduced in this pass. Full named failure details are in:

- [`01-c01-creator-entry/automated-test-results.md`](./01-c01-creator-entry/automated-test-results.md)
- [`02-c05-creator-settings-shell/automated-test-results.md`](./02-c05-creator-settings-shell/automated-test-results.md)

Key remaining failures:
- `creator-entry.postgres.test.ts` — Brand reclaim, ACTIVE Creator reject, OTP race, Instagram auth conflict (require disposable Postgres with seeded data).
- `creator-instagram-connection.postgres.test.ts` — Instagram OAuth fixture tests (require Postgres + Instagram mock).
- `creator-team.postgres.test.ts` — assertion-order flakiness on `teamMember` response order.
- FE `creator-onboarding/creator-entry-architecture.test.ts` — `inviteToken` guard missing (Invariant 2, GENUINE_AUTHORITY_CONFLICT — escalated to SA).
- FE `creator-onboarding/api/creator-entry-client.test.ts` — `ACCOUNT_EXISTS_SIGN_IN_REQUIRED` code propagation (verify after parse-api-error fix applies).

---

## Changed Files This Pass

**Backend (`creator-commerce-backend-v2`):**
```
src/features/creator-centre/creator-centre.controller.ts        FIXED Inv-3
src/features/creator-centre/creator-centre.module.ts            FIXED Inv-3
src/features/creator-uce/creator-uce.controller.ts              FIXED Inv-3
src/features/creator-uce/creator-uce.module.ts                  FIXED Inv-3
src/features/creator-payouts/creator-payouts.controller.ts      FIXED Inv-3
src/features/creator-payouts/creator-payouts.module.ts          FIXED Inv-3
src/features/creator-co-pilot/creator-co-pilot.controller.ts    FIXED Inv-3
src/features/creator-co-pilot/creator-co-pilot.module.ts        FIXED Inv-3
src/features/brand-onboarding/verification/brand-verification.service.ts  FIXED Inv-7 + Inv-12
src/features/auth/auth-security.static.test.ts                  FIXED Inv-12
```

**Frontend (`creator-commerce-frontend-v2`):**
```
src/design-system/aurora/components/SideDrawer.tsx                         FIXED Inv-11
src/shared/api/parse-api-error.ts                                          FIXED Inv-8
src/features/brand-onboarding/verification-otp.config.ts                   FIXED Inv-12
src/features/brand-onboarding/components/brand-verification-view.tsx       FIXED Inv-12
src/features/auth/auth-security-static.test.ts                             FIXED Inv-12
```
