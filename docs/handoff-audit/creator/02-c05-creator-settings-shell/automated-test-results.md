# C-05 automated test results (origin)

Clone closeout cited 1,229 backend / 853 frontend. Those numbers are **not**
copied here.

Source of truth for pastes: `../origin-run-log.md` and `docs/handoff-audit/.logs/`.

| Check | Status | Origin result |
|-------|--------|---------------|
| Prisma validate | VERIFIED | schema valid (shared with C-01) |
| Backend scoped C-05 vitest | FAILED | 1 failed / 124 passed (17 files) |
| Real PostgreSQL Team cases | FAILED | 4 passed / 1 failed; assertion after promoting Assistant to Manager |
| Frontend scoped C-05 vitest | FAILED | Combined with C-01 FE: 8 failed / 98 passed (21 files). Named fails: Creator Team drawers `getByRole("dialog")` vs Aurora `aside`. |
| Brand Settings regression (BE + FE) | FAILED | FE Brand: 3 failed / 95 passed; same dialog vs aside. Leave primitive. |
| Frontend redirect allowlist | VERIFIED | shared with C-01; 59 passed |
| Backend build | VERIFIED | nest build + copy-prompt-assets ok |
| Frontend typecheck | VERIFIED | `npx tsc -b` clean (user 2026-09-03) |
| Frontend build | VERIFIED | `tsc -b && vite build` (user 2026-09-03) |
| Frontend lint | VERIFIED | `npm run lint` 0 errors / 0 warnings (user 2026-09-03) |
| Backend lint | VERIFIED | prettier-off: no code errors. `npm run lint` still 1042 prettier-only |
| Full backend suite | FAILED | Default 19/1206/610. With C01 URLs: 24/1321/490. See `../origin-run-log.md` |
| Full frontend suite | FAILED | 8 failed / 88 passed files; 13 / 728 tests. Team/Brand drawers `dialog` vs Aurora `aside` |
| Local UI smoke | PARTIAL | C05-5 Settings opens; C05-13 Brand Settings PASS. C05-1…4 shell BLOCKED (Instagram on deployed dashboard). See `../ui-verification.md` |
| Live Instagram Settings lifecycle | BLOCKED | not authorized |
| KYC / payout execution | N/A | out of C-05 |

Origin-wide (Brand Centre / DE / pricing / notifications) names stay in
`../origin-run-log.md`. This file lists **C-05 module/suite fails only**.
C-01 entry/client/architecture fails are in
`../01-c01-creator-entry/automated-test-results.md`.

## Named failures — C-05 backend scoped vitest

1 failed / 124 passed (17 files). Team postgres: 4 passed / 1 failed.

| File | Case | Class |
|------|------|--------|
| `creator-settings/team/creator-team.postgres.test.ts` | `enforces Owner protection and the Manager/Assistant matrix` | After promoting Assistant → Manager, test still calls `team.list` as that user and expects deny. Actor now has `TEAM_READ`/`TEAM_MANAGE`, so list succeeds. Assertion-order bug, not policy. Leave |

No other C-05 backend files failed in the scoped run. Full `npm test` does
not un-skip this postgres suite (needs its own `DATABASE_URL`).

## Named failures — C-05 frontend (this packet)

Aurora `SideDrawer` is `aside` / `complementary`. Tests use `getByRole("dialog")`.
Do not retag the primitive as `dialog`.

| File | Case | Class |
|------|------|--------|
| `creator-payout-settings/components/creator-payout-legal-settings.test.ts` | `clears secure values after Escape and restores focus to the trigger` | `queryByRole("dialog")` after Escape. Aurora aside. Leave |
| `creator-payout-settings/components/creator-payout-legal-settings.test.ts` | `keeps tax identifiers, PAN, KYC, and verification controls outside the legal form` | `getByRole("dialog", { name: "Edit legal profile" })`. Leave |
| `creator-payout-settings/components/creator-payout-legal-settings.test.ts` | `uses the accessible Aurora drawer as a mobile sheet seam` | `getByRole("dialog", { name: "Add payout destination" })`. Leave |
| `settings/components/creator/creator-instagram-settings.test.ts` | `uses an accessible confirmation drawer before disconnecting` | `getByRole("dialog", { name: "Disconnect Instagram" })`. Leave |
| `settings/components/creator/creator-team-settings.test.ts` | invite drawer + `supports Escape dismissal and focus-safe Aurora drawer semantics` (2) | `getByRole("dialog")`. Leave |

## Named failures — Brand Settings regression (same primitive)

Not Creator Settings product. Recorded here because it ran in the C-05 packet.

| File | Case | Class |
|------|------|--------|
| `settings/components/brand/brand-integrations-settings.test.ts` | 3× `getByRole("dialog", { name: "Different Instagram account selected" })` | Same Aurora aside. Leave |
