# C-01 automated test results (origin)

Clone closeout cited 1,103 backend / 744 frontend. Those numbers are **not**
copied here.

Source of truth for pastes: `../origin-run-log.md` and `docs/handoff-audit/.logs/`.

| Check | Status | Origin result |
|-------|--------|---------------|
| Prisma validate | VERIFIED | schema valid |
| Prisma generate | VERIFIED | client v6.19.3 |
| Local migrate deploy | VERIFIED | 82 on named disposable DBs |
| Backend scoped C-01 vitest | FAILED | 7 failed / 167 passed (15 files); 0 skipped |
| Frontend scoped C-01 vitest | FAILED | Combined FE C-01/C-05 run: 8 failed / 98 passed (21 files). Drawer tests expect `role=dialog`; Aurora SideDrawer is `aside`. |
| Frontend redirect allowlist | VERIFIED | 59 passed (`safe-internal-path` + post-login + RequireAuth) |
| Backend build | VERIFIED | nest build + copy-prompt-assets ok |
| Frontend typecheck | VERIFIED | `npx tsc -b` clean (user 2026-09-03) |
| Frontend build | VERIFIED | `tsc -b && vite build` (user 2026-09-03) |
| Frontend lint | VERIFIED | `npm run lint` 0 errors / 0 warnings (user 2026-09-03) |
| Backend lint | VERIFIED | prettier-off: no code errors. `npm run lint` still 1042 prettier-only |
| Full backend suite | FAILED | Default 19/1206/610. With C01 URLs: 24/1321/490 (user 2026-09-03). C-01 postgres un-skipped; DE `winner` + pricing P2 unchanged. See `../origin-run-log.md` |
| Full frontend suite | FAILED | 8 failed / 88 passed files; 13 / 728 tests. Aurora `aside` vs `dialog`; do not greenwash |
| Local UI smoke | PARTIAL | Operator 2026-09-03: C01-1…6,8,9 + logout PASS; Postmark OTP mail PASS; C01-7 SKIPPED (UCE); C01-IG BLOCKED (deployed callback only). See `../ui-verification.md` |
| Live Meta OAuth | BLOCKED | not authorized |
| AWS / prod migrate | BLOCKED | not authorized |

Origin-wide (Brand Centre / DE / pricing / notifications) names stay in
`../origin-run-log.md`. This file lists **C-01 module/suite fails only**.

## Named failures — C-01 backend scoped vitest

7 failed / 167 passed (15 files). 0 skipped.

| File | Case | Class |
|------|------|--------|
| `c01-persistence/c01-persistence-security.postgres.test.ts` | `distinguishes available, expired and consumed records` — unique `token_digest` on `"A".repeat(43)` | Dirty `c01_i1_local` leftover digest. Not product |
| `creator-entry/creator-campaign-apply-continuation.architecture.test.ts` | `preserves the separately guarded explicit Apply command and direct entry action` — UCE must use `CreatorPlatformAccessGuard` | Parked. Do not wire |
| `creator-entry/creator-instagram-connection.architecture.test.ts` | `guards normal Creator product surfaces without guarding recovery or Settings` — Centre / Co-Pilot / Payouts / marketplace / UCE | Parked. Do not wire |
| `creator-entry/creator-entry.postgres.test.ts` | `lets verified Brand activation reclaim only a sterile placeholder` | Origin keeps Brand email as Brand. Clone expected reclaim. Parked |
| `creator-entry/creator-entry.postgres.test.ts` | `never reclaims an ACTIVE canonical Creator` — expected substring `another account type` | Origin copy `different account type`. Reject is correct. Leave |
| `creator-entry/creator-entry.postgres.test.ts` | `leaves no live Creator OTP when Brand activation races a resend` | Expected all fulfilled; one rejected. Leave |
| `creator-entry/creator-instagram-connection.postgres.test.ts` | `requires canonical Creator context and issues only a server-bound digest state` — Brand `authorize` expected `ACCOUNT_CONTEXT_CONFLICT` | Origin `Creator access required`. Parked |

## Named failures — C-01 frontend (this packet)

From the combined FE C-01/C-05 scoped run and full `npm test`. C-05 drawer
fails are listed in `../02-c05-creator-settings-shell/automated-test-results.md`.

| File | Case | Class |
|------|------|--------|
| `creator-onboarding/creator-entry-architecture.test.ts` | `keeps generic and invitation Campaign entry paths distinct and never auto-opens Apply` — source must contain `if (inviteToken)` | Clone string vs origin `CampaignDetailWorkspace`. Leave |
| `creator-onboarding/api/creator-entry-client.test.ts` | `preserves top-level backend error codes for bounded UI handling` — `ACCOUNT_EXISTS_SIGN_IN_REQUIRED` | Client wraps as `ApiRequestError` without `code`. Leave or later map |
| `creator-onboarding/creator-settings-guard-scope.test.ts` | suite load | **Stale scoped log**: missing `safe-internal-path`. Typecheck later VERIFIED; do not treat as current FAIL |

## Named failures — full backend suite (C-01 rows only)

Same architecture parked cases as scoped. With C01 URLs the five postgres
rows above reappear (Batch 1). Auth static `123456` is Brand Step 6 from this
port — restore before prod; it is not a Creator Entry product fail.

## Backend failure classification

Parked (do not fix this cycle):

- I5 UCE + I3 Centre architecture: `CreatorPlatformAccessGuard` not wired on Centre / Co-Pilot / Payouts / UCE
- I2 sterile-Creator Brand reclaim (origin keeps `different account type`)
- I3 Brand Instagram authorize: `Creator access required` vs clone `ACCOUNT_CONTEXT_CONFLICT`

Not product / leave:

- I1 continuation unique `token_digest` on hardcoded `"A".repeat(43)` (dirty `c01_i1_local`)
- I2 ACTIVE Creator reject: origin copy vs clone substring `another account type`
- I2 Brand vs Creator OTP race: not all-fulfilled
