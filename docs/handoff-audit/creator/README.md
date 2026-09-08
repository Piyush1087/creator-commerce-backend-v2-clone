# Creator module audit (C-01 + C-05 + C-03)

Origin integration of accepted clone C-01 (Creator Entry), C-05 (Creator
Settings + persistent Creator shell), and C-03 (Campaign Participation / Apply).

C-05 cannot compile without C-01, so those two modules share one origin branch
and the shared files below. **C-03** uses a separate integration branch and its
own command/run-log files (do not overwrite C-01/C-05 evidence).

**Reusable process for future modules:**  
[`../MODULE-AUDIT-TESTING-PLAYBOOK.md`](../MODULE-AUDIT-TESTING-PLAYBOOK.md)  
(file set, status vocabulary, no-skip DB rules, report/test-results templates).

## Modules

| Module | Folder | Commands / run log |
|--------|--------|--------------------|
| C-01 Creator Entry | `01-c01-creator-entry/` | `commands-to-run.md` · `origin-run-log.md` |
| C-05 Settings + shell | `02-c05-creator-settings-shell/` | same shared files |
| C-03 Campaign Participation / Apply | `03-c03-campaign-participation/` | `c03-commands-to-run.md` · `c03-origin-run-log.md` |

**C-01 / C-05 reconciliation**

| Pass | Report | Test results |
|------|--------|--------------|
| 1 (2026-09-03) | `reconciliation-report.md` | `reconciliation-test-results.md` |
| 2 (2026-09-04) | `reconciliation-pass-2-report.md` | `reconciliation-pass-2-test-results.md` |

Do not overwrite earlier pass files; add `reconciliation-pass-N-*` for corrections.

## Origin branches

### C-01 / C-05 (historical)

| Repo | Branch | Base (`origin/development`) | Port status |
|------|--------|-----------------------------|-------------|
| Backend | `feature/c01-c05-creator-integration` | `2f03819` (Settings MVP PR #23) | See module packets |
| Frontend | `feature/c01-c05-creator-integration` | `f4e6c49` (Settings MVP PR #21) | See module packets |

### C-03 (current)

| Repo | Branch | Merge | Status |
|------|--------|-------|--------|
| Backend | `integration/c03-campaign-participation` | `9397a10` (parents `f274bad` + `aebeb85`) | BE scoped postgres green; uncommitted reconcile; no PR |
| Frontend | `integration/c03-campaign-participation` | `26e1a0d` (parents `fac47f2` + `82ed3c9`) | FE tsc/vitest/build/lint VERIFIED; uncommitted; no PR |

Not pushed for C-03. No PR. Production migrate/deploy is **not** authorized.

## Clone reference docs

C-01/C-05 copies remain under `docs/ai-collaboration/c01-*` and `c05-*`.

C-03 accepted tips (mail authority):

| Role | SHA |
|------|-----|
| Backend tip | `aebeb85fd6bba37f88c3805c213c61e7f63b2f5f` |
| Frontend tip | `82ed3c9ef849be8353565a1901b6f5fb065c37e1` |

Primary handoff (external):  
https://github.com/Piyush1087/dummy_tcs/blob/5e23582318cd7bbf637d184d36412cc3f8fe70a4/docs/ai-collaboration/c03-developer-code-integration-handoff-v1.md

## Gate before merge

### C-01 / C-05

1. You run the commands in `commands-to-run.md`.
2. Paste output into `origin-run-log.md` (or drop a log file under `../.logs/`).
3. We fill `automated-test-results.md` in both module folders with **origin** counts.
4. Walk `ui-verification.md` (C-01 then C-05) on local UI.
5. Product verification packet after tests + UI, then PR.
6. AWS / production migrate remains a later, separately authorized step.

### C-03

1. Run [`c03-commands-to-run.md`](./c03-commands-to-run.md) (FE still outstanding).
2. Paste into [`c03-origin-run-log.md`](./c03-origin-run-log.md) / `.logs/c03-*`.
3. Update [`03-c03-campaign-participation/automated-test-results.md`](./03-c03-campaign-participation/automated-test-results.md).
4. UI smoke only if Product asks.
5. Commit + push + PR to **`origin/development`** when you ask — **not** deploy.
6. AWS / production migrate remains separately authorized.

