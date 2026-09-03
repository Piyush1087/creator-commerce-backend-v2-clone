# Commands to run (C-01 / C-05 origin branch)

Do **not** run these against production or any shared AWS database.

Paste the last status block of each command (pass/fail counts, or the error)
back into chat, or drop the full log into `docs/handoff-audit/.logs/` and tell
me the filename.

Working tree: `feature/c01-c05-creator-integration` in both repos.

---

## 1. Backend — Prisma (local / disposable DB only)

From `d:\Work\cursor-repos\creator-commerce-backend-v2`:

```powershell
npx prisma validate
npx prisma generate
```

`validate` already passed on 2026-09-03 (`The schema at prisma\schema.prisma is valid`).
Re-run if you changed `schema.prisma` after that.

Local migrate only if this checkout points at a disposable database:

```powershell
npm run db:migrate:deploy
```

Expected after this port: origin's previous 74 migrations plus 8 C-01/C-05
migrations (**82**). Clone closeouts saying `0→70` / `0→74` are clone-repo counts.

---

## 2. Backend — scoped C-01 tests

```powershell
npx vitest run --config vitest.config.ts src/features/creator-entry src/features/c01-persistence
```

---

## 3. Backend — scoped C-05 tests

```powershell
npx vitest run --config vitest.config.ts src/features/creator-settings src/shared/team
```

---

## 4. Backend — auth + Brand Settings regression

```powershell
npx vitest run --config vitest.config.ts src/features/auth src/features/brand-settings
```

---

## 5. Backend — lint / build / full suite

Lint ran 2026-09-03: **code rules clean**. 1042 `prettier/prettier` hits are
format debt, not classified as code errors. Do **not** `eslint --fix` on this
branch.

`npm test` runs `prisma generate` first (`pretest`), so the first 1–2 minutes
can look hung. Then Vitest prints one line per file. Paste the final
`Test Files` / `Tests` block, or tee a log:

```powershell
npm test 2>&1 | Tee-Object -FilePath docs/handoff-audit/.logs/be-full-npm-test.log
```

---

## 6. Frontend — scoped C-01 / C-05 tests

From `d:\Work\cursor-repos\creator-commerce-frontend-v2`:

```powershell
npx vitest run --config vitest.config.ts src/features/creator-onboarding src/features/creator-payout-settings src/shared/creator src/routes/c05-frontend-convergence.architecture.test.ts src/features/settings/components/creator src/features/settings/components/creator-settings-shell.test.ts src/features/settings/utils/creator-settings-navigation.test.ts src/features/settings/api/creator-team-client.test.ts src/features/settings/api/creator-profile-contact-client.test.ts src/features/settings/api/creator-instagram-settings-client.test.ts src/features/settings/contracts/creator-instagram-settings.contracts.test.ts
```

---

## 7. Frontend — Brand Settings regression

```powershell
npx vitest run --config vitest.config.ts src/features/settings/components/brand src/features/settings/components/shared-account-security.architecture.test.ts src/features/settings/api/brand-settings-client.test.ts
```

---

## 8. Frontend — typecheck / lint / build / full suite

Typecheck, production build, and lint **passed** on 2026-09-03 (`npx tsc -b`
clean; `npm run build` wrote `dist/`; `npm run lint` 0 errors / 0 warnings).
Re-run only if frontend source changed after that.

```powershell
npm run typecheck
npm run lint
npm run build
npm test
```

Local UI click-through (C-01 then C-05): `ui-verification.md`.

---

## What to paste back

For each command, the useful tail looks like:

```text
Test Files  xx passed (xx)
     Tests  xx passed (xx)
```

or the first TypeScript / Nest error. Include the command name so it can be
filed under C-01, C-05, or regression.

Skip AWS, `db:tunnel:prod`, live Meta, and `RUN_MIGRATIONS_ON_START` changes.
