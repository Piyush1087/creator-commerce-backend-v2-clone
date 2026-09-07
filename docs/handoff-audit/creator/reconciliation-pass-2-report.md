# C-01 / C-05 Developer Integration Reconciliation Report — Pass 2

**Date:** 2026-09-04  
**Agent:** C-01/C-05 bounded correction (SA final mail)  
**Integration branch:** `feature/c01-c05-creator-integration`  
**Prior pass:** [`reconciliation-report.md`](./reconciliation-report.md) / [`reconciliation-test-results.md`](./reconciliation-test-results.md) (2026-09-03)  
**Test evidence:** [`reconciliation-pass-2-test-results.md`](./reconciliation-pass-2-test-results.md)  
**Commands:** [`commands-to-run.md`](./commands-to-run.md)  
**Reusable process:** [`../MODULE-AUDIT-TESTING-PLAYBOOK.md`](../MODULE-AUDIT-TESTING-PLAYBOOK.md)

This file is **new**. It does **not** rewrite pass-1 docs.

**Accepted clone SHAs (comparison authority):**

| Slice | Backend | Frontend |
|---|---|---|
| C-05 (includes C-01) runtime | `4c5f42858b950b7cd342f8972f99f548f3daa942` | `323658d4b147b95b5629ff8d91fa90b8fe9077e4` |

**Final integration SHAs (pass 2):**

| Repo | SHA |
|---|---|
| Backend | `54825343c0ba07a41fb0219dffea321445fec8fa` |
| Frontend | `11cb12b635806983d2f2b2d8ca4b8b3b61da1f43` |

Status vocabulary (required for every invariant):  
`PASS` / `FIXED` / `GENUINE_AUTHORITY_CONFLICT` / `ENVIRONMENT_BLOCKED`

---

## Authority Order Applied

1. SA final bounded correction mail (Campaign Apply invite split + sterile reclaim; no Gatekeeper/pricing/DE/Collaboration)  
2. Accepted C-01/C-05 Product + architecture contracts  
3. Accepted runtime SHAs above  
4. Destination/origin implementation  
5. Tests as evidence (scoped C-01/C-05, **no env-skip** on postgres suites)

---

## Mail scope (what this pass changed)

1. **FE** — restore `inviteToken` vs continuation split in `CampaignDetailWorkspace.tsx`  
2. **BE** — complete sterile Brand reclaim transaction in `brand-verification.service.ts`  
3. **Harness only** — `creator-entry.postgres.test.ts` BrandVerificationService constructor order for origin DI  

**Explicitly not touched:** Gatekeeper fixture, pricing, DE, Collaboration, Brand authorize code-string, C-05 Team matrix assertion-order.

---

## Invariant-by-Invariant Results

### 1. Campaign Apply continuation and no auto-Application — **FIXED**

**Evidence:**  
- FE `CampaignDetailWorkspace.tsx` — guest Apply without invite calls `issueCampaignApplyContinuation` then `navigate("/creator/onboarding")`; no auto-open Apply wizard.  
- FE architecture: `creator-entry-architecture.test.ts` — `issueCampaignApplyContinuation`, `navigate("/creator/onboarding")`, no `autoApply` — **PASS** in scoped FE 163/163.  
- BE I5 / I1 continuation persistence green after disposable DB truncate (see test-results).

**Files changed this pass:**  
`src/features/creator-campaigns/components/CampaignDetailWorkspace.tsx` (FE)

---

### 2. Invitation path separation — **FIXED**

**Was:** `GENUINE_AUTHORITY_CONFLICT` in pass 1 (missing `if (inviteToken)`).  
**SA decision:** do not escalate; restore accepted FE split.

**Evidence:**  
- With `inviteToken`: preserve invite return path → Login.  
- Without: continuation issue → `/creator/onboarding`.  
- Architecture assertion `expect(campaign).toContain("if (inviteToken)")` — **PASS**.

**Files changed this pass:** same FE file as Inv-1.

---

### 3. Creator product `CreatorPlatformAccessGuard` coverage — **FIXED**

**Evidence:** Pass-1 fix retained. FE `creator-settings-guard-scope.test.ts` / platform guard tests **PASS** in scoped FE. No code change this pass.

---

### 4. Entry/Settings recovery accessibility — **PASS**

**Evidence:** FE entry-view + settings-guard in scoped run; UI R1/R3 prior (2026-09-03). No code change this pass.

---

### 5. Stable Instagram identity — **PASS**

**Evidence:** C-01 continuity path green in scoped BE postgres run. No code change this pass.

---

### 6. One-email / account-context behavior — **PASS**

**Evidence:** Brand on Creator Instagram path is denied.  
**Named parked fail (out of mail):** `creator-instagram-connection.postgres.test.ts` expects `ACCOUNT_CONTEXT_CONFLICT`, receives `Creator access required`. Deny is correct; code-string mismatch left. **Not** `GENUINE_AUTHORITY_CONFLICT`.

---

### 7. Sterile provisional Creator reclaim — **FIXED**

**Evidence (before this pass):** pass-1 partial reclaim + harness mock failures.  
**Fix this pass:** Brand `setPasswordAndActivate` aligned to accepted clone transaction (`lockAdmissionEmail`, sterile inspect, OTP supersession, org ownership, `role: BRAND`, `googleSubjectId: null`). Harness constructor `(db, mail, scan, auth, googleAuth)`.

**Test evidence (C-01 I2 postgres, 0 skip):**  
- lets verified Brand activation reclaim only a sterile placeholder — **PASS**  
- never reclaims ACTIVE canonical Creator — **PASS**  
- Brand activation vs Creator OTP race — **PASS**

**Files changed:**  
`brand-verification.service.ts`, `creator-entry.postgres.test.ts` (harness only)

---

### 8. Frontend preservation of structured backend error codes — **FIXED**

**Evidence:** Pass-1 `parse-api-error` fix retained; `parse-api-error.test.ts` in scoped FE **PASS**. No code change this pass.

---

### 9. Creator shell navigation — **PASS**

**Evidence:** Creator shell + mobile-nav tests in scoped FE **PASS**; UI R3 prior.

---

### 10. Creator Team actor/subject + role policy — **PASS**

**Evidence:** C-05 scoped **124 passed / 1 failed**.  
**Named parked fail:** `creator-team.postgres.test.ts:331` — after promote to Manager, test expects `team.list` reject; Manager has `TEAM_READ` so list succeeds (assertion-order bug). Out of mail. Leave.

---

### 11. Accepted Aurora SideDrawer accessibility/focus semantics — **FIXED**

**Evidence:** Pass-1 SideDrawer fix retained; Creator team/settings drawer tests **PASS** in scoped FE.

---

### 12. No deployable fixed OTP / test bypass — **FIXED**

**Evidence:** BE `auth-security.static.test.ts` **4/4 PASS**; FE brand-onboarding in scoped run **PASS**.

---

## Summary Table

| # | Invariant | Status |
|---|-----------|--------|
| 1 | Campaign Apply continuation / no auto-Application | **FIXED** |
| 2 | Invitation path separation | **FIXED** |
| 3 | `CreatorPlatformAccessGuard` coverage | **FIXED** |
| 4 | Entry/Settings recovery accessibility | **PASS** |
| 5 | Stable Instagram identity | **PASS** |
| 6 | One-email / account-context behavior | **PASS** |
| 7 | Sterile provisional Creator reclaim | **FIXED** |
| 8 | Frontend structured error codes | **FIXED** |
| 9 | Creator shell navigation | **PASS** |
| 10 | Creator Team actor/subject + role policy | **PASS** |
| 11 | Aurora SideDrawer accessibility/focus | **FIXED** |
| 12 | No deployable fixed OTP / test bypass | **FIXED** |

**`GENUINE_AUTHORITY_CONFLICT` this pass:** none.  
**Transient `ENVIRONMENT_BLOCKED`:** I1 `token_digest` unique on dirty `c01_i1_recon` — truncated → **22/22 PASS**.

---

## Remaining Test Failures After Pass 2 (parked / out of mail)

| Suite | Named fail | Class |
|---|---|---|
| BE C-01 | Brand `authorize` code `ACCOUNT_CONTEXT_CONFLICT` vs `Creator access required` | Parked wording; deny OK |
| BE C-05 | Team matrix `team.list` after promote | Assertion-order test bug |
| Gatekeeper / pricing / DE / Collaboration | — | Explicitly out of scope |

Full counts and logs: `reconciliation-pass-2-test-results.md`.

---

## Changed Files This Pass

**Backend (`creator-commerce-backend-v2`):**
```
src/features/brand-onboarding/verification/brand-verification.service.ts   FIXED Inv-7
src/features/creator-entry/creator-entry.postgres.test.ts                  harness only
docs/handoff-audit/creator/reconciliation-pass-2-report.md
docs/handoff-audit/creator/reconciliation-pass-2-test-results.md
docs/handoff-audit/MODULE-AUDIT-TESTING-PLAYBOOK.md
docs/handoff-audit/creator/commands-to-run.md                              updated
```

**Frontend (`creator-commerce-frontend-v2`):**
```
src/features/creator-campaigns/components/CampaignDetailWorkspace.tsx      FIXED Inv-1 + Inv-2
```
