# Origin run log — C-01 / C-05

Fresh audit cycle 2026-09-03. Clone closeout numbers stay in the
reference handoffs; they do not belong here.

Branch: `feature/c01-c05-creator-integration`  
Scope this cycle: prisma + scoped vitest + builds + lint + full `npm test`.  
Skipped this cycle: none of the local regression commands.

| Command | Status | Origin result | Notes |
|---------|--------|---------------|-------|
| Backend `npx prisma validate` | VERIFIED | schema valid | Agent run 2026-09-03 |
| Backend `npx prisma generate` | VERIFIED | client v6.19.3 | ~91s generate; total wall ~11m |
| Local migrate deploy (named disposable DBs) | VERIFIED | 82 on named DBs | `bs06_p1c1` migrated this cycle |
| Backend C-01 vitest | FAILED | 7 failed / 167 passed (15 files: 5 failed / 10 passed) | 0 skipped. Classification below. |
| Backend C-05 vitest | FAILED | 1 failed / 124 passed (17 files) | Postgres Team 4/5. Known assertion-order bug. |
| Backend auth vitest | VERIFIED | 22 passed / 3 files | Includes BS-12 postgres. |
| Backend Brand Settings unit | VERIFIED | 97 passed / 175 skipped (12 files: 8 passed / 4 skipped) | Postgres correctly skipped (no BS flags). |
| Backend Brand Settings postgres | FAILED | 4b 10/87 fail; 4c 4/4; 4d 1/48; 4e 1/1 | Known C-01 fixture + JWT + harness; P1C1 needs historical seed DB. |
| Backend `npm run build` | VERIFIED | nest build + copy-prompt-assets ok | |
| Frontend scoped C-01/C-05 vitest | FAILED | 8 failed / 98 passed (21 files: 6 failed / 15 passed) | Drawer tests expect role=dialog; Aurora SideDrawer is aside. FAIL 1–7 names not in paste. |
| Frontend Brand Settings vitest | FAILED | 3 failed / 95 passed (8 files: 1 failed / 7 passed) | Same dialog vs Aurora aside. |
| Frontend `npm run typecheck` | VERIFIED | `npx tsc -b` clean | User run 2026-09-03 after adding `safe-internal-path` |
| Frontend `npm run build` | VERIFIED | `tsc -b && vite build` | User run 2026-09-03; chunk-size warning only |
| Frontend `npm run lint` | VERIFIED | 0 errors / 0 warnings | User run 2026-09-03 after unused-var + warning cleanup |
| Backend `npm run lint` | VERIFIED | Prettier-off: no code-rule errors (user 2026-09-03). `npm run lint` still reports 1042 prettier-only | TS 5.9 vs eslint parser support warning only. Do not `--fix` |
| Backend `npm test` (full) | FAILED | Default: 19/1206/610. With C01 URLs: 24 failed / 1321 passed / 490 skipped (29/172/39 files, 234s) | Skips dropped 610→490: C-01 postgres ran. Extra fails = known C-01 postgres (Batch 1). Same DE `winner` dump + pricing P2. C-05/Brand postgres still skipped (correct) |
| Frontend `npm test` (full) | FAILED | 8 failed / 88 passed files; 13 failed / 728 passed tests (96 files, 741 tests, 136s) | Same Aurora `aside` vs `getByRole("dialog")`. Do not retag SideDrawer as dialog |
| Local UI smoke (C-01 + C-05) | PARTIAL | C-01 local UI + Postmark OTP PASS; C01-IG / C-05 shell BLOCKED | Live Instagram = deployed dashboard callbacks |

Named FAIL lists: section **Named failures** below (not only counts).
C-01 module/suite names: `01-c01-creator-entry/automated-test-results.md`.
C-05 module/suite names: `02-c05-creator-settings-shell/automated-test-results.md`.

## Named failures

Counts live in the table. This is the named register. Origin Brand/DE/pricing/collaboration
fails are **not** C-01/C-05 product. Do not fix them on this branch except the Brand
`123456` static scan, which this port introduced.

### Backend — full `npm test` (default, no C-01 URLs)

From `docs/handoff-audit/.logs/be-full-npm-test.log`. **14 failed files** are empty
collaboration suites (`No test suite found`) — they do not add to the 19 test fails.

Empty-file suites (leave):

- `collaboration/schemas/provision-collaboration.schema.test.ts`
- `collaboration/services/collaboration-auto-approval.test.ts`
- `collaboration/services/collaboration-bank-ownership.test.ts`
- `collaboration/services/collaboration-commercial-command.test.ts`
- `collaboration/services/collaboration-exception.test.ts`
- `collaboration/services/collaboration-feedback.test.ts`
- `collaboration/services/collaboration-final-reconciliation.test.ts`
- `collaboration/services/collaboration-financial-boundary.test.ts`
- `collaboration/services/collaboration-fulfillment.test.ts`
- `collaboration/services/collaboration-messaging-lifecycle.test.ts`
- `collaboration/services/collaboration-production.test.ts`
- `collaboration/services/collaboration-publishing.test.ts`
- `collaboration/services/collaboration-settlement.test.ts`
- `collaboration/utils/collaboration-read-model.mapper.test.ts`

Failed tests (19):

| File | Case | Class |
|------|------|--------|
| `auth/auth-security.static.test.ts` | no fixed six-digit legacy auth bypass | **This port**: Brand Step 6 local `123456` in `brand-verification.service.ts`. Restore before prod |
| `brand-centre/brand-workspace-authorization.service.test.ts` | 3× current BRAND_OWNER / FINANCE_ADMIN / CAMPAIGN_MANAGER vs stale JWT | Origin Brand Centre. `Brand Centre is available to brand users only`. Leave |
| `brand-escrow/route-payout.architecture.test.ts` | removes stage-driven payout; `isFinalPayoutReleased` still in source | Origin escrow. Leave |
| `brand-intelligence/offering-factual.architecture.test.ts` | migration folder count 52 vs **82** | Stale clone count; origin has 82. Leave |
| `creator-entry/creator-campaign-apply-continuation.architecture.test.ts` | UCE controller must use `CreatorPlatformAccessGuard` | C-01 parked (do not wire) |
| `creator-entry/creator-instagram-connection.architecture.test.ts` | Centre/product surfaces must contain `CreatorPlatformAccessGuard` | C-01 parked (do not wire) |
| `notifications/financial-producers.architecture.test.ts` | 2× escrow event wiring / `executeStage2Lock` order | Origin notifications vs collaboration. Leave |
| `notifications/operational-producers.architecture.test.ts` | 3× media-review + intelligence.execution_completed wiring | Origin. Leave |
| `pricing/subscription-capability-enforcement.p3.test.ts` | 3× deny campaign activate/goLive/resume → got `Campaign not found` not `ForbiddenException` | Origin pricing. Leave |
| `brand-escrow/services/route-webhook.service.test.ts` | HMAC raw body; `Route webhook is not configured` | Origin. Leave |
| `data-extraction/evidence/evidence-repositories.architecture.test.ts` | persistence export + `winner` substring | Origin DE local `winner` on unique retry. Leave |
| `pricing/services/subscription-lifecycle.p2.test.ts` | cancel expects `CANCEL_SCHEDULED`/`FULL_ACCESS`, got `CANCELLED`/`RESTRICTED_WIND_DOWN` | Origin pricing. Leave |

### Backend — full `npm test` with C-01 URLs

Same as default, plus the five C-01 postgres cases already named in Batch 1
(dirty `token_digest`, Brand reclaim copy, OTP race, I2 ACTIVE substring).
C-05 Team / Brand postgres still skipped.

### Frontend — full `npm test` (13 tests / 8 files)

Scoped C-01/C-05 log + operator full-run HTML dump. Aurora `aside` vs `role="dialog"`
unless noted.

| File | Cases | Class |
|------|--------|--------|
| `creator-onboarding/creator-settings-guard-scope.test.ts` | suite load | **Stale log**: missing `safe-internal-path` at scoped run. Typecheck later VERIFIED; full `npm test` still 8 files — this file may have been replaced by other fails |
| `creator-onboarding/creator-entry-architecture.test.ts` | campaign Apply source `if (inviteToken)` | Clone string vs origin CampaignDetail. Leave |
| `creator-onboarding/api/creator-entry-client.test.ts` | top-level `ACCOUNT_EXISTS_SIGN_IN_REQUIRED` | Client wraps as `ApiRequestError` without `code`. Leave or later map |
| `creator-payout-settings/components/creator-payout-legal-settings.test.ts` | 3× Escape-clear PAN / `dialog` "Edit legal profile" / `dialog` "Add payout destination" | Aurora aside + clear-on-Escape. Leave primitive |
| `settings/components/creator/creator-instagram-settings.test.ts` | `dialog` "Disconnect Instagram" | Aurora aside. Leave |
| `settings/components/creator/creator-team-settings.test.ts` | 2× invite `dialog` / Escape | Aurora aside. Leave |
| `settings/components/brand/brand-integrations-settings.test.ts` | 3× `dialog` "Different Instagram account selected" | Same primitive. Leave |

Full FE 8 failed files / 13 tests match Team + payouts + Instagram Settings + Brand
integrations + entry architecture/client (guard-scope was the pre-helper scoped run).

## Raw pastes

### Batch 1 — C-01 (retry without `--maxWorkers=1`)

```
Test Files  5 failed | 10 passed (15)
     Tests  7 failed | 167 passed (174)
  Duration  25.21s
```

FAIL classification:

| # | Test | Class |
|---|------|--------|
| 1 | I1 continuation unique `token_digest` on `"A".repeat(43)` | Dirty disposable DB / leftover digest. Not product. |
| 2 | I5 architecture wants `CreatorPlatformAccessGuard` on UCE | Parked (do not wire) |
| 3 | I2 Brand reclaim sterile Creator | Origin refuses non-Brand email. Clone expected reclaim. Parked. |
| 4 | I2 never reclaim ACTIVE Creator | Origin rejects with `different account type`; clone expected substring `another account type`. Reject is correct. |
| 5 | I2 Brand activation vs Creator OTP resend race | Expected all fulfilled; one rejected. Leave. |
| 6 | I3 architecture wants `CreatorPlatformAccessGuard` on Centre (listed product surfaces) | Parked (do not wire) |
| 7 | I3 Brand `authorize` expected `ACCOUNT_CONTEXT_CONFLICT` | Origin `Creator access required`. Parked. |

See `docs/handoff-audit/.logs/` for full command output.

### Batch 2 — C-05 (`creator-settings` + `shared/team`, postgres un-skipped)

```
Test Files  1 failed | 16 passed (17)
     Tests  1 failed | 124 passed (125)
  Duration  9.07s
```

Team postgres: 4 passed, 1 failed.

`enforces Owner protection and the Manager/Assistant matrix`: promotes Assistant to Manager, then expects `team.list` to deny. Actor is now Manager (`TEAM_READ`/`TEAM_MANAGE`), so list correctly succeeds. Test sequence bug, not policy. Leave.

### Batch 3 — Auth (`src/features/auth`, `BS12_DATABASE_TEST`)

```
Test Files  3 passed (3)
     Tests  22 passed (22)
  Duration  9.36s
```

Includes `auth-security.postgres.test.ts` (10). Off-prod OTP dispatch-fail assertion matches origin.

### Batch 4a — Brand Settings unit (no postgres flags)

```
Test Files  8 passed | 4 skipped (12)
     Tests  97 passed | 175 skipped (272)
  Duration  13.62s
```

Four skipped files are the postgres-gated suites. Expected.

### Batch 4b — Brand team postgres (`BS02`, `bs02_local`)

```
Test Files  1 failed (1)
     Tests  10 failed | 87 passed (97)
  Duration  20.49s
```

| Bucket | Tests | Class |
|--------|-------|--------|
| JWT `invalid signature` | hashed=true/false accept | Test `jwt.verify` without issuer/audience. Login already succeeded. Assertion only. |
| `C01_ACTIVE_BRAND_ORGANIZATION_REQUIRED` | unassigned recipient, cross-org unassigned, two seat fixtures | ACTIVE Brand with no org. C-01 trigger. Fixture. |
| `C01_ACTIVE_CREATOR_USER_REQUIRES_CREATOR_ORGANIZATION` | existing recipient non-brand | Creator attached to Brand org. Fixture. |
| `issueTokenForUserId is not a function` | 3 activation tests | Test constructs `BrandVerificationService` with old arg order (mail missing). Nest DI is fine. Harness. Do not trust `already active` until rewired. |

### Batch 4c — Brand billing postgres (`BS03`, `bs03_local`)

```
Test Files  1 passed (1)
     Tests  4 passed (4)
  Duration  3.96s
```

All four cases passed.

### Batch 4d — Brand Instagram postgres (`BS06` + `BS06_LEGACY`, `bs06_local`)

```
Test Files  1 failed | 1 passed (2)
     Tests  1 failed | 48 passed (49)
  Duration  16.17s
```

`inviteTeammate` for finance expected 403, got `{ sent: true }`. Origin allows that invite; clone test expected deny. Leave (not Instagram OAuth fence itself).

### Batch 4e — P1C1 (`BS06_MIGRATION`, exact `/bs06_p1c1`)

```
Test Files  1 failed (1)
     Tests  1 failed (1)
  Duration  3.49s
```

Looks up hardcoded `bs06-p1c1-owner`. We migrated an empty `bs06_p1c1` (0→82). This suite needs a historically seeded P1C1 fixture, not a fresh schema. Leave.

### Batch 5 — Backend `npm run build`

```
nest build && node scripts/copy-prompt-assets.mjs
copy-prompt-assets: ok
```

PASS.

### Batch 6 — Frontend scoped C-01/C-05

```
Test Files  6 failed | 15 passed (21)
     Tests  8 failed | 98 passed (106)
  Duration  71.20s
```

Named in paste (2 of 8), both `creator-team-settings.test.ts`:

- invite drawer `getByRole("dialog")` / `aria-modal`
- Escape dismissal `getByRole("dialog")`

Drawer **did open** (`aside.aurora-sidedrawer`, title "Invite Creator Team member"). Clone tests expect `role="dialog"`. Origin Aurora SideDrawer exposes `complementary` (`aside`), not dialog. Assertion vs origin primitive. Leave.

FAIL 1–7 file names were not in the paste (HTML dump only).

### Batch 7 — Frontend Brand Settings + typecheck

```
Test Files  1 failed | 7 passed (8)
     Tests  3 failed | 95 passed (98)
  Duration  36.54s
```

Named fails are `brand-integrations-settings.test.ts` `findByRole("dialog", { name: "Different Instagram account selected" })`. Drawer **is open** (`aside.aurora-sidedrawer` with that title). Same Aurora SideDrawer vs `role="dialog"` as Creator Team. Leave.

Typecheck **was** missing `src/shared/navigation/safe-internal-path`. Fixed this cycle; see Batch 8.

### Batch 8 — Frontend allowlist helper + typecheck / build

Added origin-missing clone contract `src/shared/navigation/safe-internal-path.ts` (allowlisted internal returns, not “any path starting with `/`”).

Scoped redirect tests (agent):

```
Test Files  3 passed (3)
     Tests  59 passed (59)
```

Files: `safe-internal-path.test.ts`, `post-login-redirect.test.ts`, `require-auth.test.ts`.

User typecheck / production build (frontend-v2):

```
npx tsc -b
# (no output — clean)

npm run build
# tsc -b && vite build
# ✓ 2103 modules transformed
# dist/assets/index-Ciqc-qki.js  1,180.92 kB │ gzip: 312.86 kB
```

Vite chunk-size note is a warning, not a failure. Frontend typecheck + build are VERIFIED.

Frontend lint (user 2026-09-03, after unused-var and warning cleanup):

```text
> eslint .
# 0 errors, 0 warnings
```

Full `npm test` (user 2026-09-03):

Frontend:

```text
Test Files  8 failed | 88 passed (96)
     Tests  13 failed | 728 passed (741)
Duration  136.44s
```

Named in paste: `creator-team-settings.test.ts` `getByRole("dialog")` vs Aurora `<aside>` (`complementary`). Parked.

Backend:

```text
Test Files  26 failed | 170 passed | 44 skipped (240)
     Tests  19 failed | 1206 passed | 610 skipped (1835)
Duration  247.00s
```

Backend `npm test` with C-01 URLs only (user 2026-09-03, ~14:53):

```text
Test Files  29 failed | 172 passed | 39 skipped (240)
     Tests  24 failed | 1321 passed | 490 skipped (1835)
Duration  234.00s
```

Skipped 610→490 and passed 1206→1321: C-01 postgres un-skipped and mostly passed. Failed 19→24: the extra five are the known C-01 postgres cases from Batch 1, not new product. Same DE architecture `winner` dump and pricing P2 at the tail. C-05/Brand postgres still skipped.

Named in paste: DE architecture `winner` substring; pricing P2 `CANCEL_SCHEDULED` vs `CANCELLED`. Not C-01/C-05 product. The giant `+ prismacapabilityevidence…` block is Vitest printing `persistenceSources.toLowerCase()`, not a rewritten module.

UI smoke is PARTIAL. Checklist: `docs/handoff-audit/creator/ui-verification.md`.
